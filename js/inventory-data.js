/**
 * Inventory data management: loading, saving, CRUD operations
 */

let inventoryData = [];
let scannedProductData = null;
let _consolidatingDuplicates = false; // guard against re-entrant consolidation

async function applyInventoryDeduction(item, qtyToDeduct, token) {
  if (!item.sheetRowNumber || !window.SheetsAPI || !token) return;
  const newQty = Math.max(0, (parseFloat(item.Qty) || 0) - qtyToDeduct);
  const updates = [{ range: `Inventory!D${item.sheetRowNumber}`, value: newQty.toString() }];
  if (newQty === 0) {
    updates.push({ range: `Inventory!G${item.sheetRowNumber}`, value: '' });
    updates.push({ range: `Inventory!H${item.sheetRowNumber}`, value: '' });
  }
  await window.SheetsAPI.batchUpdateCells(updates, token);
  item.Qty = newQty.toString();
  if (newQty === 0) { item.Date_ajout = ''; item.Péremption = ''; }
}

async function loadInventory() {
  try {
    const rows = await SheetsAPI.readSheetTab("Inventory");
    const objects = SheetsAPI.rowsToObjects(rows);

    if (objects.length > 0) {
      inventoryData = objects.map((row, idx) => ({
        id: `sheet_${idx + 2}`,
        sheetRowNumber: idx + 2,
        Barcode: row["Code barre"] || row["Barcode"] || row["ID"] || "",
        Produit: row["Produit"] || "",
        Catégorie: row["Catégorie"] || "Autres",
        Qty: row["Qty"] || "",
        Unité: row["Unité"] || "g",
        Date_ajout: row["Date_ajout"] || Utils.getTodayISO(),
        Péremption: row["Péremption"] || "",
        Prix: row["Prix"] || "",
        calories_per_100: parseFloat(row["Calories_per_100"]) || 0,
        proteins: parseFloat(row["Proteins"]) || 0,
        fats: parseFloat(row["Fats"]) || 0,
        carbs: parseFloat(row["Carbs"]) || 0,
        allergens: row["Allergens"] || "",
        Conversion_factor: row["Conversion_factor"] || "",
        cooking_factor: parseFloat((row["Cooking_factor"] || "1").toString().replace(",", ".")) || 1.0
      }));
      const { orphanRows, survivors } = mergeDuplicatesByBarcode();
      window.inventoryData = inventoryData;

      // Consolidate duplicates physically in the sheet so the displayed (summed)
      // quantity and the sheet stay in sync. Without this, the orphan rows keep
      // their own quantity and later updates only touch the survivor row.
      if (orphanRows.length > 0 && !_consolidatingDuplicates) {
        const token = typeof getAccessToken === 'function' ? getAccessToken() : null;
        if (token && window.SheetsAPI?.deleteSheetRows && window.SheetsAPI?.batchUpdateCells) {
          _consolidatingDuplicates = true;
          try {
            // 1. Write summed quantities to surviving rows (uses current row numbers).
            if (survivors.length > 0) {
              await window.SheetsAPI.batchUpdateCells(
                survivors.map(s => ({ range: `Inventory!D${s.sheetRowNumber}`, value: s.qty })),
                token
              );
            }
            // 2. Delete the orphan rows (deleteSheetRows sorts descending internally).
            await window.SheetsAPI.deleteSheetRows("Inventory", orphanRows, token);
            // 3. Reload to refresh sheetRowNumbers now that duplicates are gone.
            await loadInventory();
          } catch (err) {
            console.error("Inventory: duplicate consolidation failed:", err);
          } finally {
            _consolidatingDuplicates = false;
          }
        }
      }
      return;
    }
  } catch (err) {
    console.error("Inventory: failed to load from Sheets:", err.message);
    throw err; // propagate to trigger Sheets-unavailable guard
  }
}

/**
 * Merge in-memory inventory rows that share a barcode into the first occurrence,
 * summing quantities. Returns the orphan sheet rows (to delete) and the surviving
 * rows whose quantity changed (to rewrite) so the caller can sync the sheet.
 * @returns {{orphanRows: number[], survivors: {sheetRowNumber: number, qty: string}[]}}
 */
