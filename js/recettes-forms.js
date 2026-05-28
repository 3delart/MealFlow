/**
 * @fileoverview Recipe form modal logic for MealFlow
 * Handles create/edit modals, form validation, ingredient rows, step management, and recipe submission
 */

// ============================================================================
// MODULE STATE
// ============================================================================

/** @type {string|null} Track current editing recipe ID (null if creating new) */
let currentRecipeID = null;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Add ingredient row to the table
 * @param {string} productName - Product name
 * @param {string|number} quantity - Quantity value
 * @param {string} unit - Unit (g, ml, litre, pièce)
 * @param {string|number} calories - Calories per 100g
 * @returns {void}
 */
function addIngredientRow(productName = "", quantity = "", unit = "g", calories = 0) {
  const tbody = document.getElementById("ingredients-tbody");
  const row = document.createElement("tr");

  // Product cell with autocomplete dropdown
  const productCell = document.createElement("td");
  productCell.style.position = "relative";

  const productInput = document.createElement("input");
  productInput.type = "text";
  productInput.value = productName;
  productInput.placeholder = "Produit";
  productInput.addEventListener("input", debounceIngredientAutocomplete);
  productCell.appendChild(productInput);

  // Dropdown for suggestions
  const dropdown = document.createElement("div");
  dropdown.className = "ingredient-dropdown";
  dropdown.style.position = "absolute";
  dropdown.style.top = "100%";
  dropdown.style.left = "0";
  dropdown.style.right = "0";
  dropdown.style.backgroundColor = "#fff";
  dropdown.style.border = "1px solid #ddd";
  dropdown.style.borderRadius = "4px";
  dropdown.style.maxHeight = "150px";
  dropdown.style.overflowY = "auto";
  dropdown.style.zIndex = "10";
  dropdown.style.display = "none";
  dropdown.style.marginTop = "2px";
  productCell.appendChild(dropdown);

  // Store dropdown reference in input for easy access
  productInput.dataset.dropdown = productCell.querySelector(".ingredient-dropdown");
  productInput.dataset.row = row;

  // Quantity cell
  const qtyCell = document.createElement("td");
  const qtyInput = document.createElement("input");
  qtyInput.type = "number";
  qtyInput.value = quantity;
  qtyInput.min = "0";
  qtyInput.step = "0.1";
  qtyInput.addEventListener("change", updateCalories);
  qtyCell.appendChild(qtyInput);

  // Unit cell
  const unitCell = document.createElement("td");
  const unitSelect = document.createElement("select");
  unitSelect.innerHTML = `
    <option value="g" ${unit === "g" ? "selected" : ""}>g</option>
    <option value="ml" ${unit === "ml" ? "selected" : ""}>ml</option>
    <option value="litre" ${unit === "litre" ? "selected" : ""}>litre</option>
    <option value="pièce" ${unit === "pièce" ? "selected" : ""}>pièce</option>
  `;
  unitCell.appendChild(unitSelect);

  // Calories cell (display only, updated via autocomplete)
  const calCell = document.createElement("td");
  const calSpan = document.createElement("span");
  calSpan.textContent = calories;
  calSpan.dataset.caloriesPer100 = calories;
  calCell.appendChild(calSpan);

  // Delete button
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
 * Debounced ingredient autocomplete search
 * @param {Event} e - Input event
 * @returns {void}
 */
function debounceIngredientAutocomplete(e) {
  clearTimeout(debounceIngredientAutocomplete.timeout);
  debounceIngredientAutocomplete.timeout = setTimeout(() => {
    updateIngredientCalories(e.target);
  }, 300);
}

/**
 * Update ingredient calories on product selection
 * @param {HTMLInputElement} input - Product input element
 * @returns {void}
 */
function updateIngredientCalories(input) {
  const productName = input.value;
  const matches = window.RecettesUtils.searchInventoryProducts(productName);

  const row = input.closest("tr");
  const calSpan = row.querySelector("td:nth-child(4) span");
  const dropdownEl = row.querySelector(".ingredient-dropdown");

  // Show/populate dropdown if there are matches
  if (matches.length > 0) {
    dropdownEl.innerHTML = "";
    matches.slice(0, 5).forEach(match => {
      const item = document.createElement("div");
      item.style.padding = "8px 12px";
      item.style.cursor = "pointer";
      item.style.borderBottom = "1px solid #eee";
      item.style.fontSize = "13px";
      item.textContent = `${match.name} (${match.calories_per_100} kcal)`;

      item.addEventListener("mouseover", () => {
        item.style.backgroundColor = "#f0f0f0";
      });
      item.addEventListener("mouseout", () => {
        item.style.backgroundColor = "transparent";
      });

      item.addEventListener("click", function(e) {
        e.stopPropagation();
        input.value = match.name;
        calSpan.textContent = match.calories_per_100;
        calSpan.dataset.caloriesPer100 = match.calories_per_100;
        dropdownEl.style.display = "none";
        updateCalories();
      });

      dropdownEl.appendChild(item);
    });
    dropdownEl.style.display = "block";

    // Auto-select first match if only one
    if (matches.length === 1) {
      const match = matches[0];
      calSpan.textContent = match.calories_per_100;
      calSpan.dataset.caloriesPer100 = match.calories_per_100;
    }
  } else {
    // No match found, show placeholder
    calSpan.textContent = "?";
    calSpan.dataset.caloriesPer100 = 0;
    dropdownEl.style.display = "none";
  }

  updateCalories();
}

/**
 * Close ingredient dropdown when clicking elsewhere
 */
document.addEventListener("click", function(e) {
  if (!e.target.closest("td")) {
    document.querySelectorAll(".ingredient-dropdown").forEach(dd => {
      dd.style.display = "none";
    });
  }
});

/**
 * Update total calories display based on current ingredients
 * @returns {void}
 */
function updateCalories() {
  const tbody = document.getElementById("ingredients-tbody");
  const rows = tbody.querySelectorAll("tr");

  let totalKcal = 0;
  let totalWeight = 0;

  rows.forEach(row => {
    const qtyInput = row.querySelector("td:nth-child(2) input");
    const unitSelect = row.querySelector("td:nth-child(3) select");
    const calSpan = row.querySelector("td:nth-child(4) span");

    const qty = parseFloat(qtyInput.value) || 0;
    const unit = unitSelect.value;
    const cal100 = parseFloat(calSpan.dataset.caloriesPer100 || 0) || 0;

    // Convert to grams
    let qtyGrams = qty;
    if (unit === "litre") {
      qtyGrams = qty * 1000;
    }
    // ml ≈ g for liquids, pièce has 0 weight

    totalWeight += qtyGrams;
    totalKcal += cal100 * (qty / 100);
  });

  const kcalPer100 = totalWeight > 0 ? totalKcal / (totalWeight / 100) : 0;

  document.getElementById("calorie-total").textContent = Math.round(totalKcal);
  document.getElementById("calorie-per-100").textContent = Math.round(kcalPer100);
}

/**
 * Add step row to the steps list
 * @param {string} description - Step description
 * @returns {void}
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
    renumberSteps();
  });

  row.appendChild(numSpan);
  row.appendChild(input);
  row.appendChild(deleteBtn);

  stepsList.appendChild(row);
}

/**
 * Re-number steps after deletion to keep sequence
 * @returns {void}
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
 * Collect all form data into recipe object
 * @returns {Object} Recipe data object
 */
function collectRecipeFormData() {
  const name = document.getElementById("field-recipe-name").value.trim();
  const description = document.getElementById("field-description").value.trim();
  const prepMin = parseInt(document.getElementById("field-prep-min").value) || 0;
  const cookMin = parseInt(document.getElementById("field-cook-min").value) || 0;
  const tagsStr = document.getElementById("field-tags").value.trim();

  const tags = tagsStr.length > 0 ? tagsStr.split(",").map(t => t.trim()) : [];

  // Collect ingredients from table
  const ingredients = [];
  document.querySelectorAll("#ingredients-tbody tr").forEach(row => {
    const productInput = row.querySelector("td:nth-child(1) input");
    const qtyInput = row.querySelector("td:nth-child(2) input");
    const unitSelect = row.querySelector("td:nth-child(3) select");
    const calSpan = row.querySelector("td:nth-child(4) span");

    const product = productInput.value.trim();
    const qty = parseFloat(qtyInput.value) || 0;
    const unit = unitSelect.value;
    const cal100 = parseFloat(calSpan.dataset.caloriesPer100 || 0) || 0;

    if (product && qty > 0) {
      ingredients.push({
        name: product,
        quantity: qty,
        unit: unit,
        calories_per_100: cal100
      });
    }
  });

  // Collect steps from list
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
 * Validate recipe form before submission
 * @returns {boolean} True if form is valid
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

// ============================================================================
// MODAL OPEN FUNCTIONS
// ============================================================================

/**
 * Open create modal (new recipe)
 * @returns {void}
 */
function openCreateModal() {
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
}

/**
 * Open edit modal (existing recipe)
 * @param {string} recipeID - Recipe ID to edit
 * @returns {void}
 */
function openEditModal(recipeID) {
  const recipe = window.recipesData[recipeID];
  if (!recipe) return;

  const modal = document.getElementById("modal-recipe-form");
  const title = document.getElementById("modal-form-title");
  const form = document.getElementById("recipe-form");
  const submitBtn = document.getElementById("btn-save-recipe");

  title.textContent = `Modifier "${recipe.name}"`;
  submitBtn.textContent = "Sauvegarder";

  // Populate form fields with existing recipe data
  document.getElementById("field-recipe-name").value = recipe.name;
  document.getElementById("field-description").value = recipe.description || "";
  document.getElementById("field-prep-min").value = recipe.prep_minutes || 0;
  document.getElementById("field-cook-min").value = recipe.cook_minutes || 0;
  document.getElementById("field-tags").value = (recipe.tags || []).join(", ");

  // Clear and populate ingredients
  document.getElementById("ingredients-tbody").innerHTML = "";
  (recipe.ingredients || []).forEach(ing => {
    addIngredientRow(ing.name, ing.quantity, ing.unit, ing.calories_per_100);
  });

  // Clear and populate steps
  document.getElementById("steps-list").innerHTML = "";
  (recipe.steps || []).forEach(step => {
    addStepRow(step);
  });

  currentRecipeID = recipeID;
  updateCalories();

  modal.classList.add("open");
}

// ============================================================================
// FORM SUBMISSION
// ============================================================================

/**
 * Handle recipe form submission (create or update)
 * @param {Event} e - Form submit event
 * @returns {void}
 */
function handleRecipeFormSubmit(e) {
  e.preventDefault();

  if (!validateRecipeForm()) return;

  const data = collectRecipeFormData();

  // Generate ID if creating new recipe
  let recipeID = currentRecipeID;
  if (!recipeID) {
    recipeID = window.RecettesUtils.generateRecipeID(data.name);

    // Ensure unique ID by appending counter if needed
    let counter = 1;
    let uniqueID = recipeID;
    while (window.recipesData[uniqueID]) {
      uniqueID = recipeID + "_" + counter;
      counter++;
    }
    recipeID = uniqueID;
  }

  // Save recipe to in-memory store
  window.recipesData[recipeID] = {
    name: data.name,
    description: data.description,
    prep_minutes: data.prep_minutes,
    cook_minutes: data.cook_minutes,
    tags: data.tags,
    ingredients: data.ingredients,
    steps: data.steps
  };

  // Sync to Sheets and close modal
  try {
    window.syncRecipesToSheets();
  } catch (err) {
    alert("Erreur: la recette n'a pas pu être sauvegardée sur Google Sheets. Elle est enregistrée localement.");
    console.error("Sheets sync error:", err);
  }

  document.getElementById("modal-recipe-form").classList.remove("open");
  window.renderRecipeList();

  console.log(`Recipe saved: ${data.name}`);
}

// ============================================================================
// EVENT INITIALIZATION
// ============================================================================

/**
 * Initialize all form event listeners
 * Called on DOMContentLoaded
 * @returns {void}
 */
function initializeRecipeFormEvents() {
  const form = document.getElementById("recipe-form");
  const addIngBtn = document.getElementById("btn-add-ingredient");
  const addStepBtn = document.getElementById("btn-add-step");
  const cancelBtn = document.getElementById("btn-cancel-recipe");

  // Form submission
  form.addEventListener("submit", handleRecipeFormSubmit);

  // Add ingredient row button
  if (addIngBtn) {
    addIngBtn.addEventListener("click", function(e) {
      e.preventDefault();
      addIngredientRow();
    });
  }

  // Add step row button
  if (addStepBtn) {
    addStepBtn.addEventListener("click", function(e) {
      e.preventDefault();
      addStepRow();
    });
  }

  // Cancel button
  if (cancelBtn) {
    cancelBtn.addEventListener("click", function(e) {
      e.preventDefault();
      document.getElementById("modal-recipe-form").classList.remove("open");
    });
  }
}

// ============================================================================
// MODULE EXPORT
// ============================================================================

/**
 * Export module interface to window
 * @type {Object}
 */
window.RecipeForms = {
  openCreateModal,
  openEditModal
};

// ============================================================================
// BOOT
// ============================================================================

document.addEventListener("DOMContentLoaded", initializeRecipeFormEvents);
