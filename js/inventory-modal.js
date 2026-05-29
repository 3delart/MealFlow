/**
 * Edit modal for inventory items
 */

function openEditModal(item) {
  const modal = document.getElementById("edit-modal");
  document.getElementById("edit-product-name").value = item.Produit;
  document.getElementById("edit-category").value = item.Catégorie;
  document.getElementById("edit-quantity").value = item.Qty;
  document.getElementById("edit-unit").value = item.Unité;
  document.getElementById("edit-date-added").value = item.Date_ajout;
  document.getElementById("edit-expiry").value = item.Péremption;
  document.getElementById("edit-price").value = item.Prix || "";
  modal.setAttribute("aria-hidden", "false");
  modal.classList.remove("hidden");
  modal.setAttribute("data-item-id", item.id);
}

function closeEditModal() {
  const modal = document.getElementById("edit-modal");
  modal.setAttribute("aria-hidden", "true");
  modal.classList.add("hidden");
  modal.removeAttribute("data-item-id");
}

async function saveEditedItem(e) {
  e.preventDefault();

  const itemId = document.getElementById("edit-modal").getAttribute("data-item-id");
  const item = inventoryData.find(i => i.id === itemId);
  if (!item) return;

  const updatedData = {
    Catégorie: document.getElementById("edit-category").value,
    Qty: document.getElementById("edit-quantity").value,
    Unité: document.getElementById("edit-unit").value,
    Date_ajout: document.getElementById("edit-date-added").value,
    Péremption: document.getElementById("edit-expiry").value,
    Prix: document.getElementById("edit-price").value || ""
  };

  Object.assign(item, updatedData);
  saveInventory();

  if (typeof isAuthenticated === "function" && isAuthenticated() && item.sheetRowNumber) {
    const token = getAccessToken();
    try {
      await SheetsAPI.updateSheetCell(`Inventory!C${item.sheetRowNumber}`, item.Catégorie, token);
      await SheetsAPI.updateSheetCell(`Inventory!D${item.sheetRowNumber}`, item.Qty, token);
      await SheetsAPI.updateSheetCell(`Inventory!E${item.sheetRowNumber}`, item.Unité, token);
      await SheetsAPI.updateSheetCell(`Inventory!F${item.sheetRowNumber}`, item.Date_ajout, token);
      await SheetsAPI.updateSheetCell(`Inventory!G${item.sheetRowNumber}`, item.Péremption, token);
      await SheetsAPI.updateSheetCell(`Inventory!H${item.sheetRowNumber}`, item.Prix, token);
      console.log("Item updated in Sheets");
    } catch (err) {
      console.error("Failed to update Sheets:", err);
    }
  }

  closeEditModal();
  renderInventory();
}
