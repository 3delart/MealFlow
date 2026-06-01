const FALLBACK_PROFILES = [
  {
    User: "florian",
    Prénom: "Florian",
    Taille_cm: "180",
    Poids_kg: "75",
    Âge: "32",
    Sexe: "M",
    Activité: "Modéré",
    Objectif: "Perte modérée",
    Régime: "Omnivore",
    Allergies_JSON: "[]",
    Aversions_JSON: "[]",
    Cuisines_JSON: '["Méditerranéenne"]',
    Niveau_culinaire: "Expert",
    Durée_max_prep: "Moyenne"
  },
  {
    User: "naomi",
    Prénom: "Naomi",
    Taille_cm: "165",
    Poids_kg: "58",
    Âge: "28",
    Sexe: "F",
    Activité: "Modéré",
    Objectif: "Perte modérée",
    Régime: "Omnivore",
    Allergies_JSON: "[]",
    Aversions_JSON: "[]",
    Cuisines_JSON: '["Asiatique", "Méditerranéenne"]',
    Niveau_culinaire: "Intermédiaire",
    Durée_max_prep: "Courte"
  }
];

let profilesData = {};

async function loadProfiles() {
  try {
    const rows = await SheetsAPI.readSheetTab("Profils");
    const objects = SheetsAPI.rowsToObjects(rows);

    profilesData = {};
    objects.forEach(row => {
      const userId = (row["User"] || "").toLowerCase().trim();
      if (userId) {
        profilesData[userId] = row;
      }
    });

  } catch (err) {
    console.warn("Profils: Sheets API unavailable, using fallback data.", err.message);
    useFallbackProfiles();
  }
}

function useFallbackProfiles() {
  profilesData = {};
  FALLBACK_PROFILES.forEach(p => {
    profilesData[p.User] = p;
  });
}

function loadProfileOverrides() {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key && key.startsWith("mealflow_profile_")) {
      const userId = key.replace("mealflow_profile_", "");
      if (!profilesData[userId]) {
        localStorage.removeItem(key);
      }
    }
  }

  Object.keys(profilesData).forEach(userId => {
    const stored = localStorage.getItem(`mealflow_profile_${userId}`);
    if (stored) {
      try {
        profilesData[userId] = JSON.parse(stored);
      } catch (err) {
        console.warn(`Failed to parse localStorage profile for ${userId}:`, err);
      }
    }
  });
}

function saveProfileData(userId, formData) {
  let cuisines = [];
  try {
    cuisines = JSON.parse(formData["Cuisines_JSON"]);
  } catch (_) {
    cuisines = [];
  }

  const allergies = (formData["Allergies_JSON"] || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  const aversions = (formData["Aversions_JSON"] || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  const updatedProfile = {
    ...profilesData[userId],
    User: userId,
    Prénom: formData["Prénom"],
    Taille_cm: formData["Taille_cm"],
    Poids_kg: formData["Poids_kg"],
    Âge: formData["Âge"],
    Sexe: formData["Sexe"],
    Activité: formData["Activité"],
    Objectif: formData["Objectif"],
    Régime: formData["Régime"],
    Niveau_culinaire: formData["Niveau_culinaire"],
    Durée_max_prep: formData["Durée_max_prep"],
    Cuisines_JSON: JSON.stringify(cuisines),
    Allergies_JSON: JSON.stringify(allergies),
    Aversions_JSON: JSON.stringify(aversions),
    Calories_cible: formData["Calories_cible"]
  };

  localStorage.setItem(`mealflow_profile_${userId}`, JSON.stringify(updatedProfile));
  profilesData[userId] = updatedProfile;


  if (typeof isAuthenticated === "function" && isAuthenticated()) {
    syncProfileToSheets(userId, updatedProfile);
  }
}

async function syncProfileToSheets(userId, profile) {
  if (!window.SheetsAPI) {
    console.warn("Profils: SheetsAPI not available, skipping Sheets sync");
    return;
  }

  try {
    const token = window.getAccessToken ? window.getAccessToken() : null;
    if (!token) {
      console.warn("Profils: No OAuth token, cannot sync to Sheets");
      return;
    }

    const existingRows = await window.SheetsAPI.readSheetTab("Profils");
    const objects = window.SheetsAPI.rowsToObjects(existingRows);
    const existingProfile = objects.find(p => (p.User || "").toLowerCase() === userId.toLowerCase());

    if (existingProfile) {
      const rowNum = objects.indexOf(existingProfile) + 2;

      const updates = {
        "C": profile.Taille_cm,
        "D": profile.Poids_kg,
        "E": profile.Âge,
        "F": profile.Sexe,
        "G": profile.Activité,
        "H": profile.Objectif,
        "I": profile.Régime,
        "O": profile.Calories_cible
      };

      for (const [col, value] of Object.entries(updates)) {
        const range = `Profils!${col}${rowNum}`;
        await window.SheetsAPI.updateSheetCell(range, value, token);
      }
    } else {
      const row = [
        userId,
        profile.Prénom || userId,
        profile.Taille_cm,
        profile.Poids_kg,
        profile.Âge,
        profile.Sexe,
        profile.Activité,
        profile.Objectif,
        profile.Régime,
        profile.Allergies_JSON,
        profile.Aversions_JSON,
        profile.Cuisines_JSON,
        profile.Niveau_culinaire,
        profile.Durée_max_prep,
        profile.Calories_cible
      ];

      await window.SheetsAPI.appendRowWithToken("Profils", row, token);
    }
  } catch (err) {
    console.error("Profils: Failed to sync to Sheets:", err);
  }
}
