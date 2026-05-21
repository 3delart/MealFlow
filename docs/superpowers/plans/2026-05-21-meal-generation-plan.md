# Meal Generation Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to execute tasks sequentially.

**Goal:** Implement Claude API-powered weekly meal plan generation that respects user profiles, inventory constraints, and calorie targets. Auto-generate every Friday at 17:00 via GitHub Actions, with manual regeneration button.

**Architecture:** 
- GitHub Actions workflow (scheduled + manual dispatch)
- Google Service Account for Sheets write access
- Claude API for meal generation prompt
- Meals written to Sheets Planning tab (5 meals/day × 7 days)

**Tech Stack:** GitHub Actions, Claude API, Google Sheets API v4, Node.js

---

## Task 1: Create Google Service Account

**Files:**
- Google Cloud Console (browser, no files created locally)

- [ ] **Step 1: Create Service Account**

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Select **MealFlow** project
3. Left menu → **APIs & Services** → **Service Accounts**
4. Click **Create Service Account**
5. Name: `mealflow-generator`
6. Description: `Automated meal generation for MealFlow`
7. Click **Create and Continue**

- [ ] **Step 2: Grant Sheets API role**

1. Grant role: **Editor** (or **Google Sheets Editor** if available)
2. Click **Continue**
3. Click **Done**

- [ ] **Step 3: Generate JSON Key**

1. Click service account name `mealflow-generator@...`
2. Go to **Keys** tab
3. Click **Add Key** → **Create new key**
4. Type: **JSON**
5. Click **Create**
6. File downloads automatically (save as `service-account-key.json`)

- [ ] **Step 4: Share Sheets with Service Account**

1. Open Google Sheet `MealFlow_Data`
2. Click **Share** (top-right)
3. Paste email: `mealflow-generator@mealflow-<project-id>.iam.gserviceaccount.com`
4. Role: **Editor**
5. Click **Share**

---

## Task 2: Add GitHub Secrets

**Files:**
- GitHub Repo Settings (browser, no local files)

- [ ] **Step 1: Get Claude API Key**

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create API key if not already done
3. Copy key (format: `sk-ant-...`)

- [ ] **Step 2: Add CLAUDE_API_KEY to GitHub**

1. Go to repo: https://github.com/3delart/MealFlow
2. Settings → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `CLAUDE_API_KEY`
5. Value: paste your Claude API key
6. Click **Add secret**

- [ ] **Step 3: Add GOOGLE_SERVICE_ACCOUNT to GitHub**

1. Click **New repository secret** again
2. Name: `GOOGLE_SERVICE_ACCOUNT`
3. Value: paste entire JSON contents from `service-account-key.json`
4. Click **Add secret**

---

## Task 3: Create GitHub Actions Workflow

**Files:**
- Create: `.github/workflows/generate-meals.yml`

- [ ] **Step 1: Create workflow file**

Create file: `.github/workflows/generate-meals.yml`

```yaml
name: Generate Weekly Meals

on:
  schedule:
    - cron: '0 17 * * 5'  # Friday 17:00 UTC
  workflow_dispatch:  # Manual trigger

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Generate meals
        env:
          CLAUDE_API_KEY: ${{ secrets.CLAUDE_API_KEY }}
          GOOGLE_SERVICE_ACCOUNT: ${{ secrets.GOOGLE_SERVICE_ACCOUNT }}
          SHEET_ID: '1Dg9d-XIHzPqQIi4wZ2bTbnmHUKkn_V-IRzMOtRzQjOI'
        run: node .github/scripts/generate-meals.js

      - name: Commit changes
        run: |
          git config --local user.email "action@github.com"
          git config --local user.name "Meal Generator Bot"
          git add docs/meal-generation-log.md || true
          git commit -m "chore: meal generation $(date +%Y-%m-%d)" || true
          git push || true
```

- [ ] **Step 2: Commit workflow**

```bash
git add .github/workflows/generate-meals.yml
git commit -m "ci: add meal generation workflow"
git push
```

---

## Task 4: Create Meal Generation Script

**Files:**
- Create: `.github/scripts/generate-meals.js`

- [ ] **Step 1: Write meal generation script**

Create file: `.github/scripts/generate-meals.js`

