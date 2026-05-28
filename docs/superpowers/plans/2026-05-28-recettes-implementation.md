# Recipes Page (Recettes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build recipes page (CRUD, auto-calorie calc, Sheets sync) following existing MealFlow patterns.

**Architecture:** Three-file modular design—`recettes.html` (structure), `recettes.js` (data/list logic), `recettes-forms.js` (modals/forms). Load recipes from `RecettesJSON!A1` on startup, render card list, sync mutations back to Sheets.

**Tech Stack:** Vanilla JS, Google Sheets API (read/write), DOM APIs, localStorage fallback.

---

## File Structure

```
recettes.html               ← Page structure + modals HTML
js/recettes.js              ← Core: load, render, sync
js/recettes-forms.js        ← Modal logic: create/edit/view forms
js/recettes-utils.js        ← Helper: calorie calc, recipe ID generation
```

---

## Task 1: Create recettes.html

**Files:**
- Create: `recettes.html`

- [ ] **Step 1: Create HTML skeleton**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recettes — MealFlow</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <nav id="navbar">
    <!-- Navbar from existing pages -->
  </nav>

  <main id="main-content" class="container">
    <header class="page-header">
      <h1>Recettes</h1>
      <button id="btn-add-recipe" class="btn btn-primary" style="position: absolute; top: 20px; right: 20px;">
        ➕ Ajouter recette
      </button>
    </header>

    <div id="recipes-container" class="recipes-list">
      <!-- Recipe cards inserted here -->
    </div>
  </main>

  <!-- Create/Edit Modal -->
  <div id="modal-recipe-form" class="modal">
    <div class="modal-content">
      <div class="modal-header">
        <h2 id="modal-form-title">Nouvelle recette</h2>
        <button class="modal-close">✕</button>
      </div>
      <form id="recipe-form">
        <!-- Form fields filled in Task 2 -->
      </form>
    </div>
  </div>

  <!-- View Modal (Read-only) -->
  <div id="modal-recipe-view" class="modal">
    <div class="modal-content">
      <div class="modal-header">
        <h2 id="modal-view-title">Recette</h2>
        <button class="modal-close">✕</button>
      </div>
      <div id="recipe-view-content">
        <!-- Recipe details inserted here -->
      </div>
    </div>
  </div>

  <!-- Scripts -->
  <script src="js/sheets-api.js"></script>
  <script src="js/utils.js"></script>
  <script src="js/user-context.js"></script>
  <script src="js/inventory.js"></script>
  <script src="js/recettes-utils.js"></script>
  <script src="js/recettes.js"></script>
  <script src="js/recettes-forms.js"></script>
</body>
</html>
```

- [ ] **Step 2: Add CSS for recipe cards and modals**

Append to `css/style.css`:

```css
/* Recipe Cards */
.recipes-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
  margin-top: 20px;
}

