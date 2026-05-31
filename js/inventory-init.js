/**
 * Inventory initialization and event handlers
 */

const categoryExpiryDays = {
  "Produits laitiers": 180,
  "Lait": 180,
  "Fromage": 30,
  "Viandes": 3,
  "Poissons": 2,
  "Œufs": 21,
  "Conserves": 365,
  "Fruits": 14,
  "Légumes": 21,
  "Boissons": 365,
  "Épices & Condiments": 365,
  "Sauces": 365,
  "Féculents": 180,
  "Autres": 30
};

function updateExpiryDateFromCategory(dateAddedSelector, categorySelector, expirySelector) {
  const dateAddedEl = document.getElementById(dateAddedSelector);
  const categoryEl = document.getElementById(categorySelector);
  const expiryEl = document.getElementById(expirySelector);

  if (!dateAddedEl || !categoryEl || !expiryEl) return;

  const dateAdded = new Date(dateAddedEl.value + "T00:00:00");
  if (isNaN(dateAdded.getTime())) return;

  const category = categoryEl.value || "Autres";
  const days = categoryExpiryDays[category] || 30;

  const expiryDate = new Date(dateAdded);
  expiryDate.setDate(expiryDate.getDate() + days);
  expiryEl.value = expiryDate.toISOString().split("T")[0];
}

function setupEventHandlers() {
  const sheetCategories = [...new Set(inventoryData.map(i => i.Catégorie).filter(c => c))];
  const autoCategories = [
    "Féculents", "Fromage", "Produits laitiers", "Légumes", "Fruits",
    "Viandes", "Poissons", "Œufs", "Conserves", "Épices & Condiments",
    "Sauces", "Boissons"
  ];
  const categories = [...new Set([...sheetCategories, ...autoCategories])].sort();

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
  renderInventory();
}

document.addEventListener("DOMContentLoaded", initializeInventory);
