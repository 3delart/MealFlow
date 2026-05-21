/**
 * @fileoverview Profils page logic for MealFlow
 * Loads user profiles from the "Profils" Google Sheets tab,
 * calculates BMR / TDEE / objective calories, and renders profile cards.
 *
 * Expected sheet columns (row 1 = header):
 *   User | Prénom | Taille_cm | Poids_kg | Âge | Sexe | Activité | Objectif |
 *   Régime | Allergies_JSON | Aversions_JSON | Cuisines_JSON |
 *   Niveau_culinaire | Durée_max_prep
 */

// ============================================================================
// FALLBACK / DEMO DATA
// Used when the Sheets API is unavailable (no key configured yet)
// ============================================================================

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

// ============================================================================
// MODULE STATE
// ============================================================================

/** @type {Object.<string, Object>} Profiles keyed by User ID (lowercase) */
let profilesData = {};

// ============================================================================
// DATA LOADING
// ============================================================================

/**
 * Load profiles from the "Profils" Sheets tab.
 * On failure (no API key, network error) falls back to demo data.
 * @returns {Promise<void>}
 */
async function loadProfiles() {
  try {
    const rows = await SheetsAPI.readSheetTab("Profils");
    const objects = SheetsAPI.rowsToObjects(rows);

    if (objects.length === 0) {
      console.warn("Profils: empty sheet response, using fallback data");
      useFallbackProfiles();
      return;
    }

    profilesData = {};
    objects.forEach(row => {
      const userId = (row["User"] || "").toLowerCase().trim();
      if (userId) {
        profilesData[userId] = row;
      }
    });

    console.log("Profils: loaded", Object.keys(profilesData).length, "profiles from Sheets");
  } catch (err) {
    console.warn("Profils: Sheets API unavailable, using fallback data.", err.message);
    useFallbackProfiles();
  }
}

/**
 * Populate profilesData from the built-in fallback array.
 */
function useFallbackProfiles() {
  profilesData = {};
  FALLBACK_PROFILES.forEach(p => {
    profilesData[p.User] = p;
  });
}

// ============================================================================
// CALCULATIONS
// ============================================================================

/**
 * Parse a numeric field, returning NaN if missing or invalid.
 * @param {string} val - Raw string value from the sheet
 * @returns {number}
 */
function parseNum(val) {
  const n = parseFloat(val);
  return isNaN(n) ? NaN : n;
}

/**
 * Parse a JSON array field. Accepts JSON arrays or comma-separated strings.
 * Returns an empty array on failure.
 * @param {string} val - Raw string from the sheet
 * @returns {string[]}
 */
function parseArrayField(val) {
  if (!val || val.trim() === "") return [];
  const trimmed = val.trim();
  // Try JSON first
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch (_) {
      // fall through to comma split
    }
  }
  // Comma-separated fallback
  return trimmed.split(",").map(s => s.trim()).filter(Boolean);
}

/**
 * Compute BMR, TDEE, IMC, and calorie target for a profile row.
 * @param {Object} profile - Raw profile row from the sheet
 * @returns {{bmr: number, tdee: number, calorieTarget: number, imc: number}}
 */
function calculateProfileMetrics(profile) {
  const weight = parseNum(profile["Poids_kg"]);
  const height = parseNum(profile["Taille_cm"]);
  const age    = parseNum(profile["Âge"]);
  const sex    = (profile["Sexe"] || "").trim();
  const activity = (profile["Activité"] || "Sédentaire").trim();
  const objectif = (profile["Objectif"] || "Maintien").trim();

  let bmr = NaN;
  let tdee = NaN;
  let calorieTarget = NaN;
  let imc = NaN;

  if (!isNaN(weight) && !isNaN(height) && !isNaN(age) && sex) {
    bmr = Utils.calculateBMR(weight, height, age, sex);
    tdee = Utils.calculateTDEE(bmr, activity);
    calorieTarget = Utils.calculateObjectiveCalories(tdee, objectif);
    imc = weight / Math.pow(height / 100, 2);
  }

  return { bmr, tdee, calorieTarget, imc };
}