.recipe-card {
  background: var(--card-bg, #1a2332);
  border: 1px solid var(--border-color, #2e7d32);
  border-radius: 8px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.recipe-card:hover {
  background: var(--card-hover, #242f3f);
  border-color: var(--primary, #2e7d32);
}

.recipe-card h3 {
  margin: 0 0 8px 0;
  color: var(--primary, #2e7d32);
  font-size: 18px;
}

.recipe-card p {
  margin: 4px 0;
  color: #999;
  font-size: 14px;
}

.recipe-card-meta {
  display: flex;
  gap: 12px;
  margin: 12px 0;
  font-size: 13px;
}

.recipe-card-meta span {
  display: flex;
  align-items: center;
  gap: 4px;
}

.recipe-card-buttons {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.recipe-card-buttons button {
  flex: 1;
  padding: 8px;
  font-size: 13px;
}

/* Modal form styles */
#recipe-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

#recipe-form label {
  display: block;
  font-weight: bold;
  margin-bottom: 4px;
  font-size: 14px;
}

#recipe-form input,
#recipe-form textarea,
#recipe-form select {
  width: 100%;
  padding: 8px;
  border: 1px solid var(--border-color, #333);
  background: var(--input-bg, #0f1820);
  color: #fff;
  border-radius: 4px;
  font-size: 14px;
  font-family: inherit;
}

#recipe-form textarea {
  resize: vertical;
  min-height: 80px;
}

/* Ingredients table */
.ingredients-table {
  width: 100%;
  border-collapse: collapse;
  margin: 8px 0;
  font-size: 13px;
}

.ingredients-table th,
.ingredients-table td {
  padding: 8px;
  border: 1px solid var(--border-color, #333);
  text-align: left;
}

.ingredients-table th {
  background: var(--header-bg, #1a2332);
  font-weight: bold;
}

.ingredients-table input {
  width: 100%;
  padding: 4px;
  border: 1px solid var(--border-color, #333);
  background: var(--input-bg, #0f1820);
  color: #fff;
}

.ingredients-table button {
  padding: 4px 8px;
  font-size: 12px;
}

/* Steps list */
.steps-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 8px 0;
}

.step-row {
  display: flex;
  gap: 8px;
}

.step-row input {
  flex: 1;
}

.step-row button {
  padding: 4px 8px;
  font-size: 12px;
}

/* Calorie display */
.calorie-summary {
  background: var(--header-bg, #1a2332);
  padding: 12px;
  border-radius: 4px;
  border-left: 3px solid var(--primary, #2e7d32);
  font-size: 14px;
  margin: 8px 0;
}

.calorie-summary strong {
  color: var(--primary, #2e7d32);
}
```

- [ ] **Step 3: Check navigation (add link to recettes from navbar)**

Check `index.html` (or main page navigation) and add link to `recettes.html` if it exists. If navbar is dynamic, task will be handled in later steps.

- [ ] **Step 4: Commit**

```bash
git add recettes.html css/style.css
git commit -m "feat: create recettes.html skeleton with modals and styles"
```

---

## Task 2: Create recettes-utils.js (Helpers)

**Files:**
- Create: `js/recettes-utils.js`

- [ ] **Step 1: Write recipe ID generation function**

```javascript
/**
 * Generate a URL-safe recipe ID from recipe name
 * @param {string} name - Recipe name
 * @returns {string} Lowercase slug (e.g., "Pâtes carbonara" → "pates_carbonara")
 */
function generateRecipeID(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[àâä]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[ïî]/g, 'i')
    .replace(/[ôö]/g, 'o')
    .replace(/[ùûü]/g, 'u')
    .replace(/[ç]/g, 'c')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}
```

- [ ] **Step 2: Write calorie calculator**

```javascript
/**
 * Calculate total calories and per 100g for a recipe
 * @param {Object[]} ingredients - Array of {name, quantity, unit, calories_per_100}
 * @returns {Object} {total_kcal, total_weight_grams, kcal_per_100}
 */
function calculateRecipeCalories(ingredients) {
  let totalKcal = 0;
  let totalWeightGrams = 0;

  ingredients.forEach(ing => {
    const qty = parseFloat(ing.quantity) || 0;
    const cal100 = parseFloat(ing.calories_per_100) || 0;
    const unit = ing.unit || 'g';

    // Convert to grams if needed
    let qtyGrams = qty;
    if (unit === 'ml' || unit === 'l') {
      qtyGrams = qty; // Assume 1ml ≈ 1g for liquids
    } else if (unit === 'litre') {
      qtyGrams = qty * 1000;
    } else if (unit === 'pièce' || unit === 'piece') {
      qtyGrams = 0; // Can't convert, skip from total weight
    }

    totalWeightGrams += qtyGrams;
    totalKcal += cal100 * (qty / 100);
  });

  const kcalPer100 = totalWeightGrams > 0 ? totalKcal / (totalWeightGrams / 100) : 0;

  return {
    total_kcal: Math.round(totalKcal),
    total_weight_grams: Math.round(totalWeightGrams),
    kcal_per_100: Math.round(kcalPer100)
  };
}
```

- [ ] **Step 3: Write ingredient autocomplete helper**

```javascript
/**
 * Search inventory for matching products
 * @param {string} query - Search query
 * @returns {Object[]} Matching items [{name, calories_per_100, ...}]
 */
function searchInventoryProducts(query) {
  if (!query || query.length < 2) return [];
  if (!window.inventoryData) return [];

  const q = query.toLowerCase();
  return window.inventoryData
    .filter(item => {
      const prodName = (item.Produit || '').toLowerCase();
      return prodName.includes(q) && parseFloat(item.Qty) > 0;
    })
    .map(item => ({
      name: item.Produit,
      calories_per_100: parseFloat(item.calories_per_100) || 0,
      unit: item.Unité || 'g'
    }))
    .slice(0, 10); // Top 10 results
}
```

- [ ] **Step 4: Commit**

```bash
git add js/recettes-utils.js
git commit -m "feat: add recipe utils (ID gen, calorie calc, inventory search)"
```

---

## Task 3: Create recettes.js (Core Logic)

**Files:**
- Create: `js/recettes.js`

- [ ] **Step 1: Write data loading function**

```javascript
/**
 * Load recipes from RecettesJSON!A1 sheet tab
 * Falls back to localStorage if Sheets API unavailable
 */
async function loadRecipes() {
  try {
    const rows = await SheetsAPI.readSheetTab("RecettesJSON");
    if (rows.length === 0) {
      console.warn("RecettesJSON tab is empty");
      recipesData = {};
      return;
    }

    const jsonStr = rows[0][0] || "{}";
    recipesData = JSON.parse(jsonStr);
    console.log("Recipes loaded from Sheets:", Object.keys(recipesData).length, "recipes");
  } catch (err) {
    console.warn("RecettesJSON: Sheets API unavailable, falling back to localStorage", err.message);
    loadRecipesFromLocalStorage();
  }
}

/**
 * Load recipes from localStorage (fallback)
 */
function loadRecipesFromLocalStorage() {
  const stored = localStorage.getItem("mealflow_recipes");
  if (stored) {
    try {
      recipesData = JSON.parse(stored);
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
 */
function saveRecipesToLocalStorage() {
  localStorage.setItem("mealflow_recipes", JSON.stringify(recipesData));
}

/**
 * Sync recipes to Google Sheets
 */
async function syncRecipesToSheets() {
  if (!window.SheetsAPI) {
    console.warn("SheetsAPI not available, skipping Sheets sync");
    return;
  }

  try {
    const token = window.getAccessToken ? window.getAccessToken() : null;
    if (!token) {
      console.warn("No OAuth token, skipping Sheets sync");
      saveRecipesToLocalStorage();
      return;
    }

    const jsonStr = JSON.stringify(recipesData);
    await window.SheetsAPI.updateSheetCell("RecettesJSON!A1", jsonStr, token);
    console.log("Recipes synced to Sheets");
  } catch (err) {
    console.error("Failed to sync recipes to Sheets:", err);
    saveRecipesToLocalStorage();
  }
}

// Global recipe state
let recipesData = {};
```

- [ ] **Step 2: Write recipe card rendering**

```javascript
/**
 * Render a single recipe card
 * @param {string} recipeID - Recipe ID
 * @param {Object} recipe - Recipe object
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

  buttons.appendChild(viewBtn);
  buttons.appendChild(editBtn);

  card.appendChild(name);
  card.appendChild(desc);
  card.appendChild(meta);
  card.appendChild(buttons);

  return card;
}

/**
 * Render all recipe cards to the container
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
```

- [ ] **Step 3: Write modal trigger functions**

```javascript
/**
 * Open view modal (read-only, cook mode)
 * @param {string} recipeID
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

    <h3 style="margin-top: 16px; color: var(--primary, #2e7d32);">INGRÉDIENTS</h3>
    <ul style="margin-left: 16px; line-height: 1.8;">
      ${(recipe.ingredients || [])
        .map(ing => {
          const ingCals = Math.round((parseFloat(ing.calories_per_100) || 0) * (parseFloat(ing.quantity) || 0) / 100);
          return `<li>${ing.name}: ${ing.quantity} ${ing.unit} (${ingCals} kcal)</li>`;
        })
        .join("")}
    </ul>

    <h3 style="margin-top: 16px; color: var(--primary, #2e7d32);">ÉTAPES</h3>
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
 */
function closeViewModal() {
  const modal = document.getElementById("modal-recipe-view");
  modal.classList.remove("open");
}

/**
 * Open create modal (handled by recettes-forms.js)
 */
function openCreateModal() {
  // Delegated to recettes-forms.js
  if (window.RecipeForms && window.RecipeForms.openCreateModal) {
    window.RecipeForms.openCreateModal();
  }
}

/**
 * Open edit modal (handled by recettes-forms.js)
 */
function openEditModal(recipeID) {
  // Delegated to recettes-forms.js
  if (window.RecipeForms && window.RecipeForms.openEditModal) {
    window.RecipeForms.openEditModal(recipeID);
  }
}
```

- [ ] **Step 4: Write initialization**

```javascript
/**
 * Initialize recipes page
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

// Boot
document.addEventListener("DOMContentLoaded", initializeRecipes);
```

- [ ] **Step 5: Commit**

```bash
git add js/recettes.js
git commit -m "feat: add recettes.js with load, render, sync, modal handlers"
```

---

## Task 4: Create recettes-forms.js (Form Logic)

**Files:**
- Create: `js/recettes-forms.js`

- [ ] **Step 1: Build HTML form template for modal**

Update `recettes.html` `<form id="recipe-form">` section:

```html
<form id="recipe-form">
  <!-- Name -->
  <div>
    <label for="field-recipe-name">Nom de la recette *</label>
    <input type="text" id="field-recipe-name" required placeholder="Pâtes carbonara">
  </div>

  <!-- Description -->
  <div>
    <label for="field-description">Description</label>
    <textarea id="field-description" placeholder="Une recette délicieuse..."></textarea>
  </div>

  <!-- Times -->
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
    <div>
      <label for="field-prep-min">Préparation (min) *</label>
      <input type="number" id="field-prep-min" required min="0" value="15">
    </div>
    <div>
      <label for="field-cook-min">Cuisson (min) *</label>
      <input type="number" id="field-cook-min" required min="0" value="20">
    </div>
  </div>

  <!-- Tags -->
  <div>
    <label for="field-tags">Tags (séparés par virgule)</label>
    <input type="text" id="field-tags" placeholder="italien, rapide, végétarien">
  </div>

  <!-- Ingredients -->
  <div>
    <label>Ingrédients *</label>
    <table class="ingredients-table">
      <thead>
        <tr>
          <th>Produit</th>
          <th>Quantité</th>
          <th>Unité</th>
          <th>Cal/100</th>
          <th></th>
        </tr>
      </thead>
      <tbody id="ingredients-tbody">
        <!-- Rows added dynamically -->
      </tbody>
    </table>
    <button type="button" id="btn-add-ingredient" class="btn btn-secondary">
      ➕ Ajouter ingrédient
    </button>
  </div>

  <!-- Steps -->
  <div>
    <label>Étapes *</label>
    <div class="steps-list" id="steps-list">
      <!-- Rows added dynamically -->
    </div>
    <button type="button" id="btn-add-step" class="btn btn-secondary">
      ➕ Ajouter une étape
    </button>
  </div>

  <!-- Calorie summary -->
  <div class="calorie-summary">
    <strong>🔥 Calories:</strong> <span id="calorie-total">0</span> kcal total / 
    <span id="calorie-per-100">0</span> kcal/100g
  </div>

  <!-- Buttons -->
  <div style="display: flex; gap: 12px; margin-top: 20px;">
    <button type="button" id="btn-cancel-recipe" class="btn btn-secondary">Annuler</button>
    <button type="submit" id="btn-save-recipe" class="btn btn-primary">Créer la recette</button>
  </div>
</form>
```

- [ ] **Step 2: Initialize form state & event handlers**

```javascript
// Module namespace
window.RecipeForms = {};

let currentRecipeID = null; // Track if editing or creating

/**
 * Add ingredient row to the table
 */
function addIngredientRow(productName = "", quantity = "", unit = "g", calories = 0) {
  const tbody = document.getElementById("ingredients-tbody");
  const row = document.createElement("tr");

  const productCell = document.createElement("td");
  const productInput = document.createElement("input");
  productInput.type = "text";
  productInput.value = productName;
  productInput.placeholder = "Produit";
  productInput.addEventListener("input", debounceIngredientAutocomplete);
  productCell.appendChild(productInput);

  const qtyCell = document.createElement("td");
  const qtyInput = document.createElement("input");
  qtyInput.type = "number";
  qtyInput.value = quantity;
  qtyInput.min = "0";
  qtyInput.step = "0.1";
  qtyInput.addEventListener("change", updateCalories);
  qtyCell.appendChild(qtyInput);

  const unitCell = document.createElement("td");
  const unitSelect = document.createElement("select");
  unitSelect.innerHTML = `
    <option value="g" ${unit === "g" ? "selected" : ""}>g</option>
    <option value="ml" ${unit === "ml" ? "selected" : ""}>ml</option>
    <option value="litre" ${unit === "litre" ? "selected" : ""}>litre</option>
    <option value="pièce" ${unit === "pièce" ? "selected" : ""}>pièce</option>
  `;
  unitCell.appendChild(unitSelect);

  const calCell = document.createElement("td");
  const calSpan = document.createElement("span");
  calSpan.textContent = calories;
  calCell.appendChild(calSpan);

  const deleteCell = document.createElement("td");
  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.textContent = "✕";
  deleteBtn.className = "btn btn-danger";
  deleteBtn.style.padding = "4px 8px";
  deleteBtn.addEventListener("click", function(e) {
    e.preventDefault();
    row.remove();
    updateCalories();
  });
  deleteCell.appendChild(deleteBtn);

  row.appendChild(productCell);
  row.appendChild(qtyCell);
  row.appendChild(unitCell);
  row.appendChild(calCell);
  row.appendChild(deleteCell);

  tbody.appendChild(row);
}

/**
 * Debounced ingredient autocomplete
 */
function debounceIngredientAutocomplete(e) {
  clearTimeout(debounceIngredientAutocomplete.timeout);
  debounceIngredientAutocomplete.timeout = setTimeout(() => {
    updateIngredientCalories(e.target);
  }, 300);
}

/**
 * Update ingredient calories on product selection
 */
function updateIngredientCalories(input) {
  const productName = input.value;
  const matches = searchInventoryProducts(productName);

  if (matches.length > 0) {
    const match = matches[0];
    const row = input.closest("tr");
    const calCell = row.querySelector("td:nth-child(4)");
    calCell.textContent = match.calories_per_100;
    calCell.dataset.caloriesPer100 = match.calories_per_100;

    // Store match for later
    row.dataset.caloriesPer100 = match.calories_per_100;
  }

  updateCalories();
}

/**
 * Update total calories display
 */
function updateCalories() {
  const tbody = document.getElementById("ingredients-tbody");
  const rows = tbody.querySelectorAll("tr");

  let totalKcal = 0;
  let totalWeight = 0;

  rows.forEach(row => {
    const qtyInput = row.querySelector("td:nth-child(2) input");
    const unitSelect = row.querySelector("td:nth-child(3) select");
    const calSpan = row.querySelector("td:nth-child(4)");

    const qty = parseFloat(qtyInput.value) || 0;
    const unit = unitSelect.value;
    const cal100 = parseFloat(calSpan.dataset.caloriesPer100 || calSpan.textContent) || 0;

    let qtyGrams = qty;
    if (unit === "litre") qtyGrams = qty * 1000;
    // ml ≈ g for liquids

    totalWeight += qtyGrams;
    totalKcal += cal100 * (qty / 100);
  });

  const kcalPer100 = totalWeight > 0 ? totalKcal / (totalWeight / 100) : 0;

  document.getElementById("calorie-total").textContent = Math.round(totalKcal);
  document.getElementById("calorie-per-100").textContent = Math.round(kcalPer100);
}

/**
 * Add step row
 */
function addStepRow(description = "") {
  const stepsList = document.getElementById("steps-list");
  const stepNum = stepsList.querySelectorAll(".step-row").length + 1;

  const row = document.createElement("div");
  row.className = "step-row";

  const numSpan = document.createElement("span");
  numSpan.style.fontWeight = "bold";
  numSpan.style.minWidth = "30px";
  numSpan.textContent = stepNum + ".";

  const input = document.createElement("input");
  input.type = "text";
  input.value = description;
  input.placeholder = `Étape ${stepNum}`;

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.textContent = "✕";
  deleteBtn.className = "btn btn-danger";
  deleteBtn.style.padding = "4px 8px";
  deleteBtn.addEventListener("click", function(e) {
    e.preventDefault();
    row.remove();
    // Re-number remaining steps
    renumberSteps();
  });

  row.appendChild(numSpan);
  row.appendChild(input);
  row.appendChild(deleteBtn);

  stepsList.appendChild(row);
}

/**
 * Re-number steps after deletion
 */
function renumberSteps() {
  const stepsList = document.getElementById("steps-list");
  const rows = stepsList.querySelectorAll(".step-row");
  rows.forEach((row, idx) => {
    const span = row.querySelector("span");
    span.textContent = (idx + 1) + ".";
  });
}

/**
 * Collect form data into recipe object
 */
function collectRecipeFormData() {
  const name = document.getElementById("field-recipe-name").value.trim();
  const description = document.getElementById("field-description").value.trim();
  const prepMin = parseInt(document.getElementById("field-prep-min").value) || 0;
  const cookMin = parseInt(document.getElementById("field-cook-min").value) || 0;
  const tagsStr = document.getElementById("field-tags").value.trim();

  const tags = tagsStr.length > 0 ? tagsStr.split(",").map(t => t.trim()) : [];

  // Ingredients
  const ingredients = [];
  document.querySelectorAll("#ingredients-tbody tr").forEach(row => {
    const productInput = row.querySelector("td:nth-child(1) input");
    const qtyInput = row.querySelector("td:nth-child(2) input");
    const unitSelect = row.querySelector("td:nth-child(3) select");
    const calSpan = row.querySelector("td:nth-child(4)");

    const product = productInput.value.trim();
    const qty = parseFloat(qtyInput.value) || 0;
    const unit = unitSelect.value;
    const cal100 = parseFloat(calSpan.dataset.caloriesPer100 || calSpan.textContent) || 0;

    if (product && qty > 0) {
      ingredients.push({
        name: product,
        quantity: qty,
        unit: unit,
        calories_per_100: cal100
      });
    }
  });

  // Steps
  const steps = [];
  document.querySelectorAll("#steps-list .step-row input").forEach(input => {
    const step = input.value.trim();
    if (step) steps.push(step);
  });

  return {
    name,
    description,
    prep_minutes: prepMin,
    cook_minutes: cookMin,
    tags,
    ingredients,
    steps
  };
}

/**
 * Validate form
 */
function validateRecipeForm() {
  const data = collectRecipeFormData();

  if (!data.name) {
    alert("Veuillez entrer un nom de recette.");
    return false;
  }

  if (data.ingredients.length === 0) {
    alert("Veuillez ajouter au moins un ingrédient.");
    return false;
  }

  if (data.steps.length === 0) {
    alert("Veuillez ajouter au moins une étape.");
    return false;
  }

  return true;
}

/**
 * Open create modal
 */
window.RecipeForms.openCreateModal = function() {
  const modal = document.getElementById("modal-recipe-form");
  const title = document.getElementById("modal-form-title");
  const form = document.getElementById("recipe-form");
  const submitBtn = document.getElementById("btn-save-recipe");

  title.textContent = "Nouvelle recette";
  submitBtn.textContent = "Créer la recette";

  // Reset form
  form.reset();
  document.getElementById("ingredients-tbody").innerHTML = "";
  document.getElementById("steps-list").innerHTML = "";

  // Add one empty ingredient and step row
  addIngredientRow();
  addStepRow();

  currentRecipeID = null;
  updateCalories();

  modal.classList.add("open");
};

/**
 * Open edit modal
 */
window.RecipeForms.openEditModal = function(recipeID) {
  const recipe = recipesData[recipeID];
  if (!recipe) return;

  const modal = document.getElementById("modal-recipe-form");
  const title = document.getElementById("modal-form-title");
  const form = document.getElementById("recipe-form");
  const submitBtn = document.getElementById("btn-save-recipe");

  title.textContent = `Modifier "${recipe.name}"`;
  submitBtn.textContent = "Sauvegarder";

  // Populate fields
  document.getElementById("field-recipe-name").value = recipe.name;
  document.getElementById("field-description").value = recipe.description || "";
  document.getElementById("field-prep-min").value = recipe.prep_minutes || 0;
  document.getElementById("field-cook-min").value = recipe.cook_minutes || 0;
  document.getElementById("field-tags").value = (recipe.tags || []).join(", ");

  // Ingredients
  document.getElementById("ingredients-tbody").innerHTML = "";
  (recipe.ingredients || []).forEach(ing => {
    addIngredientRow(ing.name, ing.quantity, ing.unit, ing.calories_per_100);
  });

  // Steps
  document.getElementById("steps-list").innerHTML = "";
  (recipe.steps || []).forEach(step => {
    addStepRow(step);
  });

  currentRecipeID = recipeID;
  updateCalories();

  modal.classList.add("open");
};

/**
 * Handle form submission
 */
function handleRecipeFormSubmit(e) {
  e.preventDefault();

  if (!validateRecipeForm()) return;

  const data = collectRecipeFormData();

  // Generate ID if creating new
  let recipeID = currentRecipeID;
  if (!recipeID) {
    recipeID = generateRecipeID(data.name);

    // Ensure unique ID
    let counter = 1;
    let uniqueID = recipeID;
    while (recipesData[uniqueID]) {
      uniqueID = recipeID + "_" + counter;
      counter++;
    }
    recipeID = uniqueID;
  }

  // Save recipe
  recipesData[recipeID] = {
    name: data.name,
    description: data.description,
    prep_minutes: data.prep_minutes,
    cook_minutes: data.cook_minutes,
    tags: data.tags,
    ingredients: data.ingredients,
    steps: data.steps
  };

  // Sync and close
  syncRecipesToSheets();
  document.getElementById("modal-recipe-form").classList.remove("open");
  renderRecipeList();

  // Show feedback
  console.log(`Recipe saved: ${data.name}`);
}
```

- [ ] **Step 3: Setup event listeners**

```javascript
/**
 * Initialize form events
 */
function initializeRecipeFormEvents() {
  const form = document.getElementById("recipe-form");
  const addIngBtn = document.getElementById("btn-add-ingredient");
  const addStepBtn = document.getElementById("btn-add-step");
  const cancelBtn = document.getElementById("btn-cancel-recipe");

  form.addEventListener("submit", handleRecipeFormSubmit);

  addIngBtn.addEventListener("click", function(e) {
    e.preventDefault();
    addIngredientRow();
  });

  addStepBtn.addEventListener("click", function(e) {
    e.preventDefault();
    addStepRow();
  });

  cancelBtn.addEventListener("click", function(e) {
    e.preventDefault();
    document.getElementById("modal-recipe-form").classList.remove("open");
  });

  // Close view modal
  const viewModal = document.getElementById("modal-recipe-view");
  const viewClose = viewModal.querySelector(".modal-close");
  if (viewClose) {
    viewClose.addEventListener("click", closeViewModal);
  }
}

// Boot
document.addEventListener("DOMContentLoaded", initializeRecipeFormEvents);
```

- [ ] **Step 4: Commit**

```bash
git add js/recettes-forms.js recettes.html
git commit -m "feat: add recettes-forms.js with create/edit form logic"
```

---

## Task 5: Integration & Testing

**Files:**
- Test: Manual browser testing

- [ ] **Step 1: Verify page loads**

1. Open `recettes.html` in browser
2. Check console for errors
3. Verify button "➕ Ajouter recette" visible

- [ ] **Step 2: Test create recipe**

1. Click "➕ Ajouter recette"
2. Modal opens with empty form
3. Fill: name "Pâtes test", prep 10, cook 15, tags "test"
4. Add ingredient "Pâtes" (search should autocomplete from inventory)
5. Click "✕" to delete ingredient row → works
6. Add step "Boil water"
7. Calories display updates
8. Click "Créer la recette"
9. Modal closes, recipe appears in list
10. Verify Sheets A1 (RecettesJSON) updated with new recipe JSON

- [ ] **Step 3: Test view recipe**

1. Click "👁️ Voir" on recipe card
2. Modal opens with read-only display
3. Shows: name, description, times, ingredients with calories, steps
4. Close modal (click ✕ or backdrop)

- [ ] **Step 4: Test edit recipe**

1. Click "✏️ Éditer" on recipe card
2. Modal opens with form pre-populated
3. Change: name, add ingredient, add step
4. Calories update in real-time
5. Click "Sauvegarder"
6. Modal closes, list updates
7. Verify Sheets A1 updated

- [ ] **Step 5: Test ingredient autocomplete**

1. Create recipe
2. Add ingredient row
3. Type "Mai" (for "Maïs")
4. Autocomplete suggestions appear (from inventory)
5. Select one → calories_per_100 populated
6. Verify calorie total updates

- [ ] **Step 6: Verify Sheets sync**

1. Create a recipe
2. Open Google Sheets RecettesJSON tab
3. A1 should contain JSON with the new recipe
4. Edit recipe
5. A1 updates in real-time

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "test: verify recipes CRUD, form, and sheets sync work end-to-end"
```

---

## Task 6: Polish & Edge Cases

**Files:**
- Modify: `recettes.html`, `recettes.js`

- [ ] **Step 1: Add delete recipe button**

In `renderRecipeCard()` in `recettes.js`, add delete button:

```javascript
const deleteBtn = document.createElement("button");
deleteBtn.className = "btn btn-danger";
deleteBtn.textContent = "🗑️ Supprimer";
deleteBtn.addEventListener("click", function(e) {
  e.preventDefault();
  if (confirm(`Supprimer la recette "${recipe.name}"?`)) {
    delete recipesData[recipeID];
    syncRecipesToSheets();
    renderRecipeList();
  }
});
buttons.appendChild(deleteBtn);
```

- [ ] **Step 2: Handle empty inventory gracefully**

In `updateIngredientCalories()` in `recettes-forms.js`:

```javascript
if (matches.length === 0) {
  const row = input.closest("tr");
  const calCell = row.querySelector("td:nth-child(4)");
  calCell.textContent = "?";
  calCell.dataset.caloriesPer100 = 0;
}
```

- [ ] **Step 3: Error handling for form**

In `handleRecipeFormSubmit()` in `recettes-forms.js`:

```javascript
try {
  syncRecipesToSheets();
} catch (err) {
  alert("Erreur: la recette n'a pas pu être sauvegardée sur Google Sheets. Elle est enregistrée localement.");
  console.error(err);
}
```

- [ ] **Step 4: Commit**

```bash
git add js/recettes.js js/recettes-forms.js
git commit -m "feat: add delete button, error handling, edge case fixes"
```

---

## Task 7: Final Verification & Documentation

**Files:**
- Verify: All files created and committed
- Docs: Check spec against implementation

- [ ] **Step 1: Verify all files exist**

```bash
ls -la recettes.html js/recettes.js js/recettes-forms.js js/recettes-utils.js
```

All four should exist.

- [ ] **Step 2: Verify GitHub Pages updated**

1. Push to GitHub
2. Go to https://3delart.github.io/MealFlow/recettes.html
3. Verify page loads and works

- [ ] **Step 3: Spot-check implementation against spec**

Skim `docs/superpowers/specs/2026-05-28-recettes-design.md`:
- ✅ Architecture (3 files: recettes.html, recettes.js, recettes-forms.js)
- ✅ Data flow (load → render → sync)
- ✅ UI (list, create modal, view modal, edit modal)
- ✅ Calorie calculation (total + per 100g)
- ✅ Ingredient autocomplete from inventory
- ✅ Tags, prep/cook times
- ✅ Steps
- ✅ Sheets sync

- [ ] **Step 4: Final commit & push**

```bash
git status
git push
```

All changes on remote.
