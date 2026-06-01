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
  document.getElementById("edit-price").value = (item.Prix || "").toString().replace(",", ".");
  document.getElementById("edit-calories").value = item.Calories_per_100 || "";
  document.getElementById("edit-conversion").value = item.Conversion_factor || "";
  document.getElementById("edit-cooking-factor").value = item.cooking_factor || 1.0;
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

  const oldName = item.Produit;
  const newName = document.getElementById("edit-product-name").value.trim();
  if (!newName) return;

  const priceValue = document.getElementById("edit-price").value || item.Prix;
  const caloriesValue = document.getElementById("edit-calories").value;
  const conversionValue = document.getElementById("edit-conversion").value;
  const updatedData = {
    Produit: newName,
    Catégorie: document.getElementById("edit-category").value || item.Catégorie,
    Qty: document.getElementById("edit-quantity").value || item.Qty,
    Unité: document.getElementById("edit-unit").value || item.Unité,
    Date_ajout: document.getElementById("edit-date-added").value || item.Date_ajout,
    Péremption: document.getElementById("edit-expiry").value || item.Péremption,
    Prix: priceValue.toString().replace(".", ","),
    Calories_per_100: caloriesValue ? parseFloat(caloriesValue) : item.Calories_per_100,
    Conversion_factor: conversionValue || item.Conversion_factor || "",
    cooking_factor: parseFloat(document.getElementById("edit-cooking-factor").value) || 1.0
  };

  // Clear dates if quantity reaches 0
  if (parseFloat(updatedData.Qty) === 0) {
    updatedData.Péremption = "";
    updatedData.Date_ajout = "";
  }

  Object.assign(item, updatedData);
  saveInventory();

  const authenticated = typeof isAuthenticated === "function" && isAuthenticated();
  const token = authenticated ? getAccessToken() : null;

  if (authenticated && item.sheetRowNumber && token) {
    try {
      await SheetsAPI.updateSheetCell(`Inventory!B${item.sheetRowNumber}`, newName, token);
      await SheetsAPI.updateSheetCell(`Inventory!C${item.sheetRowNumber}`, item.Catégorie, token);
      await SheetsAPI.updateSheetCell(`Inventory!D${item.sheetRowNumber}`, item.Qty, token);
      await SheetsAPI.updateSheetCell(`Inventory!E${item.sheetRowNumber}`, item.Unité, token);
      await SheetsAPI.updateSheetCell(`Inventory!F${item.sheetRowNumber}`, item.Conversion_factor || "", token);
      await SheetsAPI.updateSheetCell(`Inventory!G${item.sheetRowNumber}`, item.Date_ajout, token);
      await SheetsAPI.updateSheetCell(`Inventory!H${item.sheetRowNumber}`, item.Péremption, token);
      await SheetsAPI.updateSheetCell(`Inventory!I${item.sheetRowNumber}`, item.Prix, token);
      await SheetsAPI.updateSheetCell(`Inventory!J${item.sheetRowNumber}`, item.Calories_per_100 || "", token);
      await SheetsAPI.updateSheetCell(`Inventory!O${item.sheetRowNumber}`, item.cooking_factor || 1.0, token);
    } catch (err) {
      console.error("Failed to update Sheets:", err);
    }
  }

  closeEditModal();
  renderInventory();

  if (oldName !== newName) {
    renameProductInRecipes(oldName, newName, token)
      .catch(err => console.warn("renameProductInRecipes failed:", err));
    renameProductInCourses(oldName, newName, token)
      .catch(err => console.warn("renameProductInCourses failed:", err));
  }
}

async function renameProductInRecipes(oldName, newName, token) {
  const stored = localStorage.getItem("mealflow_recipes");
  if (stored) {
    try {
      const recipes = JSON.parse(stored);
      let dirty = false;
      Object.values(recipes).forEach(recipe => {
        if (!Array.isArray(recipe.ingredients)) return;
        recipe.ingredients.forEach(ing => {
          if (ing.name === oldName) { ing.name = newName; dirty = true; }
        });
      });
      if (dirty) localStorage.setItem("mealflow_recipes", JSON.stringify(recipes));
    } catch (err) {
      console.warn("[renameProductInRecipes] localStorage error:", err);
    }
  }

  if (!token || !window.SheetsAPI) return;

  const rows = await SheetsAPI.readSheetTab("Recettes");
  for (let i = 1; i < rows.length; i++) {
    const rawJson = rows[i][5];
    if (!rawJson) continue;
    let ingredients;
    try { ingredients = JSON.parse(rawJson); } catch { continue; }
    let changed = false;
    ingredients.forEach(ing => {
      if (ing.name === oldName) { ing.name = newName; changed = true; }
    });
    if (changed) {
      await SheetsAPI.batchUpdateRange(`Recettes!F${i + 1}`, [[JSON.stringify(ingredients)]], token);
    }
  }
}

async function renameProductInCourses(oldName, newName, token) {
  if (!token || !window.SheetsAPI) return;

  const rows = await SheetsAPI.readSheetTab("Courses", "A:G");
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row[0] !== oldName) continue;
    const updatedRow = [newName, row[1] || "", row[2] || "", row[3] || "", row[4] || "", row[5] || "", row[6] || ""];
    await SheetsAPI.batchUpdateRange(`Courses!A${i + 1}:G${i + 1}`, [updatedRow], token);
  }
}
