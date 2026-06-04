/**
 * @fileoverview Accueil — "Consommer" modal (scanner / inventaire / recette / manuel)
 * plus recipe-ingredient deduction. Extracted from accueil-ui.js; shares the
 * global scope with accueil-ui.js (classic scripts).
 */

// TASK 5: Consommer Modal (4 tabs)
let consommerScannerActive = false;
let consommerQrScanner = null;

function openConsommerModal() {
  const modal = document.getElementById('consommer-modal');
  _consommerSelectedProductId = null;
  _consommerSelectedRecetteKey = null;
  switchConsommerTab('scanner');
  modal.classList.remove('hidden');
  modal.classList.add('open');
}

function closeConsommerModal() {
  const modal = document.getElementById('consommer-modal');
  modal.classList.add('hidden');
  modal.classList.remove('open');
  consommerScannerStop();
  const productSearch = document.getElementById('consommer-product-search');
  if (productSearch) productSearch.value = '';
  const productDd = document.getElementById('consommer-product-dropdown');
  if (productDd) productDd.style.display = 'none';
  _consommerSelectedProductId = null;
  document.getElementById('consommer-qty').value = '';
  document.getElementById('consommer-preview').innerHTML = '';
  const recetteSearch = document.getElementById('consommer-recette-search');
  if (recetteSearch) recetteSearch.value = '';
  const recetteDd = document.getElementById('consommer-recette-dropdown');
  if (recetteDd) recetteDd.style.display = 'none';
  _consommerSelectedRecetteKey = null;
  document.getElementById('consommer-recette-qty').value = '';
  document.getElementById('consommer-recette-preview').innerHTML = '';
  const recetteUnit = document.getElementById('consommer-recette-unit');
  if (recetteUnit) recetteUnit.value = 'g';
  const recetteQtyLabel = document.getElementById('consommer-recette-qty-label');
  if (recetteQtyLabel) recetteQtyLabel.textContent = 'Quantité (g) :';
  const deductCheckbox = document.getElementById('consommer-recette-deduct');
  if (deductCheckbox) deductCheckbox.checked = false;
  document.getElementById('consommer-manuel-nom').value = '';
  document.getElementById('consommer-manuel-qty').value = '';
  document.getElementById('consommer-manuel-unit').value = '';
  document.getElementById('consommer-manuel-kcal').value = '';
  document.getElementById('consommer-scan-result').style.display = 'none';
}

function switchConsommerTab(tabName) {
  // Hide all tabs
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

  // Show selected tab
  const tabEl = document.getElementById(`tab-${tabName}`);
  if (tabEl) tabEl.classList.add('active');

  // Mark button active
  const btn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
  if (btn) btn.classList.add('active');

  // Stop scanner if leaving scanner tab
  if (tabName !== 'scanner') {
    consommerScannerStop();
  }
}

// Scanner functions
async function consommerScannerStart() {
  if (consommerScannerActive) return;
  consommerScannerActive = true;

  const videoEl = document.getElementById('consommer-scanner-video');
  const statusEl = document.getElementById('consommer-scanner-status');
  const btnStart = document.getElementById('consommer-btn-scan');
  const btnStop = document.getElementById('consommer-btn-stop-scan');

  if (btnStart) btnStart.style.display = 'none';
  if (btnStop) btnStop.style.display = 'inline-block';
  if (videoEl) videoEl.style.display = 'block';

  try {
    consommerQrScanner = new Html5Qrcode('consommer-scanner-video');
    await consommerQrScanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: 280 },
      (decodedText) => {
        consommerScannerStop();
        consommerScannerOnDetect(decodedText);
      },
      (err) => console.warn('Scanner error:', err)
    );
    if (statusEl) statusEl.textContent = '🎯 Scanning...';
  } catch (err) {
    console.error('Failed to start scanner:', err);
    if (statusEl) statusEl.textContent = '❌ Erreur caméra';
    consommerScannerActive = false;
    if (btnStart) btnStart.style.display = 'inline-block';
    if (btnStop) btnStop.style.display = 'none';
  }
}

function consommerScannerStop() {
  if (!consommerScannerActive || !consommerQrScanner) return;

  consommerQrScanner.stop().catch(err => console.warn('Failed to stop scanner:', err));
  consommerQrScanner = null;
  consommerScannerActive = false;

  const videoEl = document.getElementById('consommer-scanner-video');
  const btnStart = document.getElementById('consommer-btn-scan');
  const btnStop = document.getElementById('consommer-btn-stop-scan');
  const statusEl = document.getElementById('consommer-scanner-status');

  if (videoEl) videoEl.style.display = 'none';
  if (btnStart) btnStart.style.display = 'inline-block';
  if (btnStop) btnStop.style.display = 'none';
  if (statusEl) statusEl.textContent = '';
}