// ============================================================================
// RENDERING
// ============================================================================

/**
 * Format a numeric value for display, with optional unit.
 * Returns "—" if the value is NaN.
 * @param {number} val
 * @param {string} [unit=""]
 * @param {number} [decimals=0]
 * @returns {string}
 */
function fmt(val, unit = "", decimals = 0) {
  if (isNaN(val) || val === null || val === undefined) return "—";
  return val.toFixed(decimals) + (unit ? " " + unit : "");
}

/**
 * Build an IMC classification label.
 * @param {number} imc
 * @returns {string}
 */
function imcLabel(imc) {
  if (isNaN(imc)) return "";
  if (imc < 18.5) return "Sous-poids";
  if (imc < 25)   return "Normal";
  if (imc < 30)   return "Surpoids";
  return "Obésité";
}

/**
 * Create a single stat item element.
 * @param {string} label
 * @param {string} value
 * @param {string} [subvalue=""]
 * @returns {HTMLElement}
 */
function createStatItem(label, value, subvalue = "") {
  const item = document.createElement("div");
  item.className = "stat-item";

  const lbl = document.createElement("span");
  lbl.className = "stat-label";
  lbl.textContent = label;

  const val = document.createElement("span");
  val.className = "stat-value";
  val.textContent = value;

  item.appendChild(lbl);
  item.appendChild(val);

  if (subvalue) {
    const sub = document.createElement("span");
    sub.className = "stat-subvalue";
    sub.textContent = subvalue;
    item.appendChild(sub);
  }

  return item;
}

/**
 * Create a profile section block with a title and content element.
 * @param {string} title - Section title
 * @param {HTMLElement} content - Content element
 * @returns {HTMLElement}
 */
function createSection(title, content) {
  const section = document.createElement("div");
  section.className = "profile-section";

  const heading = document.createElement("p");
  heading.className = "profile-section-title";
  heading.textContent = title;

  section.appendChild(heading);
  section.appendChild(content);
  return section;
}

/**
 * Create a tag list element from an array of strings.
 * @param {string[]} items
 * @returns {HTMLElement}
 */
function createTagList(items) {
  if (!items || items.length === 0) {
    const empty = document.createElement("span");
    empty.className = "tag-empty";
    empty.textContent = "Aucune";
    return empty;
  }

  const ul = document.createElement("ul");
  ul.className = "tag-list";
  items.forEach(item => {
    const li = document.createElement("li");
    li.className = "tag";
    li.textContent = item;
    ul.appendChild(li);
  });
  return ul;
}

/**
 * Render a complete profile card for a given user ID.
 * @param {string} userId - Lowercase user ID key in profilesData
 * @returns {HTMLElement|null}
 */
