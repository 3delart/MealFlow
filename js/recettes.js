/**
 * @fileoverview Recettes (recipes) page logic for MealFlow
 * Loads recipes from Google Sheets, renders recipe cards, manages modals,
 * and syncs recipe data back to Sheets
 */

// ============================================================================
// MODULE STATE
// ============================================================================

/** @type {Object.<string, Object>} Recipes keyed by recipe ID (lowercase slug) */
let recipesData = {};
window.recipesData = recipesData;  // Expose globally for forms

/** @type {boolean} True only when recipesData was successfully loaded from Sheets */
let recipesLoadedFromSheets = false;

/** @type {string[]} Normalized allergies of the currently active profile */
let activeAllergies = [];
/** @type {string[]} Normalized aversions (disliked products) of the active profile */
let activeAversions = [];
/** @type {string} Normalized dietary regime of the active profile (e.g. "vegetarien") */
let activeRegime = "";

/**
 * Load the active profile's allergies and dietary regime from the Profils sheet.
 * Used to flag allergen / non-compliant ingredients in the recipe view.
 */
async function loadActiveAllergies() {
  activeAllergies = [];
  activeAversions = [];
  activeRegime = "";
  try {
    const user = window.UserContext ? UserContext.getCurrentUser() : 'florian';
    const rows = await SheetsAPI.readSheetTab("Profils");
    const profile = SheetsAPI.rowsToObjects(rows)
      .find(p => (p.User || '').toLowerCase() === user);
    if (profile) {
      const allergies = safeParseJSON(profile.Allergies_JSON, []);
      activeAllergies = (Array.isArray(allergies) ? allergies : [])
        .map(Utils.normalizeString)
        .filter(Boolean);
      const aversions = safeParseJSON(profile.Aversions_JSON, []);
      activeAversions = (Array.isArray(aversions) ? aversions : [])
        .map(Utils.normalizeString)
        .filter(Boolean);
      activeRegime = Utils.normalizeString(profile.Régime || profile["Régime"] || "");
    }
  } catch (err) {
    console.warn("Could not load profile diet info:", err);
  }
}

/**
 * Return the active aversions an ingredient matches (by product name).
 * @param {Object} ing - Recipe ingredient
 * @returns {string[]} Matched aversion labels (normalized)
 */
function ingredientAversionHits(ing) {
  if (activeAversions.length === 0) return [];
  const n = Utils.normalizeString(ing.name);
  const concepts = classifyIngredient(ing);
  const aliases = (window.FoodConfig && window.FoodConfig.ALLERGY_ALIASES) || {};
  return activeAversions.filter(a =>
    n === a || n.includes(a) || a.includes(n) ||
    concepts.has(a) || concepts.has(aliases[a]));
}

/**
 * Classify an ingredient into food concepts (poisson, viande, porc, lait, ...).
 * Uses, in order: matching inventory item's category, its Open Food Facts allergens,
 * and a keyword dictionary on the ingredient name (covers manual entries).
 * @param {Object} ing - Recipe ingredient ({name, ...})
 * @returns {Set<string>} Set of concept tokens
 */
function classifyIngredient(ing) {
  const concepts = new Set();
  const cfg = window.FoodConfig;
  if (!cfg) return concepts;

  const normName = Utils.normalizeString(ing.name);
  const invItem = (window.inventoryData || [])
    .find(i => Utils.normalizeString(i.Produit) === normName);

  // 1. Explicit tags on the inventory product are authoritative (override auto-detection,
  //    so a misleadingly-named vegan product can be corrected once).
  if (invItem && Array.isArray(invItem.dietTags) && invItem.dietTags.length > 0) {
    invItem.dietTags.forEach(c => concepts.add(c));
    return concepts;
  }

  // 2. Otherwise auto-detect from category + OFF allergens + name keywords
  cfg.suggestDietConcepts(
    ing.name,
    invItem ? invItem.allergens : '',
    invItem ? invItem.Catégorie : ''
  ).forEach(c => concepts.add(c));

  return concepts;
}