```javascript
const fs = require("fs");
const { google } = require("googleapis");

const SHEET_ID = process.env.SHEET_ID;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const SERVICE_ACCOUNT = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

/**
 * Fetch profiles from Sheets
 */
async function fetchProfiles(sheets) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "Profils!A:O"
  });

  const rows = response.data.values || [];
  if (rows.length < 2) throw new Error("No profiles in Sheets");

  const headers = rows[0];
  const profiles = rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] || "";
    });
    return obj;
  });

  return profiles;
}

/**
 * Fetch inventory from Sheets
 */
async function fetchInventory(sheets) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "Inventory!A:L"
  });

  const rows = response.data.values || [];
  if (rows.length < 2) return [];

  const headers = rows[0];
  const items = rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] || "";
    });
    return obj;
  });

  return items;
}

/**
 * Generate meal plan via Claude API
 */
async function generateMealPlan(profiles, inventory) {
  const profileSummary = profiles
    .map(p => {
      const allergies = p.Allergies_JSON ? JSON.parse(p.Allergies_JSON) : [];
      const aversions = p.Aversions_JSON ? JSON.parse(p.Aversions_JSON) : [];
      const cuisines = p.Cuisines_JSON ? JSON.parse(p.Cuisines_JSON) : [];

      return `
**${p.Prénom}** (${p.Sexe}, ${p.Âge}yo, ${p.Poids_kg}kg, ${p.Taille_cm}cm)
- Régime: ${p.Régime}
- Objectif: ${p.Objectif}
- Allergies: ${allergies.join(", ") || "Aucune"}
- Aversions: ${aversions.join(", ") || "Aucune"}
- Cuisines préférées: ${cuisines.join(", ") || "Aucune"}
- Calories cible: ${p.Calories_cible_manuel || "Auto"}
`;
    })
    .join("\n");

  const inventoryList = inventory
    .map(i => `- ${i.Produit} (${i.Qty}${i.Unité}, expires ${i.Péremption})`)
    .join("\n");

  const prompt = `Tu es un nutritionniste expert. Génère un plan de repas pour 7 jours (petit-déj, collation matin, déjeuner, collation après-midi, dîner) pour deux personnes:

${profileSummary}

Ingrédients disponibles:
${inventoryList}

Contraintes:
1. Respecte STRICTEMENT les régimes (vegan, omnivore, etc)
2. ÉVITE les allergènes listés
3. ÉVITE les aversions
4. Privilégie les cuisines préférées
5. Respecte les cibles caloriques
6. Utilise au maximum les ingrédients disponibles
7. Suggère des achats pour compléter

Format: JSON uniquement, structure:
{
  "semaine": [
    {
      "date": "2026-05-26",
      "jour": "Lundi",
      "petit_dejeuner": "...",
      "collation_matin": "...",
      "dejeuner": "...",
      "collation_apres_midi": "...",
      "diner": "..."
    },
    ...
  ],
  "achats_recommandes": ["item1", "item2", ...]
}`;

  const response = await fetch("https://api.anthropic.com/v1/messages/create", {
    method: "POST",
    headers: {
      "x-api-key": CLAUDE_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: "claude-opus-4-7",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }]
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(`Claude API error: ${data.error?.message}`);

  const content = data.content[0].text;
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in Claude response");

  return JSON.parse(jsonMatch[0]);
}

/**
 * Write meal plan to Sheets Planning tab
 */
async function writeMealPlan(sheets, mealPlan) {
  const header = ["Date", "Jour", "Petit-déj", "Collation_matin", "Déjeuner", "Collation_après-midi", "Diner"];
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

  // Clear Planning tab first
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SHEET_ID,
    range: "Planning!A:G"
  });

  // Write meal plan
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: "Planning!A1",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rows }
  });

  console.log(`✓ Meal plan written to Sheets (${rows.length - 1} days)`);
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log("Starting meal generation...");

    // Authenticate with service account
    const auth = new google.auth.GoogleAuth({
      credentials: SERVICE_ACCOUNT,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });

    const sheets = google.sheets({ version: "v4", auth });

    // Fetch data
    console.log("Fetching profiles...");
    const profiles = await fetchProfiles(sheets);
    console.log(`✓ Got ${profiles.length} profiles`);

    console.log("Fetching inventory...");
    const inventory = await fetchInventory(sheets);
    console.log(`✓ Got ${inventory.length} inventory items`);

    // Generate meals
    console.log("Generating meal plan with Claude...");
    const mealPlan = await generateMealPlan(profiles, inventory);
    console.log("✓ Meal plan generated");

    // Write to Sheets
    console.log("Writing to Sheets...");
    await writeMealPlan(sheets, mealPlan);

    console.log("✅ Meal generation complete!");

    // Log to file
    fs.appendFileSync(
      "docs/meal-generation-log.md",
      `\n## ${new Date().toISOString()}\n✅ Generated meal plan for ${mealPlan.semaine.length} days\n`
    );
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