async function consommerScannerOnDetect(barcode) {
  const resultEl = document.getElementById('consommer-scan-result');
  const nameEl = document.getElementById('consommer-scan-name');
  const kcalEl = document.getElementById('consommer-scan-kcal');
  const qtyEl = document.getElementById('consommer-scan-qty');

  // First check inventory
  let product = InventoryAPI.findByBarcode(barcode);
  scannerLog(`Barcode: ${barcode}, Found in inventory: ${product ? product.name : 'NO'}`);

  // Otherwise fetch from Open Food Facts
  if (!product) {
    try {
      scannerLog(`Fetching from Open Food Facts...`);
      product = await fetchProductFromOpenFoodFacts(barcode);
      scannerLog(`Open Food Facts result: ${JSON.stringify(product).substring(0,100)}`);
    } catch (err) {
      console.error('Product lookup failed:', err);
      alert('Produit non trouvé');
      return;
    }

    // If product found in Open Food Facts, add to inventory
    if (product && product.name) {
      scannerLog(`Adding to inventory: ${product.name}`);
      try {
        const newItem = {
          Barcode: barcode,
          Produit: product.name,
          Catégorie: product.category || 'Autres',
          Qty: '0',
          Unité: product.unit || 'g',
          Date_ajout: Utils.getTodayISO(),
          Péremption: '',
          Prix: '',
          calories_per_100: product.calories || 0,
          proteins: product.proteins || null,
          fats: product.fats || null,
          carbs: product.carbs || null,
          allergens: product.allergens || '—'
        };

        const token = getAccessToken?.();
        scannerLog(`Token exists: ${!!token}, SheetsAPI exists: ${!!window.SheetsAPI}`);

        if (token && window.SheetsAPI) {
          const row = [
            newItem.Barcode,
            newItem.Produit,
            newItem.Catégorie,
            newItem.Qty,
            newItem.Unité,
            "",
            newItem.Date_ajout,
            newItem.Péremption,
            newItem.Prix,
            newItem.calories_per_100,
            newItem.proteins,
            newItem.fats,
            newItem.carbs,
            newItem.allergens
          ];
          scannerLog(`Appending row to Inventory sheet...`);
          await window.SheetsAPI.appendRowWithToken('Inventory', row, token);
          scannerLog(`✓ Added product to Inventory sheet: ${newItem.Produit}`);
        } else {
          console.warn(`[Scanner] Cannot add to sheet: token=${!!token}, SheetsAPI=${!!window.SheetsAPI}`);
        }

        // Also add to local inventory
        newItem.id = Date.now();
        newItem.sheetRowNumber = -1;
        window.inventoryData.push(newItem);
        scannerLog(`✓ Added to local inventoryData`);
      } catch (err) {
        console.error('[Scanner] Failed to add product to inventory:', err);
      }
    } else {
      console.warn(`[Scanner] Product not found in Open Food Facts`);
    }
  }

  if (!product || !product.name) {
    alert('Produit non trouvé');
    return;
  }

  // Display result
  const kcalPer100 = product.calories_per_100 || product.calories || 0;
  if (nameEl) nameEl.textContent = product.name;
  if (kcalEl) kcalEl.textContent = `${kcalPer100} kcal/100g`;
  if (qtyEl) qtyEl.value = '';
  if (resultEl) resultEl.style.display = 'block';

  // Store for submit
  window.consommerScanData = { name: product.name, kcalPer100, unit: product.unit || 'g', type: 'scan' };
}

function submitConsommerScan() {
  const qtyEl = document.getElementById('consommer-scan-qty');
  const qty = parseFloat(qtyEl.value);

  if (!qty || qty <= 0) {
    alert('Entrez une quantité');
    return;
  }

  const data = window.consommerScanData;
  const totalKcal = Math.round(qty * data.kcalPer100 / 100);

  _enregistrerConsommation(data.name, qty, data.unit, data.kcalPer100, totalKcal, 'scan');
}

function _inventoryQtyToGrams(qty, unit, conversionFactor) {
  if (unit === 'pièce' || unit === 'piece') {
    return qty * (parseFloat(conversionFactor) || 1);
  }
  if (unit === 'litre') return qty * 1000;
  return qty; // g or ml
}

