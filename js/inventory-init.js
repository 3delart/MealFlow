/**
 * Inventory initialization and event handlers
 */

function searchProducts(query) {
  if (!query || query.length < 2) return [];
  if (!inventoryData) return [];

  const q = Utils.normalizeString(query);
  return inventoryData
    .filter(item => {
      const prodName = Utils.normalizeString(item.Produit);
      return prodName.includes(q);
    })
    .map(item => ({
      name: item.Produit,
      unit: item.Unité,
      category: item.Catégorie,
      calories: item.calories_per_100,
      price: item.Prix,
      priceUnit: item.priceUnit,
      conversionFactor: item.Conversion_factor
    }))
    .slice(0, 10);
}

// ============================================================================
// Diet tag checkboxes (per-product classification)
// ============================================================================

/** Render diet concept checkboxes from config into a container. */
function renderDietCheckboxes(containerId) {
  const container = document.getElementById(containerId);
  if (!container || !window.FoodConfig) return;
  container.innerHTML = "";
  window.FoodConfig.DIET_CONCEPTS.forEach(({ key, label }) => {
    const id = `${containerId}-${key}`;
    const wrap = document.createElement("label");
    wrap.style.cssText = "display:flex;align-items:center;gap:4px;font-size:13px;cursor:pointer;font-weight:normal;";
    wrap.innerHTML = `<input type="checkbox" value="${key}" id="${id}"> ${label}`;
    container.appendChild(wrap);
  });
}

/** Read the checked diet concepts from a container. */
function getCheckedDietTags(containerId) {
  return Array.from(document.querySelectorAll(`#${containerId} input[type="checkbox"]:checked`))
    .map(cb => cb.value);
}

/** Set the checked diet concepts in a container. */
function setCheckedDietTags(containerId, concepts) {
  const set = new Set(concepts || []);
  document.querySelectorAll(`#${containerId} input[type="checkbox"]`)
    .forEach(cb => { cb.checked = set.has(cb.value); });
}

/** Auto-prefill diet checkboxes from product name/allergens/category. */
function prefillDietTags(containerId, name, allergens, category) {
  if (!window.FoodConfig) return;
  setCheckedDietTags(containerId, window.FoodConfig.suggestDietConcepts(name, allergens, category));
}

function setupProductAutocomplete() {
  const productInput = document.getElementById("field-product-name");
  const suggestionsDiv = document.getElementById("product-suggestions");

  if (!productInput || !suggestionsDiv) return;

  let debounceTimer;
  productInput.addEventListener("input", (e) => {
    clearTimeout(debounceTimer);
    const query = e.target.value;

    debounceTimer = setTimeout(() => {
      const matches = searchProducts(query);

      if (matches.length > 0) {
        suggestionsDiv.innerHTML = "";
        matches.forEach(match => {
          const item = document.createElement("div");
          item.style.padding = "10px 12px";
          item.style.cursor = "pointer";
          item.style.borderBottom = "1px solid #eee";
          item.style.fontSize = "14px";
          item.textContent = match.name;

          item.addEventListener("click", () => {
            productInput.value = match.name;
            if (match.unit) document.getElementById("field-unit").value = match.unit;
            if (match.category) document.getElementById("field-category").value = match.category;
            if (match.calories) document.getElementById("field-calories").value = match.calories;
            if (match.price) document.getElementById("field-price").value = match.price;
            if (match.priceUnit) document.getElementById("field-price-unit").value = match.priceUnit;
            if (match.conversionFactor) document.getElementById("field-conversion").value = match.conversionFactor;
            suggestionsDiv.style.display = "none";
          });

          item.addEventListener("mouseover", () => item.style.backgroundColor = "#f5f5f5");
          item.addEventListener("mouseout", () => item.style.backgroundColor = "transparent");

          suggestionsDiv.appendChild(item);
        });
        suggestionsDiv.style.display = "block";
      } else {
        suggestionsDiv.style.display = "none";
      }
    }, 300);
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".form-group")) {
      suggestionsDiv.style.display = "none";
    }
  });
}

function updateExpiryDateFromCategory(dateAddedSelector, categorySelector, expirySelector) {
  const dateAddedEl = document.getElementById(dateAddedSelector);
  const categoryEl = document.getElementById(categorySelector);
  const expiryEl = document.getElementById(expirySelector);

  if (!dateAddedEl || !categoryEl || !expiryEl) return;

  const dateAdded = new Date(dateAddedEl.value + "T00:00:00");
  if (isNaN(dateAdded.getTime())) return;

  const category = categoryEl.value || "Autres";
  const days = getCategoryExpiryDays(category);

  const expiryDate = new Date(dateAdded);
  expiryDate.setDate(expiryDate.getDate() + days);
  expiryEl.value = expiryDate.toISOString().split("T")[0];
}