function renderProfileCard(userId) {
  const profile = profilesData[userId];
  if (!profile) {
    console.warn("Profils: no profile found for user:", userId);
    return null;
  }

  const metrics = calculateProfileMetrics(profile);
  const { bmr, tdee, calorieTarget, imc } = metrics;

  const allergies = parseArrayField(profile["Allergies_JSON"]);
  const aversions = parseArrayField(profile["Aversions_JSON"]);
  const cuisines  = parseArrayField(profile["Cuisines_JSON"]);

  const prenom     = profile["Prénom"] || userId;
  const regime     = profile["Régime"] || "—";
  const activite   = profile["Activité"] || "—";
  const objectif   = profile["Objectif"] || "—";
  const niveauCulinaire = profile["Niveau_culinaire"] || "—";
  const dureePrep  = profile["Durée_max_prep"] || "—";
  const taille     = profile["Taille_cm"] || "—";
  const poids      = profile["Poids_kg"] || "—";
  const age        = profile["Âge"] || "—";
  const sexe       = profile["Sexe"] || "—";

  // Root card element
  const card = document.createElement("div");
  card.className = `profile-card ${userId}`;
  card.setAttribute("data-user", userId);

  // --- Header ---
  const header = document.createElement("div");
  header.className = "profile-header";

  const headerTop = document.createElement("div");
  headerTop.className = "profile-header-top";

  const avatarEl = document.createElement("span");
  avatarEl.className = "profile-avatar";
  avatarEl.textContent = userId === "florian" ? "👨" : "👩";

  const regimeBadge = document.createElement("span");
  regimeBadge.className = "regime-badge";
  regimeBadge.textContent = "Régime : " + regime;

  headerTop.appendChild(avatarEl);
  headerTop.appendChild(regimeBadge);

  const nameEl = document.createElement("h2");
  nameEl.className = "profile-name";
  nameEl.textContent = prenom;

  header.appendChild(headerTop);
  header.appendChild(nameEl);
  card.appendChild(header);

  // --- Body ---
  const body = document.createElement("div");
  body.className = "profile-body";

  // Measurements
  const measureGroup = document.createElement("div");
  measureGroup.className = "stat-group four-col";
  measureGroup.appendChild(createStatItem("Taille", taille !== "—" ? taille + " cm" : "—"));
  measureGroup.appendChild(createStatItem("Poids", poids !== "—" ? poids + " kg" : "—"));
  measureGroup.appendChild(createStatItem("IMC", fmt(imc, "", 1), imcLabel(imc)));
  measureGroup.appendChild(createStatItem("Âge", age !== "—" ? age + " ans" : "—", "Sexe : " + sexe));
  body.appendChild(createSection("Mensurations", measureGroup));

  // Metabolism
  const metaGroup = document.createElement("div");
  metaGroup.className = "stat-group";
  metaGroup.appendChild(createStatItem("BMR", fmt(bmr, "kcal"), "Métabolisme de base"));
  metaGroup.appendChild(createStatItem("TDEE", fmt(tdee, "kcal"), "Dépense totale"));
  metaGroup.appendChild(createStatItem("Objectif", fmt(calorieTarget, "kcal"), objectif));
  metaGroup.appendChild(createStatItem("Activité", activite));
  body.appendChild(createSection("Métabolisme", metaGroup));

  // Preferences
  const prefGroup = document.createElement("div");
  prefGroup.className = "stat-group";
  prefGroup.appendChild(createStatItem("Niveau culinaire", niveauCulinaire));
  prefGroup.appendChild(createStatItem("Durée max prépa", dureePrep));

  const cuisineWrap = document.createElement("div");
  cuisineWrap.style.gridColumn = "1 / -1";
  const cuisineLabel = document.createElement("span");
  cuisineLabel.className = "stat-label";
  cuisineLabel.textContent = "Cuisines préférées";
  cuisineWrap.appendChild(cuisineLabel);
  cuisineWrap.appendChild(createTagList(cuisines));
  prefGroup.appendChild(cuisineWrap);

  body.appendChild(createSection("Préférences", prefGroup));

  // Restrictions
  const restrGroup = document.createElement("div");
  restrGroup.className = "stat-group";

  const allergiesWrap = document.createElement("div");
  const allergiesLabel = document.createElement("span");
  allergiesLabel.className = "stat-label";
  allergiesLabel.textContent = "Allergies";
  allergiesWrap.appendChild(allergiesLabel);
  allergiesWrap.appendChild(createTagList(allergies));
  restrGroup.appendChild(allergiesWrap);

  const aversionsWrap = document.createElement("div");
  const aversionsLabel = document.createElement("span");
  aversionsLabel.className = "stat-label";
  aversionsLabel.textContent = "Aversions";
  aversionsWrap.appendChild(aversionsLabel);
  aversionsWrap.appendChild(createTagList(aversions));
  restrGroup.appendChild(aversionsWrap);

  body.appendChild(createSection("Restrictions alimentaires", restrGroup));

  card.appendChild(body);

  // --- Footer with edit button ---
  const footer = document.createElement("div");
  footer.className = "profile-footer";

  const editBtn = document.createElement("button");
  editBtn.className = "btn-edit-profile";
  editBtn.textContent = "✏️ Modifier";
  editBtn.addEventListener("click", function() {
    openEditModal(userId);
  });

  footer.appendChild(editBtn);
  card.appendChild(footer);

  return card;
}

