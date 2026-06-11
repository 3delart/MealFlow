/**
 * Barcode scanner with html5-qrcode and Open Food Facts integration
 */

let scannerActive = false;
let qrScanner = null;

function toggleManualForm() {
  const form = document.getElementById("add-item-section");
  if (!form) {
    console.error("add-item-section not found");
    return;
  }

  const isHidden = form.style.display === "none" || !form.offsetParent;
  if (isHidden) {
    form.style.display = "block";
    const addForm = document.getElementById("add-item-form");
    if (addForm) addForm.reset();
    scannedProductData = null;
    const productInfo = document.getElementById("product-info");
    if (productInfo) productInfo.style.display = "none";
    const nameField = document.getElementById("field-product-name");
    if (nameField) nameField.focus();
  } else {
    form.style.display = "none";
  }
}

function startScanner() {
  const status = document.getElementById("scanner-status");
  const container = document.getElementById("scanner-video");

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


  qrScanner = new Html5Qrcode("scanner-video");

  qrScanner.start(
    { facingMode: "environment" },
    {
      fps: 10,
      qrbox: { width: 280, height: 280 }
    },
    function(decodedText, decodedResult) {
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

function stopScanner() {
  if (!scannerActive || !qrScanner) return;

  qrScanner.stop().then(() => {
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

async function processBarcodeDetection(barcode) {
  const status = document.getElementById("scanner-status");

  // Check the local inventory first: if we already know this barcode, prefill
  // from it and skip the Open Food Facts network call entirely.
  const existingItem = findItemByBarcode(barcode);
  let product = null;

  if (existingItem) {
    status.textContent = `✅ Déjà en stock : ${existingItem.Produit}`;
    status.classList.remove("error");
    status.classList.add("success");
  } else {
    status.textContent = "⏳ Recherche produit...";
    product = await fetchProductFromOpenFoodFacts(barcode);
    if (!product) {
      status.textContent = "❌ Produit non trouvé. Entrez manuellement.";
      status.classList.add("error");
      document.getElementById("add-item-section").style.display = "block";
      return;
    }
    status.textContent = `✅ Produit trouvé: ${product.name}`;
    status.classList.remove("error");
    status.classList.add("success");
  }

  document.getElementById("add-item-section").style.display = "block";

  // Unified source: API product when scanned fresh, else the inventory item.
  const src = product || {
    name: existingItem.Produit,
    quantity: 1,
    unit: existingItem.Unité,
    category: existingItem.Catégorie,
    calories: existingItem.calories_per_100,
    proteins: existingItem.proteins,
    fats: existingItem.fats,
    carbs: existingItem.carbs,
    allergens: existingItem.allergens,
    barcode
  };

  document.getElementById("field-product-name").value = existingItem?.Produit || src.name;

  if (src.quantity > 100) {
    console.warn(`⚠️ Suspicious quantity from API: ${src.quantity} ${src.unit}. User should verify.`);
    status.textContent += ` ⚠️ Vérifiez la quantité`;
  }

  document.getElementById("field-quantity").value = src.quantity || 1;
  document.getElementById("field-unit").value = existingItem?.Unité || src.unit || "pièce";
  document.getElementById("field-category").value = existingItem?.Catégorie || src.category || "Autres";
  document.getElementById("field-price").value = existingItem?.Prix || "";
  scannedProductData = src;

  const infoSection = document.getElementById("product-info");
  infoSection.style.display = "grid";

  if (src.calories) {
    document.getElementById("info-calories").textContent = Number(src.calories).toFixed(1) + " kcal";
  }
  if (src.proteins) {
    document.getElementById("info-proteins").textContent = Number(src.proteins).toFixed(1) + "g";
  }
  if (src.fats) {
    document.getElementById("info-fats").textContent = Number(src.fats).toFixed(1) + "g";
  }
  if (src.carbs) {
    document.getElementById("info-carbs").textContent = Number(src.carbs).toFixed(1) + "g";
  }
  document.getElementById("info-allergens").textContent = src.allergens || "—";

  // Auto-fill expiry date based on category and date-added
  updateExpiryDateFromCategory("field-date-added", "field-category", "field-expiry");
}
