/**
 * @fileoverview Inventory page logic for MealFlow
 * Barcode scanning via Quagga.js, Open Food Facts API integration,
 * inventory management with Sheets persistence.
 */

// ============================================================================
// MODULE STATE
// ============================================================================

/** @type {Object[]} Inventory items array */
let inventoryData = [];

/** @type {boolean} Scanner active state */
let scannerActive = false;

/** @type {Object} Scanned product data (from Open Food Facts) */
let scannedProductData = null;

/** @type {Html5Qrcode} HTML5 QR Code scanner instance */
let qrScanner = null;

// ============================================================================
// OPEN FOOD FACTS API
// ============================================================================

/**
 * Fetch product info from Open Food Facts API by barcode.
 * @param {string} barcode - Product barcode
 * @returns {Promise<Object|null>} Product data or null if not found
 */
async function fetchProductFromOpenFoodFacts(barcode) {
  try {
    console.log("Fetching product for barcode:", barcode);

    // Try world.openfoodfacts.org first
    const url = `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`;
    console.log("API URL:", url);

    const response = await fetch(url);
    console.log("API response status:", response.status);

    if (!response.ok) {
      console.warn(`Product not found (${response.status}): ${barcode}`);
      return null;
    }

    const data = await response.json();
    console.log("API response data:", data);

    if (data.status === 0) {
      console.warn(`Product not found (status 0): ${barcode}`);
      return null;
    }

    const product = data.product;
    if (!product) {
      console.warn("No product object in response");
      return null;
    }

    // Parse quantity to extract number and unit
    let qty = 1;
    let unit = "pièce";
    const quantityStr = product.quantity || "";

    const match = quantityStr.match(/^([\d.]+)\s*([a-zA-Z]+)$/);
    if (match) {
      qty = parseFloat(match[1]);
      const unitStr = match[2].toLowerCase();
      // Map common abbreviations to form options
      if (unitStr.includes("ml")) unit = "ml";
      else if (unitStr.includes("l")) unit = "litre";
      else if (unitStr.includes("g")) unit = "g";
      else unit = unitStr;
    }

    // Extract category from categories string
    let category = "Autres";
    const categoriesStr = product.categories || "";
    const catLower = categoriesStr.toLowerCase();

    // Priority mapping: check most specific first (Féculents/Starches BEFORE Légumes to avoid matching "blé")
    const categoryMap = [
      // Starches FIRST (before vegetables)
      { patterns: ["féculents", "riz", "pâtes", "pain", "pasta", "céréales"], category: "Féculents" },
      // Dairy
      { patterns: ["fromage", "yaourt", "lait", "beurre", "crème"], category: "Produits laitiers" },
      // Vegetables (after starches to avoid "blé" confusion)
      { patterns: ["maïs", "légume", "vegetable", "corn", "carotte", "brocoli", "épinard", "poele", "poêle"], category: "Légumes" },
      // Fruits
      { patterns: ["fruit", "pomme", "banane", "orange", "raisin"], category: "Fruits" },
      // Meat
      { patterns: ["viande", "meat", "poulet", "boeuf", "porc"], category: "Viandes" },
      // Fish
      { patterns: ["poisson", "fish", "saumon", "trout"], category: "Poissons" },
      // Eggs
      { patterns: ["œuf", "egg"], category: "Œufs" },
      // Canned/Conserves
      { patterns: ["conserve", "canned", "en boîte", "en conserve"], category: "Conserves" },
      // Spices & Condiments
      { patterns: ["épice", "condiment", "sauce", "sirop"], category: "Épices & Condiments" },
      // Drinks
      { patterns: ["boisson", "drink", "jus"], category: "Boissons" }
    ];

    for (const map of categoryMap) {
      if (map.patterns.some(p => catLower.includes(p))) {
        category = map.category;
        break;
      }
    }

    return {
      name: product.product_name || product.generic_name || "Produit inconnu",
      quantity: qty,
      unit: unit,
      category: category,
      calories: product.nutriments?.["energy-kcal"] || null,
      proteins: product.nutriments?.proteins || null,
      fats: product.nutriments?.fat || null,
      carbs: product.nutriments?.carbohydrates || null,
      allergens: product.allergens_tags ? product.allergens_tags.join(", ") : "Aucune",
      barcode: barcode
    };
  } catch (err) {
    console.error("OpenFoodFacts API error:", err);
    console.error("Error type:", err.constructor.name);
    console.error("Error message:", err.message);
    return null;
  }
}