// ============================================================================
// MODAL MANAGEMENT
// ============================================================================

/**
 * Open the edit modal for a given user.
 * @param {string} userId - Lowercase user ID (e.g., "florian")
 */
function openEditModal(userId) {
  const profile = profilesData[userId];
  if (!profile) {
    console.error("Profile not found for user:", userId);
    return;
  }

  const modal = document.getElementById("modal-edit-profile");
  const form = document.getElementById("edit-profile-form");
  const title = document.getElementById("modal-title");

  const prenom = profile["Prénom"] || userId;
  title.textContent = `Modification du profil de ${prenom}`;

  // Populate form fields
  document.getElementById("field-taille").value = profile["Taille_cm"] || "";
  document.getElementById("field-poids").value = profile["Poids_kg"] || "";
  document.getElementById("field-age").value = profile["Âge"] || "";
  document.getElementById("field-activite").value = profile["Activité"] || "";
  document.getElementById("field-objectif").value = profile["Objectif"] || "";
  document.getElementById("field-regime").value = profile["Régime"] || "";
  document.getElementById("field-niveau").value = profile["Niveau_culinaire"] || "";
  document.getElementById("field-duree").value = profile["Durée_max_prep"] || "";

  // Convert JSON arrays back to comma-separated strings
  const cuisines = parseArrayField(profile["Cuisines_JSON"]);
  document.getElementById("field-cuisines").value = cuisines.join(", ");

  const allergies = parseArrayField(profile["Allergies_JSON"]);
  document.getElementById("field-allergies").value = allergies.join(", ");

  const aversions = parseArrayField(profile["Aversions_JSON"]);
  document.getElementById("field-aversions").value = aversions.join(", ");

  // Store current user ID in form for submission handler
  form.dataset.userId = userId;

  // Show modal
  modal.classList.add("open");
}

/**
 * Close the edit modal.
 */
function closeEditModal() {
  const modal = document.getElementById("modal-edit-profile");
  modal.classList.remove("open");
}

/**
 * Save edited profile data. Stores to localStorage and updates in-memory state.
 * @param {string} userId - Lowercase user ID
 * @param {Object} formData - Form field data
 */
function saveProfileData(userId, formData) {
  // Convert comma-separated strings to JSON arrays
  const cuisines = (formData["Cuisines_JSON"] || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
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
    Taille_cm: formData["Taille_cm"],
    Poids_kg: formData["Poids_kg"],
    Âge: formData["Âge"],
    Activité: formData["Activité"],
    Objectif: formData["Objectif"],
    Régime: formData["Régime"],
    Niveau_culinaire: formData["Niveau_culinaire"],
    Durée_max_prep: formData["Durée_max_prep"],
    Cuisines_JSON: JSON.stringify(cuisines),
    Allergies_JSON: JSON.stringify(allergies),
    Aversions_JSON: JSON.stringify(aversions)
  };

  // Save to localStorage
  localStorage.setItem(`mealflow_profile_${userId}`, JSON.stringify(updatedProfile));

  // Update in-memory state
  profilesData[userId] = updatedProfile;

  console.log(`Profile saved for user: ${userId}`);
}

/**
 * Load profile data from localStorage if available, otherwise use Sheets data.
 * Call this during initialization to merge localStorage overrides.
 */