function mergeDuplicatesByBarcode() {
  const seen = new Map();
  const toRemove = [];
  const orphanRows = [];
  const changedSurvivors = new Set();

  inventoryData.forEach((item, idx) => {
    if (!item.Barcode) return;

    if (seen.has(item.Barcode)) {
      const firstIdx = seen.get(item.Barcode);
      const first = inventoryData[firstIdx];
      const qty1 = parseFloat(first.Qty) || 0;
      const qty2 = parseFloat(item.Qty) || 0;
      first.Qty = (qty1 + qty2).toString();
      if (item.sheetRowNumber) orphanRows.push(item.sheetRowNumber);
      changedSurvivors.add(firstIdx);
      toRemove.push(idx);
    } else {
      seen.set(item.Barcode, idx);
    }
  });

  const survivors = [...changedSurvivors].map(i => ({
    sheetRowNumber: inventoryData[i].sheetRowNumber,
    qty: inventoryData[i].Qty
  }));

  toRemove.reverse().forEach(idx => {
    inventoryData.splice(idx, 1);
  });

  return { orphanRows, survivors };
}

function saveInventory() {
  // no-op: Sheets is the source of truth
}

function findItemByBarcode(barcode) {
  return inventoryData.find(i => {
    const barcodes = (i.Barcode || "").split(";").map(b => b.trim());
    return barcodes.includes(barcode);
  });
}

async function addItem(item) {
  const barcode = scannedProductData?.barcode || "";
  const quantity = parseFloat(item.quantity) || 0;

  if (quantity > 1000) {
    const confirmed = confirm(`⚠️ Quantité suspecte: ${quantity} ${item.unit}\n\nContinuer?`);
    if (!confirmed) return;
  }

  if (barcode) {
    const existing = inventoryData.find(i => (i.Barcode || "").split(";").map(b => b.trim()).includes(barcode));
    if (existing) {
      const existingQty = parseFloat(existing.Qty) || 0;
      existing.Qty = (existingQty + quantity).toString();

      if (item.price) {
        existing.Prix = item.price;
      }

      saveInventory();

      if (typeof isAuthenticated === "function" && isAuthenticated() && window.SheetsAPI) {
        try {
          const token = getAccessToken();
          const range = `Inventory!D${existing.sheetRowNumber}`;
          window.SheetsAPI.updateSheetCell(range, existing.Qty, token)
            .catch(err => console.error("Failed to update Sheets:", err));
        } catch (err) {
          console.error("Error updating Sheets:", err);
        }
      }

      scannedProductData = null;
      document.getElementById("add-item-form").reset();
      document.getElementById("product-info").style.display = "none";
      renderInventory();
      return;
    }
  }

  if (item.product_name) {
    const existingByName = inventoryData.find(i => i.Produit?.toLowerCase() === item.product_name.toLowerCase());
    if (existingByName) {
      const existingQty = parseFloat(existingByName.Qty) || 0;
      existingByName.Qty = (existingQty + quantity).toString();

      if (item.price) {
        existingByName.Prix = item.price;
      }

      if (barcode && !existingByName.Barcode.includes(barcode)) {
        existingByName.Barcode = existingByName.Barcode ? `${existingByName.Barcode};${barcode}` : barcode;
      }

      saveInventory();

      if (typeof isAuthenticated === "function" && isAuthenticated() && window.SheetsAPI) {
        try {
          const token = getAccessToken();
          const range = `Inventory!D${existingByName.sheetRowNumber}`;
          window.SheetsAPI.updateSheetCell(range, existingByName.Qty, token)
            .catch(err => console.error("Failed to update Sheets:", err));
        } catch (err) {
          console.error("Error updating Sheets:", err);
        }
      }

      scannedProductData = null;
      document.getElementById("add-item-form").reset();
      document.getElementById("product-info").style.display = "none";
      renderInventory();
      return;
    }
  }

  const newItem = {
    id: Date.now(),
    Produit: item.product_name,
    Qty: quantity.toString(),
    Unité: item.unit,
    Catégorie: item.category,
    Date_ajout: Utils.getTodayISO(),
    Péremption: item.expiry_date,
    Consommé: false,
    Barcode: barcode,
    Prix: item.price || "",
    Conversion_factor: item.conversion_factor || "",
    calories_per_100: parseFloat(item.calories_per_100) || scannedProductData?.calories || null,
    proteins: scannedProductData?.proteins || null,
    fats: scannedProductData?.fats || null,
    carbs: scannedProductData?.carbs || null,
    allergens: scannedProductData?.allergens || "—"
  };

  inventoryData.push(newItem);
  saveInventory();

  if (typeof isAuthenticated === "function" && isAuthenticated()) {
    const token = getAccessToken();
    const row = [
      newItem.Barcode,
      newItem.Produit,
      newItem.Catégorie,
      newItem.Qty,
      newItem.Unité,
      newItem.Conversion_factor || "",
      newItem.Date_ajout,
      newItem.Péremption,
      newItem.Prix,
      newItem.calories_per_100,
      newItem.proteins,
      newItem.fats,
      newItem.carbs,
      newItem.allergens,
      newItem.cooking_factor || 1.0
    ];

    // Append at the bottom (no sheet-side sort: rows stay stable so sheetRowNumbers
    // remain valid; display sorting is handled by renderInventory). Reload to assign
    // the new row's sheetRowNumber.
    SheetsAPI.appendRowWithToken("Inventory", row, token)
      .then(async () => {
        await loadInventory();
        window.inventoryData = inventoryData;
        renderInventory();
        if (window.Toast) Toast.success(`${newItem.Produit} ajouté ✓`);
      })
      .catch(err => {
        console.error("Failed to sync to Sheets:", err);
        if (window.Toast) Toast.error("Échec de l'ajout sur Google Sheets.");
      });
  }

  scannedProductData = null;
  document.getElementById("add-item-form").reset();
  document.getElementById("product-info").style.display = "none";
  document.getElementById("add-item-section").style.display = "none";

  window.inventoryData = inventoryData;

  renderInventory();
}

