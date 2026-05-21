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

    return {
      name: product.product_name || product.generic_name || "Produit inconnu",
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
 * Start barcode scanner with Quagga.js
 */
function startScanner() {
  const video = document.getElementById("scanner-video");
  const status = document.getElementById("scanner-status");
  const container = document.getElementById("scanner-container");

  // Check if Quagga is loaded
  if (typeof Quagga === "undefined") {
    status.textContent = "❌ Erreur: Quagga.js non chargé";
    status.classList.add("error");
    console.error("Quagga library not loaded");
    return;
  }

  // Ensure video is visible
  video.style.display = "block";
  container.style.display = "block";
  scannerActive = true;
  status.textContent = "⏳ Initialisation caméra...";

  console.log("Starting Quagga scanner initialization");

  Quagga.init(
    {
      inputStream: {
        name: "Live",
        type: "LiveStream",
        target: "#scanner-video",
        constraints: {
          width: 400,
          height: 400,
          facingMode: "environment"
        }
      },
      decoder: {
        readers: [
          "ean_reader",
          "ean_8_reader",
          "code_128_reader",
          "code_39_reader",
          "upc_reader",
          "upc_e_reader"
        ],
        debug: {
          showCanvas: true
        }
      }
    },
    function(err) {
      if (err) {
        console.error("Quagga init error details:", err);
        status.textContent = `❌ Erreur caméra: ${err.message || err}`;
        status.classList.add("error");
        scannerActive = false;
        video.style.display = "none";
        return;
      }

      console.log("Quagga initialized successfully");
      Quagga.start();
      status.textContent = "📹 Scanner actif — Dirigez vers code-barre";
      status.classList.remove("error");
      status.classList.add("success");
    }
  );

  Quagga.onDetected(function(result) {
    if (!scannerActive) return;

    const barcode = result.codeResult.code;
    console.log("Barcode detected:", barcode);

    stopScanner();
    processBarcodeDetection(barcode);
  });
}

/**
 * Stop barcode scanner
 */
function stopScanner() {
  if (!scannerActive) return;

  try {
    Quagga.stop();
  } catch (err) {
    console.error("Error stopping scanner:", err);
  }

  const video = document.getElementById("scanner-video");
  video.style.display = "none";
  scannerActive = false;

  document.getElementById("btn-start-scanner").style.display = "inline-block";
  document.getElementById("btn-stop-scanner").style.display = "none";
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
      inventoryData = objects.map((row, idx) => ({
        id: idx,
        Produit: row["Produit"] || "",
        Qty: row["Qty"] || "",
        Unité: row["Unité"] || "g",
        Catégorie: row["Catégorie"] || "Autres",
        Date_ajout: row["Date_ajout"] || Utils.getTodayISO(),
        Péremption: row["Péremption"] || "",
        Consommé: row["Consommé"] === "TRUE" || row["Consommé"] === true
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
 * Add new item to inventory
 * @param {Object} item - Inventory item
 */
function addItem(item) {
  const newItem = {
    id: Date.now(),
    Produit: item.product_name,
    Qty: item.quantity,
    Unité: item.unit,
    Catégorie: item.category,
    Date_ajout: Utils.getTodayISO(),
    Péremption: item.expiry_date,
    Consommé: false,
    calories_per_100: scannedProductData?.calories || null,
    proteins: scannedProductData?.proteins || null,
    fats: scannedProductData?.fats || null,
    carbs: scannedProductData?.carbs || null,
    allergens: scannedProductData?.allergens || "—"
  };

  inventoryData.push(newItem);
  saveInventory();
  scannedProductData = null;

  // Clear form
  document.getElementById("add-item-form").reset();
  document.getElementById("product-info").style.display = "none";

  renderInventory();
}

/**
 * Mark item as consumed
 * @param {number} itemId
 */
function markConsumed(itemId) {
  const item = inventoryData.find(i => i.id === itemId);
  if (item) {
    item.Consommé = true;
    saveInventory();
    renderInventory();
  }
}

/**
 * Delete item from inventory
 * @param {number} itemId
 */
function deleteItem(itemId) {
  inventoryData = inventoryData.filter(i => i.id !== itemId);
  saveInventory();
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
    const container = document.getElementById("scanner-container");
    container.style.display = "block";
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
      expiry_date: document.getElementById("field-expiry").value
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