function loadProfileOverrides() {
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

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Set up modal event handlers (close button, cancel, form submission, overlay click).
 */
function setupModalHandlers() {
  const modal = document.getElementById("modal-edit-profile");
  const form = document.getElementById("edit-profile-form");
  const closeBtn = document.querySelector(".modal-close");
  const cancelBtn = document.getElementById("btn-cancel");

  if (!modal || !form) return;

  // Close button (X)
  if (closeBtn) {
    closeBtn.addEventListener("click", closeEditModal);
  }

  // Cancel button
  if (cancelBtn) {
    cancelBtn.addEventListener("click", function(e) {
      e.preventDefault();
      closeEditModal();
    });
  }

  // Overlay click (close on backdrop)
  modal.addEventListener("click", function(e) {
    if (e.target === modal) {
      closeEditModal();
    }
  });

  // Form submission
  form.addEventListener("submit", function(e) {
    e.preventDefault();

    const userId = form.dataset.userId;
    if (!userId) {
      console.error("Form user ID not set");
      return;
    }

    // Collect form data
    const formData = {
      "Taille_cm": document.getElementById("field-taille").value,
      "Poids_kg": document.getElementById("field-poids").value,
      "Âge": document.getElementById("field-age").value,
      "Activité": document.getElementById("field-activite").value,
      "Objectif": document.getElementById("field-objectif").value,
      "Régime": document.getElementById("field-regime").value,
      "Niveau_culinaire": document.getElementById("field-niveau").value,
      "Durée_max_prep": document.getElementById("field-duree").value,
      "Cuisines_JSON": document.getElementById("field-cuisines").value,
      "Allergies_JSON": document.getElementById("field-allergies").value,
      "Aversions_JSON": document.getElementById("field-aversions").value
    };

    // Validate required fields
    if (!formData["Taille_cm"] || !formData["Poids_kg"] || !formData["Âge"] ||
        !formData["Activité"] || !formData["Objectif"]) {
      alert("Veuillez remplir tous les champs obligatoires.");
      return;
    }

    // Save data
    saveProfileData(userId, formData);

    // Close modal
    closeEditModal();

    // Re-render profiles
    const container = document.getElementById("profiles-container");
    container.innerHTML = "";
    const orderedUsers = ["florian", "naomi"];
    orderedUsers.forEach(u => {
      if (profilesData[u]) {
        const card = renderProfileCard(u);
        if (card) {
          container.appendChild(card);
        }
      }
    });

    // Show success feedback
    const prenom = profilesData[userId]["Prénom"] || userId;
    console.log(`Profil de ${prenom} enregistré avec succès.`);
  });
}

/**
 * Main entry point: load data, render both profile cards.
 */
async function initializeProfiles() {
  const container = document.getElementById("profiles-container");
  if (!container) {
    console.error("Profils: #profiles-container not found in DOM");
    return;
  }

  // Show loading state
  const loadingEl = document.createElement("p");
  loadingEl.className = "profiles-loading";
  loadingEl.textContent = "Chargement des profils…";
  container.appendChild(loadingEl);

  try {
    await loadProfiles();
  } catch (err) {
    console.error("Profils: unexpected error during load:", err);
    useFallbackProfiles();
  }

  // Load any localStorage overrides
  loadProfileOverrides();

  // Clear loading indicator
  container.innerHTML = "";

  if (Object.keys(profilesData).length === 0) {
    const errorEl = document.createElement("p");
    errorEl.className = "profiles-error";
    errorEl.textContent = "Aucun profil disponible. Vérifiez la configuration des données.";
    container.appendChild(errorEl);
    return;
  }

  // Render each known user in order: florian first, then naomi
  const orderedUsers = ["florian", "naomi"];
  orderedUsers.forEach(userId => {
    if (profilesData[userId]) {
      const card = renderProfileCard(userId);
      if (card) {
        container.appendChild(card);
      }
    }
  });

  // Render any remaining users not already handled above
  Object.keys(profilesData).forEach(userId => {
    if (!orderedUsers.includes(userId)) {
      const card = renderProfileCard(userId);
      if (card) {
        container.appendChild(card);
      }
    }
  });
}

// ============================================================================
// BOOT
// ============================================================================

document.addEventListener("DOMContentLoaded", function() {
  // Apply user-specific background tint (Florian = pink, Naomi = purple)
  if (window.UserContext) {
    UserContext.applyUserStyling();
    UserContext.initializeUserToggle();
  }

  setupModalHandlers();
  initializeProfiles();
});