// ============================================================================
// BARCODE SCANNER
// ============================================================================

/**
 * Start barcode scanner with html5-qrcode
 */
function startScanner() {
  const status = document.getElementById("scanner-status");
  const container = document.getElementById("scanner-video");

  // Check if html5-qrcode is loaded
  if (typeof Html5Qrcode === "undefined") {
    status.textContent = "❌ Erreur: Html5Qrcode non chargé";
    status.classList.add("error");
    console.error("Html5Qrcode library not loaded");
    return;
  }

  container.style.display = "block";
  container.style.height = "400px";
  scannerActive = true;
  status.textContent = "⏳ Initialisation caméra...";

  console.log("Starting Html5Qrcode scanner");

  // Create scanner instance
  qrScanner = new Html5Qrcode("scanner-video");

  qrScanner.start(
    { facingMode: "environment" },
    {
      fps: 10,
      qrbox: { width: 280, height: 280 }
    },
    function(decodedText, decodedResult) {
      console.log("Barcode detected:", decodedText);
      stopScanner();
      processBarcodeDetection(decodedText);
    },
    function(errorMessage) {
      // Ignore scanning errors
    }
  ).catch(err => {
    console.error("Scanner start error:", err);
    status.textContent = `❌ Erreur caméra: ${err.message || err}`;
    status.classList.add("error");
    scannerActive = false;
    container.style.display = "none";
  });

  status.textContent = "📹 Scanner actif — Dirigez vers code-barre";
  status.classList.remove("error");
  status.classList.add("success");
}

/**
 * Stop barcode scanner
 */
function stopScanner() {
  if (!scannerActive || !qrScanner) return;

  qrScanner.stop().then(() => {
    console.log("Scanner stopped");
    scannerActive = false;
    qrScanner = null;

    const container = document.getElementById("scanner-video");
    container.style.display = "none";

    document.getElementById("btn-start-scanner").style.display = "inline-block";
    document.getElementById("btn-stop-scanner").style.display = "none";
  }).catch(err => {
    console.error("Error stopping scanner:", err);
    scannerActive = false;
    qrScanner = null;
  });
}

/**
 * Process detected barcode: fetch product data, populate form
 * @param {string} barcode
 */
async function processBarcodeDetection(barcode) {
  const status = document.getElementById("scanner-status");
  status.textContent = "⏳ Recherche produit...";

  const product = await fetchProductFromOpenFoodFacts(barcode);

  if (!product) {
    status.textContent = "❌ Produit non trouvé. Entrez manuellement.";
    status.classList.add("error");
    // Show form for manual entry
    document.getElementById("add-item-section").style.display = "block";
    return;
  }

  status.textContent = `✅ Produit trouvé: ${product.name}`;
  status.classList.remove("error");
  status.classList.add("success");

  // Show form section
  document.getElementById("add-item-section").style.display = "block";

  // Populate form
  document.getElementById("field-product-name").value = product.name;

  // Warn if quantity looks suspicious
  if (product.quantity > 100) {
    console.warn(`⚠️ Suspicious quantity from API: ${product.quantity} ${product.unit}. User should verify.`);
    status.textContent += ` ⚠️ Vérifiez la quantité`;
  }

  document.getElementById("field-quantity").value = product.quantity || 1;
  document.getElementById("field-unit").value = product.unit || "pièce";
  document.getElementById("field-category").value = product.category || "Autres";
  scannedProductData = product;

  // Show product info
  const infoSection = document.getElementById("product-info");
  infoSection.style.display = "grid";

  if (product.calories) {
    document.getElementById("info-calories").textContent = product.calories.toFixed(1) + " kcal";
  }
  if (product.proteins) {
    document.getElementById("info-proteins").textContent = product.proteins.toFixed(1) + "g";
  }
  if (product.fats) {
    document.getElementById("info-fats").textContent = product.fats.toFixed(1) + "g";
  }
  if (product.carbs) {
    document.getElementById("info-carbs").textContent = product.carbs.toFixed(1) + "g";
  }
  document.getElementById("info-allergens").textContent = product.allergens;

  // Auto-set default expiry (7 days from now)
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 7);
  document.getElementById("field-expiry").value = expiryDate.toISOString().split("T")[0];
}

