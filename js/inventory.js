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
    return;
  }

  status.textContent = `✅ Produit trouvé: ${product.name}`;
  status.classList.remove("error");
  status.classList.add("success");

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
      inventoryData = objects.map((row, idx) => ({
        id: `sheet_${idx + 2}`, // Store actual Sheets row number (1-indexed + header)
        sheetRowNumber: idx + 2,
        Produit: row["Produit"] || "",
        Qty: row["Qty"] || "",
        Unité: row["Unité"] || "g",
        Catégorie: row["Catégorie"] || "Autres",
        Date_ajout: row["Date_ajout"] || Utils.getTodayISO(),
        Péremption: row["Péremption"] || "",
        Consommé: row["Consommé"] === "TRUE" || row["Consommé"] === true,
        Barcode: row["Barcode"] || "",
        Prix: row["Prix"] || ""
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
    const existing = inventoryData.find(i => i.Barcode === barcode && !i.Consommé);
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

      // Sync update to Sheets
      if (typeof isAuthenticated === "function" && isAuthenticated() && window.SheetsAPI) {
        try {
          const token = getAccessToken();
          const range = `Inventory!B${existing.sheetRowNumber}`;
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
    const row = [
      newItem.Produit,
      newItem.Qty,
      newItem.Unité,
      newItem.Catégorie,
      newItem.Date_ajout,
      newItem.Péremption,
      newItem.Consommé,
      newItem.Barcode,
      newItem.Prix,
      newItem.calories_per_100,
      newItem.proteins,
      newItem.fats,
      newItem.carbs,
      newItem.allergens
    ];

    SheetsAPI.appendRowWithToken("Inventory", row, token)
      .then(() => console.log("Item synced to Sheets"))
      .catch(err => console.error("Failed to sync to Sheets:", err));
  }

  scannedProductData = null;

  // Clear form
  document.getElementById("add-item-form").reset();
  document.getElementById("product-info").style.display = "none";

  renderInventory();
}

/**
 * Mark item as consumed (updates Sheets if available)
 * @param {string} itemId
 */
async function markConsumed(itemId) {
  const item = inventoryData.find(i => i.id === itemId);
  if (!item) return;

  item.Consommé = true;
  saveInventory();

  // Update Sheets if row number is available
  if (item.sheetRowNumber && window.SheetsAPI) {
    try {
      const range = `Inventory!G${item.sheetRowNumber}`; // Column G is "Consommé"
      await window.SheetsAPI.updateSheetCell(range, "TRUE");
      console.log(`Marked as consumed in Sheets: row ${item.sheetRowNumber}`);
    } catch (err) {
      console.warn(`Failed to update Sheets for item ${itemId}:`, err);
    }
  }

  renderInventory();
}

/**
 * Delete item from inventory (removes from Sheets if available)
 * @param {string} itemId
 */
async function deleteItem(itemId) {
  const item = inventoryData.find(i => i.id === itemId);
  const hadSheetRow = item && item.sheetRowNumber;

  inventoryData = inventoryData.filter(i => i.id !== itemId);
  saveInventory();

  // Delete from Sheets if row number is available
  if (hadSheetRow && window.SheetsAPI) {
    try {
      const range = `Inventory!A${item.sheetRowNumber}:L${item.sheetRowNumber}`;
      await window.SheetsAPI.clearSheetRange(range);
      console.log(`Deleted from Sheets: row ${item.sheetRowNumber}`);
    } catch (err) {
      console.warn(`Failed to delete from Sheets for item ${itemId}:`, err);
    }
  }

  renderInventory();
}

// ============================================================================
// RENDERING
// ============================================================================

/**
 * Render inventory list, applying category filter
 */
function renderInventory() {
  const container = document.getElementById("inventory-list");
  const filterValue = document.getElementById("filter-category").value;

  const filtered = filterValue
    ? inventoryData.filter(item => item.Catégorie === filterValue && !item.Consommé)
    : inventoryData.filter(item => !item.Consommé);

  if (filtered.length === 0) {
    container.innerHTML = '<div class="inventory-empty">Aucun article</div>';
    return;
  }

  container.innerHTML = "";
  filtered.forEach(item => {
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

  // Header: name + category
  const headerDiv = document.createElement("div");
  headerDiv.className = "inventory-item-header";

  const nameH3 = document.createElement("h3");
  nameH3.className = "inventory-item-name";
  nameH3.textContent = item.Produit;

  const categorySpan = document.createElement("span");
  categorySpan.className = "inventory-item-category";
  categorySpan.textContent = item.Catégorie;

  headerDiv.appendChild(nameH3);
  headerDiv.appendChild(categorySpan);

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

  const consumeBtn = document.createElement("button");
  consumeBtn.className = "btn-consume";
  consumeBtn.textContent = "✓ Consommé";
  consumeBtn.addEventListener("click", () => markConsumed(item.id));

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "btn-delete";
  deleteBtn.textContent = "🗑️ Supprimer";
  deleteBtn.addEventListener("click", () => deleteItem(item.id));

  actionsDiv.appendChild(consumeBtn);
  actionsDiv.appendChild(deleteBtn);

  div.appendChild(mainDiv);
  div.appendChild(actionsDiv);

  return div;
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Set up form and button event handlers
 */
function setupEventHandlers() {
  // UPC manual lookup
  document.getElementById("btn-lookup-upc").addEventListener("click", async function() {
    const upc = document.getElementById("field-upc").value.trim();
    if (!upc) {
      alert("Entrez un code-barres");
      return;
    }
    const status = document.getElementById("scanner-status");
    status.textContent = "⏳ Recherche produit...";
    const product = await fetchProductFromOpenFoodFacts(upc);
    if (!product) {
      status.textContent = "❌ Produit non trouvé. Entrez manuellement.";
      status.classList.add("error");
      return;
    }
    status.textContent = `✅ Produit trouvé: ${product.name}`;
    status.classList.remove("error");
    status.classList.add("success");
    document.getElementById("field-product-name").value = product.name;
    scannedProductData = product;
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
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 7);
    document.getElementById("field-expiry").value = expiryDate.toISOString().split("T")[0];
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