function updateConsommerPreview() {
  const qtyInput = document.getElementById('consommer-qty');
  const previewBox = document.getElementById('consommer-preview');

  if (!_consommerSelectedProductId || !qtyInput.value) {
    previewBox.innerHTML = '';
    return;
  }

  const invItem = (window.inventoryData || []).find(i => i.id === _consommerSelectedProductId);
  if (!invItem) return;

  const qty = parseFloat(qtyInput.value);
  const unit = invItem.Unité || 'g';
  const qtyGrams = _inventoryQtyToGrams(qty, unit, invItem.Conversion_factor);
  const kcalPer100 = invItem.calories_per_100 || 0;
  const totalKcal = Math.round(qtyGrams * kcalPer100 / 100);

  previewBox.innerHTML = `
    <div style="padding: 12px; background-color: var(--color-bg); border-radius: 6px;">
      <p style="margin: 0; font-size: 0.9em;"><strong>${Utils.escapeHTML(invItem.Produit)}</strong></p>
      <p style="margin: 4px 0 0 0; font-size: 0.85em; color: var(--color-text-light);">${qty} ${unit} · ${totalKcal} kcal</p>
    </div>
  `;
}

async function submitConsommerInventaire() {
  const qtyInput = document.getElementById('consommer-qty');
  const qty = parseFloat(qtyInput.value);

  if (!_consommerSelectedProductId || !qty || qty <= 0) {
    alert('Sélectionnez un produit et une quantité');
    return;
  }

  const items = InventoryAPI.getAllItems();
  const product = items.find(i => i.id === _consommerSelectedProductId);
  if (!product) {
    alert('Produit non trouvé');
    return;
  }

  const invItem = (window.inventoryData || []).find(i => i.id === _consommerSelectedProductId);
  if (invItem && typeof applyInventoryDeduction === 'function') {
    const token = getAccessToken?.();
    await applyInventoryDeduction(invItem, qty, token);
  }

  const unit = product.unit || invItem?.Unité || 'g';
  const convFactor = invItem?.Conversion_factor;
  const qtyGrams = _inventoryQtyToGrams(qty, unit, convFactor);
  const kcalPer100 = product.calories_per_100 || 0;
  const totalKcal = Math.round(qtyGrams * kcalPer100 / 100);
  _enregistrerConsommation(product.name, qty, unit, kcalPer100, totalKcal, 'inventaire');
}

function updateConsommerRecettePreview() {
  const qtyInput = document.getElementById('consommer-recette-qty');
  const previewBox = document.getElementById('consommer-recette-preview');

  if (!_consommerSelectedRecetteKey || !qtyInput.value) {
    previewBox.innerHTML = '';
    return;
  }

  const recipe = window.recipesData[_consommerSelectedRecetteKey];
  if (!recipe) return;

  const qty = parseFloat(qtyInput.value);
  const unit = document.getElementById('consommer-recette-unit')?.value || 'g';
  let qtyGrams, displayLabel;

  if (unit === 'portions') {
    if (!recipe.portion_g) {
      previewBox.innerHTML = '<p style="color:orange; padding:8px;">⚠️ Portion non définie pour cette recette</p>';
      return;
    }
    qtyGrams = qty * recipe.portion_g;
    displayLabel = `${qty} portion${qty > 1 ? 's' : ''} (${Math.round(qtyGrams)}g)`;
  } else {
    qtyGrams = qty;
    displayLabel = `${qty}g`;
  }

  const totalKcal = Math.round(qtyGrams * recipe.kcal_per_100 / 100);

  previewBox.innerHTML = `
    <div style="padding: 12px; background-color: var(--color-bg); border-radius: 6px;">
      <p style="margin: 0; font-size: 0.9em;"><strong>${Utils.escapeHTML(recipe.name)}</strong></p>
      <p style="margin: 4px 0 0 0; font-size: 0.85em; color: var(--color-text-light);">${displayLabel} · ${totalKcal} kcal</p>
    </div>
  `;
}

