const fs = require("fs");
const { google } = require("googleapis");
const https = require("https");

console.log("🚀 Starting meal generation script");

const SHEET_ID = process.env.SHEET_ID;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

console.log(`Sheet ID: ${SHEET_ID}`);
console.log(`Claude API Key: ${CLAUDE_API_KEY ? "✓ set" : "❌ missing"}`);

let SERVICE_ACCOUNT;
try {
  SERVICE_ACCOUNT = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
  console.log(`Service Account: ✓ loaded (${SERVICE_ACCOUNT.client_email})`);
} catch (e) {
  console.error("❌ Failed to parse SERVICE_ACCOUNT JSON:", e.message);
  process.exit(1);
}

async function fetchProfiles(sheets) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "Profils!A:O"
  });

  const rows = response.data.values || [];
  if (rows.length < 2) throw new Error("No profiles");

  const headers = rows[0];
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] || "";
    });
    return obj;
  });
}

async function fetchInventory(sheets) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "Inventory!A:L"
  });

  const rows = response.data.values || [];
  if (rows.length < 2) return [];

  const headers = rows[0];
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] || "";
    });
    return obj;
  });
}

async function generateMealPlan(profiles, inventory) {
  const profileSummary = profiles
    .map(p => {
      let allergies = [];
      let aversions = [];
      let cuisines = [];

      try {
        if (p.Allergies_JSON) allergies = JSON.parse(p.Allergies_JSON);
      } catch (e) {}
      try {
        if (p.Aversions_JSON) aversions = JSON.parse(p.Aversions_JSON);
      } catch (e) {}
      try {
        if (p.Cuisines_JSON) cuisines = JSON.parse(p.Cuisines_JSON);
      } catch (e) {}

      return `## ${p.Prénom}
- Infos: ${p.Sexe}, ${p.Âge} ans, ${p.Poids_kg}kg, ${p.Taille_cm}cm
- Régime: ${p.Régime} (STRICT - évite complètement autres régimes)
- Objectif: ${p.Objectif}
- Niveau culinaire: ${p.Niveau_culinaire}
- Durée max prép: ${p.Durée_max_prep}
- **ALLERGIES (CRITICAL - EVITE ABSOLUMENT)**: ${allergies.length ? allergies.join(", ") : "Aucune"}
- **AVERSIONS (NEVER)**: ${aversions.length ? aversions.join(", ") : "Aucune"}
- **Cuisines préférées**: ${cuisines.length ? cuisines.join(", ") : "Aucune"}
- Calories cible/jour: ${p.Calories_cible_manuel || "2000 (défaut)"}`;
    })
    .join("\n\n");

  const inventoryList = inventory
    .filter(i => !i.Consommé || i.Consommé === "FALSE")
    .map(i => `- ${i.Produit} (${i.Qty}${i.Unité}, expires ${i.Péremption})`)
    .join("\n");

  const prompt = `Tu es nutritionniste expert. Crée plan repas 7 jours PERSONNALISÉ pour 2 personnes avec contraintes STRICTES.

## PROFILS DÉTAILLÉS:
${profileSummary}

## INGRÉDIENTS DISPONIBLES:
${inventoryList || "❌ AUCUN - Suggère achats essentiels"}

## RÈGLES ABSOLUES (NON-NÉGOCIABLES):
1. **RÉGIME**: Respecte PRÉCISÉMENT le régime listés (vegan=zéro viande/poisson/oeufs/lait; omnivore=tout ok)
2. **ALLERGIES**: JAMAIS d'allergènes listés (risque santé)
3. **AVERSIONS**: JAMAIS les ingrédients/plats listés (même en petite quantité)
4. **CUISINES**: Privilégie les cuisines préférées de chaque personne
5. **CALORIES**: Chaque repas doit environ atteindre cible journalière (divisée entre 5 repas)
6. **INGRÉDIENTS**: Utilise MAX les ingrédients dispo (+ suggère achats complémentaires)
7. **PRÉPARATION**: Respecte durée max prép (rapide/moyenne/longue)

## FORMAT RÉPONSE (JSON UNIQUEMENT, PAS DE TEXTE):
{
  "semaine": [
    {
      "date": "2026-05-26",
      "jour": "Lundi",
      "petit_dejeuner": "Description détaillée du plat + ingrédients clés",
      "collation_matin": "...",
      "dejeuner": "...",
      "collation_apres_midi": "...",
      "diner": "..."
    }
  ],
  "achats_recommandes": ["Ingrédient 1", "Ingrédient 2"]
}`;

  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: "claude-opus-4-7",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }]
    });

    const options = {
      hostname: "api.anthropic.com",
      path: "/v1/messages",
      method: "POST",
      headers: {
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
        "content-length": data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const response = JSON.parse(body);
          if (response.error) {
            reject(new Error(`Claude API: ${response.error.message}`));
            return;
          }

          const content = response.content[0].text;
          const match = content.match(/\{[\s\S]*\}/);
          if (!match) {
            reject(new Error("No JSON in Claude response"));
            return;
          }

          resolve(JSON.parse(match[0]));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function writeMealPlan(sheets, mealPlan) {
  const header = [
    "Date",
    "Jour",
    "Petit-déj",
    "Collation_matin",
    "Déjeuner",
    "Collation_après-midi",
    "Diner"
  ];

  const rows = [header];
  mealPlan.semaine.forEach(day => {
    rows.push([
      day.date,
      day.jour,
      day.petit_dejeuner,
      day.collation_matin,
      day.dejeuner,
      day.collation_apres_midi,
      day.diner
    ]);
  });

  await sheets.spreadsheets.values.clear({
    spreadsheetId: SHEET_ID,
    range: "Planning!A:G"
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: "Planning!A1",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rows }
  });

  console.log(`✓ ${rows.length - 1} days written to Planning`);
}

async function main() {
  try {
    console.log("Starting meal generation...");

    const auth = new google.auth.GoogleAuth({
      credentials: SERVICE_ACCOUNT,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });

    const sheets = google.sheets({ version: "v4", auth });

    console.log("Fetching profiles...");
    const profiles = await fetchProfiles(sheets);
    console.log(`✓ ${profiles.length} profiles`);

    console.log("Fetching inventory...");
    const inventory = await fetchInventory(sheets);
    console.log(`✓ ${inventory.length} items`);

    console.log("Generating with Claude...");
    const mealPlan = await generateMealPlan(profiles, inventory);
    console.log("✓ Plan generated");

    console.log("Writing to Sheets...");
    await writeMealPlan(sheets, mealPlan);

    console.log("✅ Done!");
  } catch (error) {
    console.error("❌", error.message);
    process.exit(1);
  }
}

main();