main();
```

- [ ] **Step 2: Install googleapis dependency**

Update `package.json` (in root):

```json
{
  "devDependencies": {
    "googleapis": "^118.0.0"
  }
}
```

Or create `.github/scripts/package.json`:

```json
{
  "dependencies": {
    "googleapis": "^118.0.0"
  }
}
```

- [ ] **Step 3: Commit script**

```bash
git add .github/scripts/generate-meals.js
git add package.json  # if updated
git commit -m "ci: add meal generation script"
git push
```

---

## Task 5: Add Manual Regenerate Button to Planning Page

**Files:**
- Modify: `planning.html`
- Create: `js/meal-generation.js`

- [ ] **Step 1: Add button to planning.html**

In `<header>`, add:

```html
<button id="regenerate-meals-btn" class="btn btn-primary" onclick="regenerateMeals()">
  🤖 Régénérer semaine
</button>
```

- [ ] **Step 2: Create meal-generation.js module**

Create `js/meal-generation.js`:

```javascript
/**
 * Trigger manual meal generation via GitHub Actions dispatch
 */
async function regenerateMeals() {
  const btn = document.getElementById("regenerate-meals-btn");
  if (!btn) return;

  btn.disabled = true;
  btn.textContent = "Génération en cours...";

  try {
    // GitHub Actions REST API to trigger workflow
    const response = await fetch(
      "https://api.github.com/repos/3delart/MealFlow/actions/workflows/generate-meals.yml/dispatches",
      {
        method: "POST",
        headers: {
          "Authorization": `token ${prompt("GitHub Token (see docs):")}`,
          "Accept": "application/vnd.github.v3+raw+json"
        },
        body: JSON.stringify({ ref: "main" })
      }
    );

    if (response.ok) {
      console.log("✓ Meal generation triggered. Check back in 1-2 minutes.");
      btn.textContent = "✓ Génération lancée!";
      setTimeout(() => location.reload(), 2000);
    } else {
      throw new Error(`GitHub API error: ${response.status}`);
    }
  } catch (error) {
    console.error("Failed to trigger generation:", error);
    btn.disabled = false;
    btn.textContent = "🤖 Régénérer semaine";
    alert(`Erreur: ${error.message}`);
  }
}
```

- [ ] **Step 3: Add to planning.html script tags**

```html
<script src="js/meal-generation.js"></script>
```

- [ ] **Step 4: Commit**

```bash
git add planning.html js/meal-generation.js
git commit -m "feat: add manual meal regeneration button"
git push
```

---

## Task 6: Test Workflow

- [ ] **Step 1: Verify workflow in GitHub**

1. Go to repo → **Actions** tab
2. Should see **Generate Weekly Meals** workflow
3. Click **Run workflow** → **Run workflow** (manual trigger)
4. Watch logs

- [ ] **Step 2: Check Sheets Planning tab**

After 1-2 minutes, Planning tab should have 7 days of meals.

- [ ] **Step 3: Verify Claude prompt respected constraints**

- Meals follow each person's régime
- Avoid allergies/aversions
- Prefer listed cuisines
- Calories approximately match target

---

## Notes

- GitHub Actions API token needed for manual button (requires GitHub user token with `repo` scope)
- Workflow runs at Friday 17:00 UTC (adjust cron if different timezone)
- Claude model: `claude-opus-4-7` (best for complex reasoning)
- Service account email: `mealflow-generator@mealflow-<PROJECT_ID>.iam.gserviceaccount.com`