// ============================================================================
// INVENTORY MANAGEMENT
// ============================================================================

/**
 * Auto-sort Inventory sheet by Catégorie column
 * @param {string} accessToken - OAuth2 access token
 */
async function sortSheetByCategory(accessToken) {
  if (!window.SheetsAPI || !accessToken) return;

  try {
    const sheetId = window.SheetsAPI.getSheetId ? window.SheetsAPI.getSheetId() : null;
    if (!sheetId) {
      console.warn("Sheet ID not available for sorting");
      return;
    }

    // Get current sheet data to find last row
    const rows = await window.SheetsAPI.readSheetTab("Inventory");
    if (!rows || rows.length < 2) return; // Header only

    const lastRow = rows.length;

    // Construct batchUpdate request to sort by Catégorie (column C = index 2)
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`;
    const body = {
      requests: [
        {
          sortRange: {
            range: {
              sheetId: 0, // Assuming "Inventory" is first sheet
              startRowIndex: 1, // Skip header
              endRowIndex: lastRow,
              startColumnIndex: 0,
              endColumnIndex: 13 // All columns A-M
            },
            sortSpecs: [
              {
                dimensionIndex: 2, // Column C (Catégorie)
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

/**
 * Load inventory from Sheets "Inventory" tab.
 * Falls back to localStorage if Sheets unavailable.
 * @returns {Promise<void>}
 */
async function loadInventory() {
  try {
    const rows = await SheetsAPI.readSheetTab("Inventory");
    const objects = SheetsAPI.rowsToObjects(rows);

    if (objects.length > 0) {
      // Row 0 is header, data starts at row 1
      // New column order: Barcode, Produit, Catégorie, Qty, Unité, Date_ajout, Péremption, Prix, Calories_per_100, Proteins, Fats, Carbs, Allergens
      inventoryData = objects.map((row, idx) => ({
        id: `sheet_${idx + 2}`, // Store actual Sheets row number (1-indexed + header)
        sheetRowNumber: idx + 2,
        Barcode: row["Code barre"] || row["Barcode"] || "",
        Produit: row["Produit"] || "",
        Catégorie: row["Catégorie"] || "Autres",
        Qty: row["Qty"] || "",
        Unité: row["Unité"] || "g",
        Date_ajout: row["Date_ajout"] || Utils.getTodayISO(),
        Péremption: row["Péremption"] || "",
        Prix: row["Prix"] || "",
        calories_per_100: row["Calories_per_100"] || "",
        proteins: row["Proteins"] || "",
        fats: row["Fats"] || "",
        carbs: row["Carbs"] || "",
        allergens: row["Allergens"] || ""
      }));
      console.log("Inventory loaded from Sheets:", inventoryData.length, "items");
      return;
    }
  } catch (err) {
    console.warn("Inventory: Sheets API unavailable, using localStorage", err.message);
  }

  // Load from localStorage
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

/**
 * Save inventory to localStorage (and optionally to Sheets later)
 */
function saveInventory() {
  localStorage.setItem("mealflow_inventory", JSON.stringify(inventoryData));
  console.log("Inventory saved to localStorage");

  // TODO: Save to Sheets API when write access is available
}

/**
 * Add new item to inventory (or add to existing if barcode exists)
 * @param {Object} item - Inventory item
 */
async function addItem(item) {
  const barcode = scannedProductData?.barcode || "";
  const quantity = parseFloat(item.quantity) || 0;

  // Validate quantity (flag suspicious values)
  if (quantity > 1000) {
    const confirmed = confirm(`⚠️ Quantité suspecte: ${quantity} ${item.unit}\n\nContinuer?`);
    if (!confirmed) {
      return;
    }
  }

  // Check if product exists by barcode
  if (barcode) {
    const existing = inventoryData.find(i => i.Barcode === barcode && (parseFloat(i.Qty) || 0) > 0);
    if (existing) {
      // Product exists, add to quantity
      const existingQty = parseFloat(existing.Qty) || 0;
      existing.Qty = (existingQty + quantity).toString();

      // Update price if provided
      if (item.price) {
        existing.Prix = item.price;
      }

      console.log(`Added ${quantity} to existing ${existing.Produit}: new qty = ${existing.Qty}`);
      saveInventory();

      // Sync update to Sheets (Qty is now in column D with new order)
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

  // New product - create new item
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
    calories_per_100: scannedProductData?.calories || null,
    proteins: scannedProductData?.proteins || null,
    fats: scannedProductData?.fats || null,
    carbs: scannedProductData?.carbs || null,
    allergens: scannedProductData?.allergens || "—"
  };

  inventoryData.push(newItem);
  saveInventory();

  // Sync to Sheets if authenticated
  if (typeof isAuthenticated === "function" && isAuthenticated()) {
    const token = getAccessToken();
    // New column order: Barcode, Produit, Catégorie, Qty, Unité, Date_ajout, Péremption, Prix, Calories_per_100, Proteins, Fats, Carbs, Allergens
    const row = [
      newItem.Barcode,
      newItem.Produit,
      newItem.Catégorie,
      newItem.Qty,
      newItem.Unité,
      newItem.Date_ajout,
      newItem.Péremption,
      newItem.Prix,
      newItem.calories_per_100,
      newItem.proteins,
      newItem.fats,
      newItem.carbs,
      newItem.allergens
    ];

    SheetsAPI.appendRowWithToken("Inventory", row, token)
      .then(() => {
        console.log("Item synced to Sheets");
        // Auto-sort by Catégorie after add
        sortSheetByCategory(token);
      })
      .catch(err => console.error("Failed to sync to Sheets:", err));
  }

  scannedProductData = null;

  // Clear form
  document.getElementById("add-item-form").reset();
  document.getElementById("product-info").style.display = "none";
  document.getElementById("add-item-section").style.display = "none"; // Hide form after add

  renderInventory();
}

/**
 * Mark item as consumed (sets Qty to 0, preserves data)
 * @param {string} itemId
 */
async function markConsumed(itemId) {
  const item = inventoryData.find(i => i.id === itemId);
  if (!item) return;

  // Set quantity to 0 instead of deleting
  item.Qty = "0";
  saveInventory();

  // Update Sheets if row number is available (Qty is now column D with new order)
  if (item.sheetRowNumber && window.SheetsAPI) {
    try {
      const range = `Inventory!D${item.sheetRowNumber}`; // Column D is "Qty"
      await window.SheetsAPI.updateSheetCell(range, "0");
      console.log(`Marked as consumed in Sheets: row ${item.sheetRowNumber}`);
    } catch (err) {
      console.warn(`Failed to update Sheets for item ${itemId}:`, err);
    }
  }

  renderInventory();
}

/**
 * Delete item from inventory (sets Qty to 0, preserves data)
 * @param {string} itemId
 */
async function deleteItem(itemId) {
  const item = inventoryData.find(i => i.id === itemId);
  if (!item) return;

  // Set quantity to 0 instead of deleting row
  item.Qty = "0";
  saveInventory();

  // Update Sheets if row number is available (Qty is now column D with new order)
  if (item.sheetRowNumber && window.SheetsAPI) {
    try {
      const range = `Inventory!D${item.sheetRowNumber}`; // Column D is "Qty"
      await window.SheetsAPI.updateSheetCell(range, "0");
      console.log(`Deleted from inventory: row ${item.sheetRowNumber}`);
    } catch (err) {
      console.warn(`Failed to update Sheets for item ${itemId}:`, err);
    }
  }

  renderInventory();
}

// ============================================================================
// RENDERING
// ============================================================================

/**
 * Reduce quantity by user-specified amount
 * @param {string} itemId
 * @param {string} currentQty
 * @param {string} productName
 */
async function reduceQuantity(itemId, currentQty, productName) {
  const currentNum = parseFloat(currentQty) || 0;
  const input = prompt(`Quantité à consommer/supprimer (max ${currentNum}):`);

  if (input === null) return; // User cancelled

  const reduceAmount = parseFloat(input);
  if (isNaN(reduceAmount) || reduceAmount <= 0) {
    alert("Quantité invalide");
    return;
  }

  if (reduceAmount > currentNum) {
    alert(`Quantité trop élevée. Max: ${currentNum}`);
    return;
  }

  const item = inventoryData.find(i => i.id === itemId);
  if (!item) return;

  // Reduce quantity
  const newQty = Math.max(0, currentNum - reduceAmount);
  item.Qty = newQty.toString();

  saveInventory();

  // Update Sheets (column D is Qty)
  if (item.sheetRowNumber && window.SheetsAPI) {
    try {
      const token = typeof getAccessToken === 'function' ? getAccessToken() : null;
      const range = `Inventory!D${item.sheetRowNumber}`;
      await window.SheetsAPI.updateSheetCell(range, newQty.toString(), token);
      console.log(`Reduced ${productName} by ${reduceAmount}: new qty = ${newQty}`);
    } catch (err) {
      console.warn(`Failed to update Sheets for item ${itemId}:`, err);
    }
  }

  renderInventory();
}

/**
 * Render inventory list, applying category filter
 */
function renderInventory() {
  const container = document.getElementById("inventory-list");
  const filterValue = document.getElementById("filter-category").value;

  let filtered = filterValue
    ? inventoryData.filter(item => item.Catégorie === filterValue && (parseFloat(item.Qty) || 0) > 0)
    : inventoryData.filter(item => (parseFloat(item.Qty) || 0) > 0);

  if (filtered.length === 0) {
    container.innerHTML = '<div class="inventory-empty">Aucun article</div>';
    return;
  }

  // Sort by category, then by product name (alphabetically)
  filtered.sort((a, b) => {
    if (a.Catégorie !== b.Catégorie) {
      return a.Catégorie.localeCompare(b.Catégorie, 'fr');
    }
    return a.Produit.localeCompare(b.Produit, 'fr');
  });

  container.innerHTML = "";
  let currentCategory = null;

  filtered.forEach(item => {
    // Add category header if category changed
    if (item.Catégorie !== currentCategory) {
      currentCategory = item.Catégorie;
      const catHeader = document.createElement("div");
      catHeader.className = "category-header";
      catHeader.textContent = currentCategory;
      container.appendChild(catHeader);
    }

    const itemEl = createInventoryItemElement(item);
    container.appendChild(itemEl);
  });
}

/**
 * Create inventory item DOM element
 * @param {Object} item
 * @returns {HTMLElement}
 */
function createInventoryItemElement(item) {
  const div = document.createElement("div");
  div.className = "inventory-item";

  const expiryDate = new Date(item.Péremption);
  const today = new Date();
  const daysLeft = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) {
    div.classList.add("expired");
  } else if (daysLeft <= 3) {
    div.classList.add("expiring-soon");
  }

  // Header: name + price
  const headerDiv = document.createElement("div");
  headerDiv.className = "inventory-item-header";

  const nameH3 = document.createElement("h3");
  nameH3.className = "inventory-item-name";
  nameH3.textContent = item.Produit;

  const priceSpan = document.createElement("span");
  priceSpan.className = "inventory-item-price";
  priceSpan.textContent = item.Prix ? `${item.Prix}€` : "—";

  headerDiv.appendChild(nameH3);
  headerDiv.appendChild(priceSpan);

  // Content: quantity, calories, macros, allergens
  const contentDiv = document.createElement("div");
  contentDiv.className = "inventory-item-content";

  // Quantity
  const qtyDiv = document.createElement("div");
  qtyDiv.className = "inventory-item-stat";
  const qtyLabel = document.createElement("span");
  qtyLabel.className = "stat-label";
  qtyLabel.textContent = "Quantité";
  const qtyValue = document.createElement("span");
  qtyValue.className = "stat-value";
  qtyValue.textContent = `${item.Qty} ${item.Unité}`;
  qtyDiv.appendChild(qtyLabel);
  qtyDiv.appendChild(qtyValue);
  contentDiv.appendChild(qtyDiv);

  // Calories
  if (item.calories_per_100) {
    const calDiv = document.createElement("div");
    calDiv.className = "inventory-item-stat";
    const calLabel = document.createElement("span");
    calLabel.className = "stat-label";
    calLabel.textContent = "Calories/100g";
    const calValue = document.createElement("span");
    calValue.className = "stat-value";
    calValue.textContent = item.calories_per_100.toFixed(0) + " kcal";
    calDiv.appendChild(calLabel);
    calDiv.appendChild(calValue);
    contentDiv.appendChild(calDiv);
  }

  // Expiry
  const expiryDiv = document.createElement("div");
  expiryDiv.className = "inventory-item-expiry";
  if (daysLeft < 0) {
    expiryDiv.classList.add("expired");
    expiryDiv.textContent = "❌ Expiré";
  } else if (daysLeft <= 3) {
    expiryDiv.classList.add("expiring");
    expiryDiv.textContent = `⚠️ ${daysLeft} jour(s) restant(s)`;
  } else {
    expiryDiv.textContent = `📅 ${Utils.formatDate(item.Péremption)}`;
  }

  // Allergens
  if (item.allergens && item.allergens !== "—") {
    const allergyDiv = document.createElement("div");
    allergyDiv.className = "inventory-item-stat";
    const allergyLabel = document.createElement("span");
    allergyLabel.className = "stat-label";
    allergyLabel.textContent = "Allergènes";
    const allergyValue = document.createElement("span");
    allergyValue.className = "stat-value";
    allergyValue.textContent = item.allergens;
    allergyDiv.appendChild(allergyLabel);
    allergyDiv.appendChild(allergyValue);
    contentDiv.appendChild(allergyDiv);
  }

  // Main content container
  const mainDiv = document.createElement("div");
  mainDiv.appendChild(headerDiv);
  mainDiv.appendChild(contentDiv);
  mainDiv.appendChild(expiryDiv);

  // Actions
  const actionsDiv = document.createElement("div");
  actionsDiv.className = "inventory-item-actions";

  const editBtn = document.createElement("button");
  editBtn.className = "btn-edit";
  editBtn.textContent = "✏️ Corriger";
  editBtn.addEventListener("click", () => openEditModal(item));

  const consumeBtn = document.createElement("button");
  consumeBtn.className = "btn-consume";
  consumeBtn.textContent = "✓ Consommer/Supprimer";
  consumeBtn.addEventListener("click", () => reduceQuantity(item.id, item.Qty, item.Produit));

  actionsDiv.appendChild(editBtn);
  actionsDiv.appendChild(consumeBtn);

  div.appendChild(mainDiv);
  div.appendChild(actionsDiv);

  return div;
}

// ============================================================================
// EDIT MODAL
// ============================================================================

/**
 * Open edit modal and populate with item data
 * @param {object} item - Item to edit
 */
function openEditModal(item) {
  const modal = document.getElementById("edit-modal");
  document.getElementById("edit-product-name").value = item.Produit;
  document.getElementById("edit-quantity").value = item.Qty;
  document.getElementById("edit-unit").value = item.Unité;
  document.getElementById("edit-date-added").value = item.Date_ajout;
  document.getElementById("edit-expiry").value = item.Péremption;
  document.getElementById("edit-price").value = item.Prix || "";
  modal.setAttribute("aria-hidden", "false");
  modal.classList.remove("hidden");
  modal.setAttribute("data-item-id", item.id);
}

/**
 * Close edit modal
 */
function closeEditModal() {
  const modal = document.getElementById("edit-modal");
  modal.setAttribute("aria-hidden", "true");
  modal.classList.add("hidden");
  modal.removeAttribute("data-item-id");
}

/**
 * Save edited item
 */
async function saveEditedItem(e) {
  e.preventDefault();

  const itemId = document.getElementById("edit-modal").getAttribute("data-item-id");
  const item = inventoryData.find(i => i.id === itemId);
  if (!item) return;

  const updatedData = {
    Qty: document.getElementById("edit-quantity").value,
    Unité: document.getElementById("edit-unit").value,
    Date_ajout: document.getElementById("edit-date-added").value,
    Péremption: document.getElementById("edit-expiry").value,
    Prix: document.getElementById("edit-price").value || ""
  };

  Object.assign(item, updatedData);
  saveInventory();

  // Sync to Sheets if authenticated and row number exists
  if (typeof isAuthenticated === "function" && isAuthenticated() && item.sheetRowNumber) {
    const token = getAccessToken();
    const sheetRange = `Inventory!D${item.sheetRowNumber}`;
    try {
      await SheetsAPI.updateSheetCell(sheetRange, item.Qty, token);
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

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Set up form and button event handlers
 */
function setupEventHandlers() {
  // Populate category filter dynamically from inventory
  const categories = [...new Set(inventoryData.map(i => i.Catégorie))].sort();
  const filterSelect = document.getElementById("filter-category");
  categories.forEach(cat => {
    const option = document.createElement("option");
    option.value = cat;
    option.textContent = cat;
    filterSelect.appendChild(option);
  });

  // Scanner buttons
  document.getElementById("btn-start-scanner").addEventListener("click", function() {
    this.style.display = "none";
    document.getElementById("btn-stop-scanner").style.display = "inline-block";
    startScanner();
  });

  document.getElementById("btn-stop-scanner").addEventListener("click", function() {
    stopScanner();
    document.getElementById("btn-start-scanner").style.display = "inline-block";
    document.getElementById("btn-stop-scanner").style.display = "none";
  });

  // Form submission
  document.getElementById("add-item-form").addEventListener("submit", function(e) {
    e.preventDefault();

    const formData = {
      product_name: document.getElementById("field-product-name").value,
      quantity: document.getElementById("field-quantity").value,
      unit: document.getElementById("field-unit").value,
      category: document.getElementById("field-category").value,
      expiry_date: document.getElementById("field-expiry").value,
      price: document.getElementById("field-price").value || ""
    };

    if (!formData.product_name || !formData.quantity || !formData.unit || !formData.category || !formData.expiry_date) {
      alert("Veuillez remplir tous les champs.");
      return;
    }

    addItem(formData);
    renderInventory();
  });

  // Category filter
  document.getElementById("filter-category").addEventListener("change", renderInventory);

  // Edit form submission
  document.getElementById("edit-form").addEventListener("submit", saveEditedItem);

  // Close modal when clicking outside
  document.getElementById("edit-modal").addEventListener("click", function(e) {
    if (e.target === this) closeEditModal();
  });
}

/**
 * Main initialization
 */
async function initializeInventory() {
  // Apply user styling
  if (window.UserContext) {
    UserContext.applyUserStyling();
    UserContext.initializeUserToggle();
  }

  // Load and render
  await loadInventory();
  setupEventHandlers();
  renderInventory();
}

// ============================================================================
// BOOT
// ============================================================================

document.addEventListener("DOMContentLoaded", initializeInventory);
