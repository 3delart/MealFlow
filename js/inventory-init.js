/**
 * Inventory initialization and event handlers
 */

function searchProducts(query) {
  if (!query || query.length < 2) return [];
  if (!inventoryData) return [];

  const q = query.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return inventoryData
    .filter(item => {
      const prodName = (item.Produit || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      return prodName.includes(q);
    })
    .map(item => ({
      name: item.Produit,
      unit: item.Unité,
      category: item.Catégorie,
      calories: item.Calories_per_100,
      price: item.Prix,
      conversionFactor: item.Conversion_factor
    }))
    .slice(0, 10);
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
        calories_per_100: document.getElementById("field-calories").value || null,
        cooking_factor: parseFloat(document.getElementById("field-cooking-factor").value) || 1.0
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

  // Update expiry date when category or date-added changes (add form)
  const fieldCategory = document.getElementById("field-category");
  const fieldDateAdded = document.getElementById("field-date-added");
  if (fieldCategory) {
    fieldCategory.addEventListener("change", () => {
      updateExpiryDateFromCategory("field-date-added", "field-category", "field-expiry");
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