async function markConsumed(itemId) {
  const item = inventoryData.find(i => i.id === itemId);
  if (!item) return;

  item.Qty = "0";
  saveInventory();

  if (item.sheetRowNumber && window.SheetsAPI) {
    try {
      const token = typeof getAccessToken === 'function' ? getAccessToken() : null;
      const range = `Inventory!D${item.sheetRowNumber}`;
      await window.SheetsAPI.updateSheetCell(range, "0", token);
    } catch (err) {
      console.warn(`Failed to update Sheets for item ${itemId}:`, err);
    }
  }

  renderInventory();
}

async function deleteItem(itemId) {
  const item = inventoryData.find(i => i.id === itemId);
  if (!item) return;

  item.Qty = "0";
  saveInventory();

  if (item.sheetRowNumber && window.SheetsAPI) {
    try {
      const range = `Inventory!D${item.sheetRowNumber}`;
      await window.SheetsAPI.updateSheetCell(range, "0");
    } catch (err) {
      console.warn(`Failed to update Sheets for item ${itemId}:`, err);
    }
  }

  renderInventory();
}

window.InventoryAPI = {
  getData: () => inventoryData,
  findByBarcode: (barcode) => {
    return inventoryData.find(i => i.Barcode === barcode);
  },
  searchByName: (query, activeOnly = true) => {
    const lowerQuery = (query || "").toLowerCase();
    return inventoryData.filter(item => {
      const matches = item.Produit.toLowerCase().includes(lowerQuery);
      const isActive = activeOnly ? (parseFloat(item.Qty) || 0) > 0 : true;
      return matches && isActive;
    });
  },
  getActiveItems: () => {
    return inventoryData
      .filter(item => {
        const qtyNum = parseFloat(item.Qty) || 0;
        return qtyNum > 0;
      })
      .map(item => ({
        id: item.id,
        name: item.Produit,
        barcode: item.Barcode,
        category: item.Catégorie,
        calories_per_100: item.calories_per_100,
        unit: item.Unité,
        qty: parseFloat(item.Qty) || 0
      }))
      .sort((a, b) => {
        if (a.category !== b.category) {
          return a.category.localeCompare(b.category, 'fr');
        }
        return a.name.localeCompare(b.name, 'fr');
      });
  }
};

// Auto-initialize inventory when file loads (for use in recettes.html and other pages)
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    loadInventory().then(() => {
      window.inventoryData = inventoryData;
    });
  });
} else {
  // DOM already loaded
  loadInventory().then(() => {
    window.inventoryData = inventoryData;
  });
}