/**
 * Return the active allergies an ingredient triggers (empty if none).
 * Matches via food concepts (so "poisson" catches "cabillaud") and raw text.
 * @param {Object} ing - Recipe ingredient
 * @returns {string[]} Matched allergy labels (normalized)
 */
function ingredientAllergyHits(ing) {
  if (activeAllergies.length === 0) return [];
  const concepts = classifyIngredient(ing);
  const aliases = (window.FoodConfig && window.FoodConfig.ALLERGY_ALIASES) || {};
  const invItem = (window.inventoryData || [])
    .find(i => Utils.normalizeString(i.Produit) === Utils.normalizeString(ing.name));
  const haystack = Utils.normalizeString(
    `${ing.name || ''} ${invItem ? (invItem.allergens || '') : ''}`
  );
  return activeAllergies.filter(a =>
    concepts.has(a) || concepts.has(aliases[a]) || haystack.includes(a));
}

/**
 * Return the dietary-regime concepts an ingredient violates (empty if none/compliant).
 * @param {Object} ing - Recipe ingredient
 * @returns {string[]} Violated concepts (e.g. ["viande"])
 */
function ingredientDietViolations(ing) {
  const cfg = window.FoodConfig;
  if (!cfg || !activeRegime) return [];
  const forbidden = cfg.DIET_RULES[activeRegime];
  if (!forbidden) return [];
  const concepts = classifyIngredient(ing);
  return forbidden.filter(c => concepts.has(c));
}

// ============================================================================
// STEP 1: DATA LOADING
// ============================================================================

/**
 * Safe JSON parse with fallback
 * @param {string} str - JSON string
 * @param {*} fallback - Value to return if parse fails
 * @returns {*}
 */