async function deductRecipeIngredients(recipe, recipeTotalGrams, token) {
  if (!recipe.ingredients || !Array.isArray(recipe.ingredients)) return;

  // Calculate recipe total weight from ingredients
  let recipeTotalWeight = 0;
  for (const ing of recipe.ingredients) {
    const qty = parseFloat(ing.quantity) || 0;
    const unit = (ing.unit || 'g').toLowerCase();
    let qtyGrams = qty;
    if (unit === 'pièce' || unit === 'piece') qtyGrams = qty * 100; // Rough estimate
    else if (unit === 'litre') qtyGrams = qty * 1000;
    recipeTotalWeight += qtyGrams;
  }

  if (recipeTotalWeight === 0) return;
  const ratio = recipeTotalGrams / recipeTotalWeight;

  for (const ingredient of recipe.ingredients) {
    const ingredientName = (ingredient.name || '').toLowerCase().trim();
    if (!ingredientName) continue;

    // Find matching inventory item by name (fuzzy match)
    const invItem = window.inventoryData?.find(i =>
      (i.Produit || '').toLowerCase().trim() === ingredientName
    );

    if (!invItem) {
      console.warn(`Ingredient not found in inventory: ${ingredient.name}`);
      continue;
    }

    // Calculate quantity to deduct (in grams, then convert to item's unit if needed)
    let qtyInItemUnit;
    const ingredientQtyGrams = (parseFloat(ingredient.quantity) || 0) * ratio;
    const ingredientUnit = (ingredient.unit || 'g').toLowerCase();
    const itemUnit = (invItem.Unité || 'g').toLowerCase();

    if (ingredientUnit === itemUnit || ingredientUnit === 'g' || itemUnit === 'g') {
      qtyInItemUnit = ingredientQtyGrams;
    } else if (itemUnit === 'pièce' || itemUnit === 'piece') {
      qtyInItemUnit = ingredientQtyGrams / (parseFloat(invItem.Conversion_factor) || 1);
    } else if (itemUnit === 'litre') {
      qtyInItemUnit = ingredientQtyGrams / 1000;
    } else {
      qtyInItemUnit = ingredientQtyGrams;
    }

    try {
      await applyInventoryDeduction(invItem, qtyInItemUnit, token);
    } catch (err) {
      console.error(`Failed to deduct ingredient ${ingredient.name}:`, err);
    }
  }
}

async function submitConsommerRecette() {
  const qtyInput = document.getElementById('consommer-recette-qty');
  const qty = parseFloat(qtyInput.value);

  if (!_consommerSelectedRecetteKey || !qty || qty <= 0) {
    alert('Sélectionnez une recette et une quantité');
    return;
  }

  const recipe = window.recipesData[_consommerSelectedRecetteKey];
  if (!recipe) {
    alert('Recette non trouvée');
    return;
  }

  const kcalPer100 = recipe.kcal_per_100 || 0;
  const unitSelect = document.getElementById('consommer-recette-unit')?.value || 'g';
  let qtyGrams, submitUnit;

  if (unitSelect === 'portions') {
    qtyGrams = qty * recipe.portion_g;
    submitUnit = 'portion';
  } else {
    qtyGrams = qty;
    submitUnit = 'g';
  }

  const totalKcal = Math.round(qtyGrams * kcalPer100 / 100);

  // Deduct ingredients if checkbox is checked
  const deductCheckbox = document.getElementById('consommer-recette-deduct');
  if (deductCheckbox?.checked && recipe.ingredients && recipe.ingredients.length > 0) {
    const token = getAccessToken?.();
    if (token) {
      await deductRecipeIngredients(recipe, qtyGrams, token);
    }
  }

  _enregistrerConsommation(recipe.name, qty, submitUnit, kcalPer100, totalKcal, 'recette');
}

function submitConsommerManuel() {
  const nomEl = document.getElementById('consommer-manuel-nom');
  const qtyEl = document.getElementById('consommer-manuel-qty');
  const unitEl = document.getElementById('consommer-manuel-unit');
  const kcalEl = document.getElementById('consommer-manuel-kcal');
  const nom = nomEl.value.trim();
  const qty = parseFloat(qtyEl.value);
  const unit = unitEl.value.trim() || 'g';
  const totalKcal = parseFloat(kcalEl.value);

  if (!nom || !qty || qty <= 0 || !totalKcal || totalKcal <= 0) {
    alert('Remplissez tous les champs (nom, quantité, unité, calories)');
    return;
  }

  _enregistrerConsommation(nom, qty, unit, null, totalKcal, 'manuel');
}

async function _enregistrerConsommation(nom, qty, unit, kcalPer100, totalKcal, type) {
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  const date = Utils.getTodayISO();
  const user = getCurrentUser();
  const token = getAccessToken?.();
  const tabName = `History_${user}`;
  const row = [date, time, nom, qty, unit, totalKcal, type];

  // Local state
  todaysConsumptions.push({ Heure: time, Nom: nom, Quantité: qty, Unité: unit, Kcal_total: totalKcal, Type: type });
  caloriesConsumed = (caloriesConsumed || 0) + totalKcal;

  // Sheets
  let consoError = false;
  if (token && window.SheetsAPI) {
    try {
      await window.SheetsAPI.appendRowWithToken(tabName, row, token);
    } catch (err) {
      consoError = true;
      console.error('Error saving to Sheets:', err);
    }
  }

  closeConsommerModal();
  renderConsumptionLog();
  updateProgressDisplay();
  renderWheel();
  if (window.Toast) {
    if (consoError) Toast.error('Échec de la sauvegarde de la consommation.');
    else Toast.success('Consommation enregistrée ✓');
  }
}
