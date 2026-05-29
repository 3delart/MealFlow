/**
 * Inventory initialization and event handlers
 */

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
        calories_per_100: document.getElementById("field-calories").value || null
      };

      if (!formData.product_name || !formData.quantity || !formData.unit || !formData.category) {
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
