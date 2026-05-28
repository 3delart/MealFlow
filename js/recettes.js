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
    rows.slice(1).forEach(row => {
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
        kcal_per_100: parseFloat(row[7]) || 0
      };
    });

    window.recipesData = recipesData;
    console.log("Recipes loaded from Recettes:", Object.keys(recipesData).length, "recipes");
  } catch (err) {
    console.warn("Recettes: Sheets API unavailable, falling back to localStorage", err.message);
    loadRecipesFromLocalStorage();
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
      console.log("Recipes loaded from localStorage:", Object.keys(recipesData).length, "recipes");
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
  localStorage.setItem("mealflow_recipes", JSON.stringify(recipesData));
}

/**
 * Sync recipes to Google Sheets (Recettes tab, one row per recipe)
 * Clears existing data rows and re-appends all recipes
 * @returns {Promise<void>}
 */
async function syncRecipesToSheets() {
  if (!window.SheetsAPI) {
    console.warn("SheetsAPI not available, skipping Sheets sync");
    saveRecipesToLocalStorage();
    return;
  }

  try {
    const token = window.getAccessToken ? window.getAccessToken() : null;
    if (!token) {
      console.warn("No OAuth token, skipping Sheets sync");
      saveRecipesToLocalStorage();
      return;
    }

    // Clear existing data rows (keep header)
    await window.SheetsAPI.clearSheetRange("Recettes!A2:H1000", token);

    // Append one row per recipe
    for (const recipe of Object.values(recipesData)) {
      const cals = calculateRecipeCalories(recipe.ingredients || []);
      const row = [
        recipe.name,
        recipe.description || "",
        recipe.prep_minutes || 0,
        recipe.cook_minutes || 0,
        (recipe.tags || []).join(", "),
        JSON.stringify(recipe.ingredients || []),
        JSON.stringify(recipe.steps || []),
        cals.kcal_per_100
      ];
      await window.SheetsAPI.appendRowWithToken("Recettes", row, token);
    }

    console.log("Recipes synced to Recettes sheet");
  } catch (err) {
    console.error("Failed to sync recipes to Sheets:", err);
    saveRecipesToLocalStorage();
  }
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
  deleteBtn.addEventListener("click", () => {
    if (confirm("Confirmer la suppression de cette recette ?")) {
      delete recipesData[recipeID];
      syncRecipesToSheets();
      renderRecipeList();
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
function renderRecipeList() {
  const container = document.getElementById("recipes-container");
  if (!container) return;

  container.innerHTML = "";

  if (Object.keys(recipesData).length === 0) {
    const empty = document.createElement("p");
    empty.style.textAlign = "center";
    empty.style.color = "#999";
    empty.textContent = "Aucune recette. Créez la première!";
    container.appendChild(empty);
    return;
  }

  Object.entries(recipesData).forEach(([id, recipe]) => {
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
function openViewModal(recipeID) {
  const recipe = recipesData[recipeID];
  if (!recipe) return;

  const modal = document.getElementById("modal-recipe-view");
  const title = document.getElementById("modal-view-title");
  const content = document.getElementById("recipe-view-content");

  title.textContent = recipe.name;

  const cals = calculateRecipeCalories(recipe.ingredients || []);

  const html = `
    <p style="color: #999; margin-bottom: 16px;">${recipe.description || ""}</p>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
      <div>⏱️ <strong>Préparation:</strong> ${recipe.prep_minutes || 0}m</div>
      <div>🍳 <strong>Cuisson:</strong> ${recipe.cook_minutes || 0}m</div>
      <div>🔥 <strong>Calories total:</strong> ${cals.total_kcal} kcal</div>
      <div>🔥 <strong>Par 100g:</strong> ${cals.kcal_per_100} kcal</div>
    </div>

    <h3 style="margin-top: 16px; color: var(--color-primary, #2e7d32);">INGRÉDIENTS</h3>
    <ul style="margin-left: 16px; line-height: 1.8;">
      ${(recipe.ingredients || [])
        .map(ing => {
          const ingCals = Math.round((parseFloat(ing.calories_per_100) || 0) * (parseFloat(ing.quantity) || 0) / 100);
          return `<li>${ing.name}: ${ing.quantity} ${ing.unit} (${ingCals} kcal)</li>`;
        })
        .join("")}
    </ul>

    <h3 style="margin-top: 16px; color: var(--color-primary, #2e7d32);">ÉTAPES</h3>
    <ol style="margin-left: 16px; line-height: 1.8;">
      ${(recipe.steps || [])
        .map(step => `<li>${step}</li>`)
        .join("")}
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
 * Initialize recipes page
 * Sets up modal handlers, loads data, renders recipe list
 * @returns {Promise<void>}
 */
async function initializeRecipes() {
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

  // Add recipe button
  const addBtn = document.getElementById("btn-add-recipe");
  if (addBtn) {
    addBtn.addEventListener("click", openCreateModal);
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

document.addEventListener("DOMContentLoaded", initializeRecipes);
