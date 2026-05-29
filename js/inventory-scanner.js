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

  console.log("Starting Html5Qrcode scanner");

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

async function processBarcodeDetection(barcode) {
  const status = document.getElementById("scanner-status");
  status.textContent = "⏳ Recherche produit...";

  const product = await fetchProductFromOpenFoodFacts(barcode);

  if (!product) {
    status.textContent = "❌ Produit non trouvé. Entrez manuellement.";
    status.classList.add("error");
    document.getElementById("add-item-section").style.display = "block";
    return;
  }

  status.textContent = `✅ Produit trouvé: ${product.name}`;
  status.classList.remove("error");
  status.classList.add("success");

  document.getElementById("add-item-section").style.display = "block";

  const existingItem = findItemByBarcode(barcode);

  document.getElementById("field-product-name").value = existingItem?.Produit || product.name;

  if (product.quantity > 100) {
    console.warn(`⚠️ Suspicious quantity from API: ${product.quantity} ${product.unit}. User should verify.`);
    status.textContent += ` ⚠️ Vérifiez la quantité`;
  }

  document.getElementById("field-quantity").value = product.quantity || 1;
  document.getElementById("field-unit").value = existingItem?.Unité || product.unit || "pièce";
  document.getElementById("field-category").value = existingItem?.Catégorie || product.category || "Autres";
  document.getElementById("field-price").value = existingItem?.Prix || "";
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
}
