/**
 * Inventory data management: loading, saving, CRUD operations
 */

let inventoryData = [];
let scannedProductData = null;

async function sortSheetByCategory(accessToken) {
  if (!window.SheetsAPI || !accessToken) return;

  try {
    const sheetId = window.SheetsAPI.getSheetId ? window.SheetsAPI.getSheetId() : null;
    if (!sheetId) {
      console.warn("Sheet ID not available for sorting");
      return;
    }

    const rows = await window.SheetsAPI.readSheetTab("Inventory");
    if (!rows || rows.length < 2) return;

    const lastRow = rows.length;

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`;
    const body = {
      requests: [
        {
          sortRange: {
            range: {
              sheetId: 0,
              startRowIndex: 1,
              endRowIndex: lastRow,
              startColumnIndex: 0,
              endColumnIndex: 13
            },
            sortSpecs: [
              {
                dimensionIndex: 2,
                sortOrder: "ASCENDING"
              }
            ]
          }
        }
      ]
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (response.ok) {
      console.log("Inventory sorted by Catégorie");
    } else {
      console.warn("Failed to sort Inventory sheet:", response.statusText);
    }
  } catch (err) {
    console.error("Error sorting sheet:", err);
  }
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
        cooking_factor: parseFloat(row["Cooking_factor"]) || 1.0
      }));
      console.log("Inventory loaded from Sheets:", inventoryData.length, "items");
      mergeDuplicatesByBarcode();
      window.inventoryData = inventoryData;
      return;
    }
  } catch (err) {
    console.warn("Inventory: Sheets API unavailable, using localStorage", err.message);
  }

  const stored = localStorage.getItem("mealflow_inventory");
  if (stored) {
    try {
      inventoryData = JSON.parse(stored);
      console.log("Inventory loaded from localStorage:", inventoryData.length, "items");
    } catch (err) {
      console.error("Failed to parse localStorage inventory:", err);
      inventoryData = [];
    }
  }
}

function mergeDuplicatesByBarcode() {
  const seen = new Map();
  const toRemove = [];

  inventoryData.forEach((item, idx) => {
    if (!item.Barcode) return;

    if (seen.has(item.Barcode)) {
      const firstIdx = seen.get(item.Barcode);
      const first = inventoryData[firstIdx];
      const qty1 = parseFloat(first.Qty) || 0;
      const qty2 = parseFloat(item.Qty) || 0;
      first.Qty = (qty1 + qty2).toString();
      toRemove.push(idx);
      console.log(`Merged ${item.Produit}: ${qty1} + ${qty2} = ${first.Qty}`);
    } else {
      seen.set(item.Barcode, idx);
    }
  });

  toRemove.reverse().forEach(idx => {
    inventoryData.splice(idx, 1);
  });

  if (toRemove.length > 0) {
    console.log(`Inventory: merged ${toRemove.length} duplicate(s)`);
  }
}

function saveInventory() {
  localStorage.setItem("mealflow_inventory", JSON.stringify(inventoryData));
  console.log("Inventory saved to localStorage");
}

function findItemByBarcode(barcode) {
  return inventoryData.find(i => i.Barcode === barcode);
}

async function addItem(item) {
  const barcode = scannedProductData?.barcode || "";
  const quantity = parseFloat(item.quantity) || 0;

  if (quantity > 1000) {
    const confirmed = confirm(`⚠️ Quantité suspecte: ${quantity} ${item.unit}\n\nContinuer?`);
    if (!confirmed) return;
  }

  if (barcode) {
    const existing = inventoryData.find(i => i.Barcode === barcode);
    if (existing) {
      const existingQty = parseFloat(existing.Qty) || 0;
      existing.Qty = (existingQty + quantity).toString();

      if (item.price) {
        existing.Prix = item.price;
      }

      console.log(`Added ${quantity} to existing ${existing.Produit}: new qty = ${existing.Qty}`);
      saveInventory();

      if (typeof isAuthenticated === "function" && isAuthenticated() && window.SheetsAPI) {
        try {
          const token = getAccessToken();
          const range = `Inventory!D${existing.sheetRowNumber}`;
          window.SheetsAPI.updateSheetCell(range, existing.Qty, token)
            .then(() => console.log("Updated Sheets with new quantity"))
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

    SheetsAPI.appendRowWithToken("Inventory", row, token)
      .then(() => {
        console.log("Item synced to Sheets");
        sortSheetByCategory(token);
      })
      .catch(err => console.error("Failed to sync to Sheets:", err));
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
      const range = `Inventory!D${item.sheetRowNumber}`;
      await window.SheetsAPI.updateSheetCell(range, "0");
      console.log(`Marked as consumed in Sheets: row ${item.sheetRowNumber}`);
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
      console.log(`Deleted from inventory: row ${item.sheetRowNumber}`);
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