function setupEventHandlers() {
  const sheetCategories = [...new Set(inventoryData.map(i => i.Catégorie).filter(c => c))];
  const configCategories = getAllCategoryNames();
  const categories = [...new Set([...sheetCategories, ...configCategories])].sort();

  const filterSelect = document.getElementById("filter-category");
  if (filterSelect) {
    filterSelect.innerHTML = "";

    // "Tous les articles"
    let option = document.createElement("option");
    option.value = "";
    option.textContent = "-- Tous les articles --";
    filterSelect.appendChild(option);

    // "Articles en stock"
    option = document.createElement("option");
    option.value = "__IN_STOCK__";
    option.textContent = "Articles en stock";
    filterSelect.appendChild(option);

    // "Périme bientôt"
    option = document.createElement("option");
    option.value = "__EXPIRING__";
    option.textContent = "⚠️ Périme bientôt";
    filterSelect.appendChild(option);

    // Catégories triées
    categories.forEach(cat => {
      const option = document.createElement("option");
      option.value = cat;
      option.textContent = cat;
      filterSelect.appendChild(option);
    });
  }

  const btnStartScanner = document.getElementById("btn-start-scanner");
  const btnStopScanner = document.getElementById("btn-stop-scanner");
  if (btnStartScanner) {
    btnStartScanner.addEventListener("click", function() {
      this.style.display = "none";
      if (btnStopScanner) btnStopScanner.style.display = "inline-block";
      startScanner();
    });
  }

  if (btnStopScanner) {
    btnStopScanner.addEventListener("click", function() {
      stopScanner();
      if (btnStartScanner) btnStartScanner.style.display = "inline-block";
      this.style.display = "none";
    });
  }

  const addItemForm = document.getElementById("add-item-form");
  if (addItemForm) {
    addItemForm.addEventListener("submit", function(e) {
      e.preventDefault();

      const formData = {
        product_name: document.getElementById("field-product-name").value,
        quantity: document.getElementById("field-quantity").value,
        unit: document.getElementById("field-unit").value,
        category: document.getElementById("field-category").value,
        expiry_date: document.getElementById("field-expiry").value,
        price: document.getElementById("field-price").value || "",
        price_unit: document.getElementById("field-price-unit").value || "",
        calories_per_100: document.getElementById("field-calories").value || null,
        cooking_factor: parseFloat(document.getElementById("field-cooking-factor").value) || 1.0,
        diet_tags: getCheckedDietTags("diet-tags-add"),
        min_qty: parseFloat(document.getElementById("field-min-qty").value) || 0
      };

      if (!formData.product_name || formData.quantity === "" || !formData.unit || !formData.category) {
        alert("Veuillez remplir les champs obligatoires (produit, quantité, unité, catégorie).");
        return;
      }

      addItem(formData);
      renderInventory();
    });
  }

  const filterCategoryEl = document.getElementById("filter-category");
  if (filterCategoryEl) {
    filterCategoryEl.addEventListener("change", renderInventory);
  }

  const searchInventoryEl = document.getElementById('search-inventory');
  let _searchInventoryDebounce = null;
  if (searchInventoryEl) {
    searchInventoryEl.addEventListener('input', () => {
      clearTimeout(_searchInventoryDebounce);
      _searchInventoryDebounce = setTimeout(renderInventory, 300);
    });
  }

  const editForm = document.getElementById("edit-form");
  if (editForm) {
    editForm.addEventListener("submit", saveEditedItem);
  }

  const editModal = document.getElementById("edit-modal");
  if (editModal) {
    editModal.addEventListener("click", function(e) {
      if (e.target === this) closeEditModal();
    });
  }

  // Diet-tag checkboxes (add form): render + auto-prefill from name/category
  renderDietCheckboxes("diet-tags-add");
  const fieldProductName = document.getElementById("field-product-name");
  const refillAddDietTags = () => prefillDietTags(
    "diet-tags-add",
    fieldProductName ? fieldProductName.value : "",
    "",
    document.getElementById("field-category")?.value || ""
  );
  if (fieldProductName) {
    let _dietDebounce = null;
    fieldProductName.addEventListener("input", () => {
      clearTimeout(_dietDebounce);
      _dietDebounce = setTimeout(refillAddDietTags, 400);
    });
  }

  // Update expiry date when category or date-added changes (add form)
  const fieldCategory = document.getElementById("field-category");
  const fieldDateAdded = document.getElementById("field-date-added");
  if (fieldCategory) {
    fieldCategory.addEventListener("change", () => {
      updateExpiryDateFromCategory("field-date-added", "field-category", "field-expiry");
      refillAddDietTags();
    });
  }
  if (fieldDateAdded) {
    fieldDateAdded.addEventListener("change", () => {
      updateExpiryDateFromCategory("field-date-added", "field-category", "field-expiry");
    });
  }

  // Update expiry date when category or date-added changes (edit modal)
  const editCategory = document.getElementById("edit-category");
  const editDateAdded = document.getElementById("edit-date-added");
  if (editCategory) {
    editCategory.addEventListener("change", () => {
      updateExpiryDateFromCategory("edit-date-added", "edit-category", "edit-expiry");
    });
  }
  if (editDateAdded) {
    editDateAdded.addEventListener("change", () => {
      updateExpiryDateFromCategory("edit-date-added", "edit-category", "edit-expiry");
    });
  }
}

async function initializeInventory() {
  if (window.UserContext) {
    UserContext.applyUserStyling();
    UserContext.initializeUserToggle();
  }

  await loadInventory();
  setupEventHandlers();
  setupProductAutocomplete();
  renderInventory();
}

document.addEventListener("DOMContentLoaded", initializeInventory);