function safeParseJSON(str, fallback) {
  try {
    return str ? JSON.parse(str) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Load recipes from Recettes sheet tab (one row per recipe)
 * Falls back to localStorage if Sheets API unavailable
 * @returns {Promise<void>}
 */
async function loadRecipes() {
  try {
    const rows = await SheetsAPI.readSheetTab("Recettes");
    recipesData = {};

    // rows[0] is header row — skip it
    rows.slice(1).forEach((row, idx) => {
      const name = row[0] || "";
      if (!name) return;

      const id = generateRecipeID(name);
      recipesData[id] = {
        name: row[0] || "",
        description: row[1] || "",
        prep_minutes: parseInt(row[2]) || 0,
        cook_minutes: parseInt(row[3]) || 0,
        tags: row[4] ? row[4].split(",").map(t => t.trim()) : [],
        ingredients: safeParseJSON(row[5], []),
        steps: safeParseJSON(row[6], []),
        kcal_per_100: parseFloat(row[7]) || 0,
        portion_g: parseFloat(row[8]) || null,
        sheetRowNumber: idx + 2
      };
    });

    window.recipesData = recipesData;
    recipesLoadedFromSheets = true;
    window.recipesLoadedFromSheets = true;
  } catch (err) {
    console.error("Recettes: failed to load from Sheets:", err.message);
    throw err;
  }
}

/**
 * Load recipes from localStorage (fallback)
 * @returns {void}
 */
function loadRecipesFromLocalStorage() {
  const stored = localStorage.getItem("mealflow_recipes");
  if (stored) {
    try {
      recipesData = JSON.parse(stored);
      window.recipesData = recipesData;
    } catch (err) {
      console.error("Failed to parse localStorage recipes:", err);
      recipesData = {};
    }
  } else {
    recipesData = {};
  }
}

/**
 * Save recipes to localStorage (backup)
 * @returns {void}
 */
function saveRecipesToLocalStorage() {
  // no-op: Sheets is the source of truth
}
window.saveRecipesToLocalStorage = saveRecipesToLocalStorage;

/**
 * Sync recipes to Google Sheets (Recettes tab, one row per recipe)
 * Clears existing data rows and re-appends all recipes
 * @returns {Promise<void>}
 */
async function syncRecipesToSheets() {
  // DISABLED: All recipe writes are now targeted (batchUpdateRange per row, deleteSheetRow).
  // Disabled — all recipe writes are now targeted (batchUpdateRange/deleteSheetRow).
  saveRecipesToLocalStorage();
}

// ============================================================================
// STEP 2: RECIPE CARD RENDERING
// ============================================================================

/**
 * Render a single recipe card
 * @param {string} recipeID - Recipe ID (slug)
 * @param {Object} recipe - Recipe object with name, description, tags, prep_minutes, cook_minutes, ingredients
 * @returns {HTMLElement}
 */
function renderRecipeCard(recipeID, recipe) {
  const card = document.createElement("div");
  card.className = "recipe-card";
  card.dataset.recipeId = recipeID;

  const name = document.createElement("h3");
  name.textContent = recipe.name || recipeID;

  const desc = document.createElement("p");
  desc.textContent = recipe.description || "(sans description)";
  desc.style.fontSize = "13px";
  desc.style.color = "#999";

  const meta = document.createElement("div");
  meta.className = "recipe-card-meta";

  // Tags
  const tagSpan = document.createElement("span");
  const tags = (recipe.tags || []).join(", ");
  tagSpan.textContent = tags ? `🏷️ ${tags}` : "🏷️ (sans tags)";

  // Time
  const timeSpan = document.createElement("span");
  const prepMin = recipe.prep_minutes || 0;
  const cookMin = recipe.cook_minutes || 0;
  const totalMin = prepMin + cookMin;
  timeSpan.textContent = `⏱️ ${totalMin}m`;

  meta.appendChild(tagSpan);
  meta.appendChild(timeSpan);

  // Calories
  const cals = calculateRecipeCalories(recipe.ingredients || []);
  const calSpan = document.createElement("span");
  calSpan.textContent = `🔥 ${cals.kcal_per_100} kcal/100g`;
  meta.appendChild(calSpan);

  if (recipe.portion_g) {
    const portionKcal = Math.round(recipe.portion_g * cals.kcal_per_100 / 100);
    const portionSpan = document.createElement("span");
    portionSpan.textContent = `🍽️ Portion ${recipe.portion_g}g = ${portionKcal} kcal`;
    meta.appendChild(portionSpan);
  }

  // Buttons
  const buttons = document.createElement("div");
  buttons.className = "recipe-card-buttons";

  const viewBtn = document.createElement("button");
  viewBtn.className = "btn btn-secondary";
  viewBtn.textContent = "👁️ Voir";
  viewBtn.addEventListener("click", () => openViewModal(recipeID));

  const editBtn = document.createElement("button");
  editBtn.className = "btn btn-secondary";
  editBtn.textContent = "✏️ Éditer";
  editBtn.addEventListener("click", () => openEditModal(recipeID));

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "btn btn-danger";
  deleteBtn.textContent = "🗑️ Supprimer";
  deleteBtn.addEventListener("click", async () => {
    if (confirm("Confirmer la suppression de cette recette ?")) {
      const rowNum = recipesData[recipeID]?.sheetRowNumber;
      delete recipesData[recipeID];
      // Decrement sheetRowNumber for all recipes after the deleted row
      if (rowNum) {
        Object.values(recipesData).forEach(r => {
          if (r.sheetRowNumber > rowNum) r.sheetRowNumber--;
        });
      }
      saveRecipesToLocalStorage();
      renderRecipeList();
      if (rowNum && window.SheetsAPI && recipesLoadedFromSheets) {
        const token = window.getAccessToken ? window.getAccessToken() : null;
        if (token) {
          try { await window.SheetsAPI.deleteSheetRow('Recettes', rowNum, token); }
          catch (err) { console.error('Failed to delete recipe row:', err); }
        }
      }
    }
  });

  buttons.appendChild(viewBtn);
  buttons.appendChild(editBtn);
  buttons.appendChild(deleteBtn);

  card.appendChild(name);
  card.appendChild(desc);
  card.appendChild(meta);
  card.appendChild(buttons);

  return card;
}

/**
 * Render all recipe cards to the container
 * Populates #recipes-container with recipe cards or empty state message
 * @returns {void}
 */
/**
 * Return true if a recipe matches the current search term (name, tags, ingredients).
 * @param {Object} recipe
 * @param {string} normQuery - already-normalized search term
 */
function recipeMatchesSearch(recipe, normQuery) {
  if (!normQuery) return true;
  // Tags are filtered via badges, not the text search.
  const haystack = [
    recipe.name,
    recipe.description,
    (recipe.ingredients || []).map(i => i.name).join(" ")
  ].map(Utils.normalizeString).join(" ");
  return haystack.includes(normQuery);
}

/** @type {Set<string>} Currently active tag filters (AND semantics) */
const activeTags = new Set();

/**
 * Render clickable tag badges from all recipe tags. Active badges are highlighted.
 * Clicking toggles a tag; recipes must have ALL active tags to be shown.
 */
function renderTagBadges() {
  const container = document.getElementById("recipe-tag-badges");
  if (!container) return;

  const allTags = new Set();
  Object.values(recipesData).forEach(r => (r.tags || []).forEach(t => {
    const tag = (t || "").trim();
    if (tag) allTags.add(tag);
  }));

  container.innerHTML = "";
  [...allTags].sort((a, b) => a.localeCompare(b, 'fr')).forEach(tag => {
    const isActive = activeTags.has(tag);
    const badge = document.createElement("button");
    badge.type = "button";
    badge.textContent = `🏷️ ${tag}`;
    badge.style.cssText = `border:1px solid ${isActive ? '#2e7d32' : 'var(--color-border)'};` +
      `background:${isActive ? '#2e7d32' : '#fff'};color:${isActive ? '#fff' : '#555'};` +
      `border-radius:14px;padding:4px 10px;font-size:13px;cursor:pointer;`;
    badge.addEventListener("click", () => {
      if (activeTags.has(tag)) activeTags.delete(tag);
      else activeTags.add(tag);
      renderTagBadges();
      renderRecipeList();
    });
    container.appendChild(badge);
  });
}

/**
 * Return true if a recipe has all currently active tags (AND).
 * @param {Object} recipe
 */
function recipeMatchesTags(recipe) {
  if (activeTags.size === 0) return true;
  const tags = (recipe.tags || []).map(t => (t || "").trim());
  return [...activeTags].every(t => tags.includes(t));
}

/**
 * Return true if every ingredient of a recipe is currently in stock (qty > 0).
 * @param {Object} recipe
 */
function recipeIsMakeable(recipe) {
  const ings = recipe.ingredients || [];
  if (ings.length === 0) return false;
  const inv = window.inventoryData || [];
  return ings.every(ing => {
    const n = Utils.normalizeString(ing.name);
    return inv.some(i => {
      if ((parseFloat(i.Qty) || 0) <= 0) return false;
      const p = Utils.normalizeString(i.Produit);
      return p === n || p.includes(n) || n.includes(p);
    });
  });
}

function renderRecipeList() {
  const container = document.getElementById("recipes-container");
  if (!container) return;

  renderTagBadges();
  container.innerHTML = "";

  const entries = Object.entries(recipesData);

  if (entries.length === 0) {
    const empty = document.createElement("p");
    empty.style.textAlign = "center";
    empty.style.color = "#999";
    empty.textContent = "Aucune recette. Créez la première!";
    container.appendChild(empty);
    return;
  }

  const searchEl = document.getElementById("recipe-search");
  const normQuery = Utils.normalizeString(searchEl ? searchEl.value : "");
  const makeableOnly = document.getElementById("recipe-makeable-filter")?.checked;
  const visible = entries.filter(([, recipe]) =>
    recipeMatchesSearch(recipe, normQuery) &&
    recipeMatchesTags(recipe) &&
    (!makeableOnly || recipeIsMakeable(recipe)));

  if (visible.length === 0) {
    const empty = document.createElement("p");
    empty.style.textAlign = "center";
    empty.style.color = "#999";
    empty.textContent = "Aucune recette ne correspond à la recherche.";
    container.appendChild(empty);
    return;
  }

  visible.forEach(([id, recipe]) => {
    const card = renderRecipeCard(id, recipe);
    container.appendChild(card);
  });
}

// ============================================================================
// STEP 3: MODAL TRIGGER FUNCTIONS
// ============================================================================

/**
 * Open view modal (read-only, cook mode)
 * Displays recipe details: description, timing, calories, ingredients, steps
 * @param {string} recipeID - Recipe ID
 * @returns {void}
 */
function openViewModal(recipeID, portions = 1) {
  const recipe = recipesData[recipeID];
  if (!recipe) return;

  const modal = document.getElementById("modal-recipe-view");
  const title = document.getElementById("modal-view-title");
  const content = document.getElementById("recipe-view-content");
  const p = Math.max(1, parseInt(portions) || 1);

  title.textContent = p > 1 ? `${recipe.name} ×${p}` : recipe.name;

  const cals = calculateRecipeCalories(recipe.ingredients || []);
  const totalKcal = Math.round(cals.total_kcal * p);

  // Allergy + dietary-regime + aversion checks against the active profile
  const allHits = new Set();
  const dietHits = new Set();
  const aversionHits = new Set();
  (recipe.ingredients || []).forEach(ing => {
    ingredientAllergyHits(ing).forEach(h => allHits.add(h));
    ingredientDietViolations(ing).forEach(h => dietHits.add(h));
    ingredientAversionHits(ing).forEach(h => aversionHits.add(h));
  });
  const allergyLine = allHits.size > 0
    ? `<div>⚠️ <strong>Allergènes pour ce profil :</strong> ${Utils.escapeHTML([...allHits].join(', '))}</div>`
    : '';
  const dietLine = dietHits.size > 0
    ? `<div>🥗 <strong>Incompatible ${Utils.escapeHTML(activeRegime)} :</strong> contient ${Utils.escapeHTML([...dietHits].join(', '))}</div>`
    : '';
  const dangerBanner = (allergyLine || dietLine)
    ? `<div style="background:#ffebee;border:1px solid #ef9a9a;color:#c62828;padding:8px 12px;border-radius:6px;margin-bottom:12px;font-size:0.9em;">
         ${allergyLine}${dietLine}
       </div>`
    : '';
  const aversionBanner = aversionHits.size > 0
    ? `<div style="background:#fff3e0;border:1px solid #ffb74d;color:#e65100;padding:8px 12px;border-radius:6px;margin-bottom:12px;font-size:0.9em;">
         👎 <strong>Aversion :</strong> contient ${Utils.escapeHTML([...aversionHits].join(', '))}
       </div>`
    : '';
  const allergyBanner = dangerBanner + aversionBanner;

  const html = `
    ${allergyBanner}
    <p style="color: #999; margin-bottom: 16px;">${Utils.escapeHTML(recipe.description || "")}</p>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
      <div>⏱️ <strong>Préparation:</strong> ${recipe.prep_minutes || 0}m</div>
      <div>🍳 <strong>Cuisson:</strong> ${recipe.cook_minutes || 0}m</div>
      <div>🔥 <strong>Calories total:</strong> ${totalKcal} kcal${p > 1 ? ` (${p}×${cals.total_kcal})` : ''}</div>
      <div>🔥 <strong>Par 100g:</strong> ${cals.kcal_per_100} kcal</div>
      ${recipe.portion_g ? `<div>🍽️ <strong>Portion:</strong> ${recipe.portion_g * p}g = ${Math.round(recipe.portion_g * p * cals.kcal_per_100 / 100)} kcal</div>` : ''}
    </div>

    <h3 style="margin-top: 16px; color: var(--color-primary, #2e7d32);">INGRÉDIENTS${p > 1 ? ` (×${p} portions)` : ''}</h3>
    <ul style="margin-left: 16px; line-height: 1.8;">
      ${(recipe.ingredients || [])
        .map(ing => {
          const qty = ((parseFloat(ing.quantity) || 0) * p);
          const ingCals = Math.round((parseFloat(ing.calories_per_100) || 0) * qty / 100);
          const dangerHits = [...ingredientAllergyHits(ing), ...ingredientDietViolations(ing)];
          const aversHits = ingredientAversionHits(ing);
          const warn = dangerHits.length
            ? ` <span style="color:#c62828;font-weight:bold;" title="${Utils.escapeHTML([...new Set(dangerHits)].join(', '))}">⚠️</span>`
            : '';
          const avers = aversHits.length
            ? ` <span style="color:#e65100;" title="Aversion : ${Utils.escapeHTML(aversHits.join(', '))}">👎</span>`
            : '';
          return `<li>${Utils.escapeHTML(ing.name)}: ${qty % 1 === 0 ? qty : qty.toFixed(1)} ${Utils.escapeHTML(ing.unit)} (${ingCals} kcal)${warn}${avers}</li>`;
        })
        .join("")}
    </ul>

    <h3 style="margin-top: 16px; color: var(--color-primary, #2e7d32);">ÉTAPES</h3>
    <ol style="margin-left: 16px; line-height: 1.8;">
      ${(recipe.steps || []).map(step => `<li>${Utils.escapeHTML(step)}</li>`).join("")}
    </ol>
  `;

  content.innerHTML = html;
  modal.classList.add("open");
}

/**
 * Close view modal
 * @returns {void}
 */
function closeViewModal() {
  const modal = document.getElementById("modal-recipe-view");
  modal.classList.remove("open");
}

/**
 * Open create modal (delegated to recettes-forms.js)
 * Handled by a separate module to avoid coupling
 * @returns {void}
 */
function openCreateModal() {
  // Delegated to recettes-forms.js
  if (window.RecipeForms && window.RecipeForms.openCreateModal) {
    window.RecipeForms.openCreateModal();
  }
}

/**
 * Open edit modal (delegated to recettes-forms.js)
 * Handled by a separate module to avoid coupling
 * @param {string} recipeID - Recipe ID to edit
 * @returns {void}
 */
function openEditModal(recipeID) {
  // Delegated to recettes-forms.js
  if (window.RecipeForms && window.RecipeForms.openEditModal) {
    window.RecipeForms.openEditModal(recipeID);
  }
}

// ============================================================================
// STEP 4: INITIALIZATION
// ============================================================================

/**
 * Setup modal close handlers (used on all pages)
 */
function setupModalHandlers() {
  // Load modal close handlers
  document.querySelectorAll(".modal-close").forEach(btn => {
    btn.addEventListener("click", function() {
      this.closest(".modal").classList.remove("open");
    });
  });

  // Close on backdrop click
  document.querySelectorAll(".modal").forEach(modal => {
    modal.addEventListener("click", function(e) {
      if (e.target === this) {
        this.classList.remove("open");
      }
    });
  });
}

/**
 * Initialize recipes page
 * Sets up modal handlers, loads data, renders recipe list
 * @returns {Promise<void>}
 */
async function initializeRecipes() {
  setupModalHandlers();

  // Add recipe button
  const addBtn = document.getElementById("btn-add-recipe");
  if (addBtn) {
    addBtn.addEventListener("click", openCreateModal);
  }

  // Live recipe search (debounced)
  const searchEl = document.getElementById("recipe-search");
  if (searchEl) {
    searchEl.addEventListener("input", Utils.debounce(renderRecipeList, 150));
  }
  const makeableEl = document.getElementById("recipe-makeable-filter");
  if (makeableEl) {
    makeableEl.addEventListener("change", renderRecipeList);
  }

  // Load and render
  const container = document.getElementById("recipes-container");
  if (!container) {
    console.error("recipes-container not found");
    return;
  }

  const loading = document.createElement("p");
  loading.textContent = "Chargement des recettes…";
  loading.style.textAlign = "center";
  container.appendChild(loading);

  try {
    await loadRecipes();
    if (window.loadConversionFactors) await window.loadConversionFactors();
    await loadActiveAllergies();
  } catch (err) {
    console.error("Failed to load recipes:", err);
  }

  renderRecipeList();

  // Apply user styling if available
  if (window.UserContext) {
    UserContext.applyUserStyling();
    UserContext.initializeUserToggle();
  }
}

// ============================================================================
// STEP 5: BOOT
// ============================================================================

// Only initialize recipes UI if on recettes.html (has recipes-container)
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("recipes-container")) {
    initializeRecipes();
  }
});
