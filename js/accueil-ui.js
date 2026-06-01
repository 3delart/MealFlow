// js/accueil-ui.js
let selectedMealData = null;
let selectedProduct = null;
let _consommerSelectedProductId = null;
let _consommerSelectedRecetteKey = null;
let _consommerProductDebounce = null;
let _consommerRecetteDebounce = null;

function _normStr(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function onConsommerProductInput(e) {
  clearTimeout(_consommerProductDebounce);
  _consommerProductDebounce = setTimeout(() => {
    const q = e.target.value.trim();
    const dropdown = document.getElementById('consommer-product-dropdown');
    const previewBox = document.getElementById('consommer-preview');
    if (q.length < 1) {
      dropdown.style.display = 'none';
      _consommerSelectedProductId = null;
      previewBox.innerHTML = '';
      return;
    }
    const normQ = _normStr(q);
    const items = InventoryAPI.getActiveItems();
    const matches = items.filter(i => _normStr(i.name).includes(normQ)).slice(0, 5);
    if (!matches.length) {
      dropdown.style.display = 'none';
      return;
    }
    dropdown.innerHTML = '';
    matches.forEach(item => {
      const div = document.createElement('div');
      div.style.cssText = 'padding:8px 12px; cursor:pointer; font-size:14px;';
      div.textContent = `${item.name} (${item.calories_per_100} kcal/100g)`;
      div.addEventListener('mouseover', () => div.style.background = '#f0f0f0');
      div.addEventListener('mouseout', () => div.style.background = '');
      div.addEventListener('click', () => {
        _consommerSelectedProductId = item.id;
        document.getElementById('consommer-product-search').value = item.name;
        dropdown.style.display = 'none';
        updateConsommerPreview();
      });
      dropdown.appendChild(div);
    });
    dropdown.style.display = 'block';
  }, 300);
}

function onConsommerRecetteInput(e) {
  clearTimeout(_consommerRecetteDebounce);
  _consommerRecetteDebounce = setTimeout(() => {
    const q = e.target.value.trim();
    const dropdown = document.getElementById('consommer-recette-dropdown');
    const previewBox = document.getElementById('consommer-recette-preview');
    if (q.length < 1) {
      dropdown.style.display = 'none';
      _consommerSelectedRecetteKey = null;
      previewBox.innerHTML = '';
      return;
    }
    const normQ = _normStr(q);
    if (!window.recipesData) return;
    const matches = Object.keys(window.recipesData)
      .filter(key => _normStr(window.recipesData[key].name).includes(normQ))
      .slice(0, 5);
    if (!matches.length) {
      dropdown.style.display = 'none';
      return;
    }
    dropdown.innerHTML = '';
    matches.forEach(key => {
      const recipe = window.recipesData[key];
      const div = document.createElement('div');
      div.style.cssText = 'padding:8px 12px; cursor:pointer; font-size:14px;';
      div.textContent = recipe.name;
      div.addEventListener('mouseover', () => div.style.background = '#f0f0f0');
      div.addEventListener('mouseout', () => div.style.background = '');
      div.addEventListener('click', () => {
        _consommerSelectedRecetteKey = key;
        document.getElementById('consommer-recette-search').value = recipe.name;
        dropdown.style.display = 'none';
        updateConsommerRecettePreview();
      });
      dropdown.appendChild(div);
    });
    dropdown.style.display = 'block';
  }, 300);
}

function debugLog(msg) {
  console.log(msg);
  const output = document.getElementById('debug-output');
  if (output) {
    const line = document.createElement('div');
    line.textContent = new Date().toLocaleTimeString() + ' ' + msg;
    line.style.marginBottom = '4px';
    output.appendChild(line);
    output.scrollTop = output.scrollHeight;
  }
}

// Make globally available
window.debugLog = debugLog;

function viewMealRecipe(mealName) {
  if (!window.recipesData) return;

  const recipeID = Object.keys(window.recipesData).find(id =>
    window.recipesData[id].name === mealName
  );

  if (!recipeID) {
    alert("Recette non trouvée");
    return;
  }

  // Find portions from todaysMeals
  const meal = (window.todaysMeals || []).find(m => m.name === mealName);
  const portions = meal?.portions || 1;

  if (typeof openViewModal === "function") {
    openViewModal(recipeID, portions);
  } else {
    alert("Modal recette non disponible");
  }
}

function closeViewModal() {
  const modal = document.getElementById("modal-recipe-view");
  if (modal) {
    modal.classList.remove("open");
  }
}

function scannerLog(msg) {
  console.log(msg);
  const output = document.getElementById('scanner-debug-output');
  if (output) {
    const line = document.createElement('div');
    line.textContent = new Date().toLocaleTimeString() + ' ' + msg;
    output.appendChild(line);
    output.scrollTop = output.scrollHeight;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // Attach button listeners before auth check (no auth needed for DOM binding)
  document.getElementById('consommer-btn')?.addEventListener('click', openConsommerModal);
  document.getElementById('close-consommer-modal')?.addEventListener('click', closeConsommerModal);
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchConsommerTab(btn.dataset.tab));
  });

  const token = getAccessToken();
  if (!token) {
    console.warn("Not authenticated");
    return;
  }

  await loadRecipes();
  await loadInventory();

  await window.initAccueil();
  await initAccueilUI();

  // Event listeners for Manger modal
  document.getElementById('manger-form')?.addEventListener('submit', submitManger);
  document.getElementById('manger-qty')?.addEventListener('input', updateMangerPreview);
  document.getElementById('close-manger-modal')?.addEventListener('click', closeMangerModal);

  // Consommer - Scanner tab
  document.getElementById('consommer-btn-scan')?.addEventListener('click', consommerScannerStart);
  document.getElementById('consommer-btn-stop-scan')?.addEventListener('click', consommerScannerStop);

  // Consommer - Inventaire tab
  document.getElementById('consommer-product-search')?.addEventListener('input', onConsommerProductInput);
  document.getElementById('consommer-qty')?.addEventListener('input', updateConsommerPreview);

  // Consommer - Recette tab
  document.getElementById('consommer-recette-search')?.addEventListener('input', onConsommerRecetteInput);
  document.getElementById('consommer-recette-qty')?.addEventListener('input', updateConsommerRecettePreview);

  document.addEventListener('click', e => {
    if (!e.target.closest('#tab-inventaire')) {
      const dd = document.getElementById('consommer-product-dropdown');
      if (dd) dd.style.display = 'none';
    }
    if (!e.target.closest('#tab-recette')) {
      const dd = document.getElementById('consommer-recette-dropdown');
      if (dd) dd.style.display = 'none';
    }
  });

  window.addEventListener('auth-changed', async (e) => {
    if (e.detail.email) {
      await UserContext.init(e.detail.email);
      await window.initAccueil();
      await initAccueilUI();
    }
  });
});

async function initAccueilUI() {
  renderGreeting();
  renderConsumptionLog();

  // Event delegation for meal action buttons
  const mealsContainer = document.getElementById('meals-container');
  if (mealsContainer) {
    mealsContainer.addEventListener('click', (e) => {
      const mangeBtn = e.target.closest('.btn-mange');
      const voirBtn = e.target.closest('.btn-voir');
      if (mangeBtn) {
        openMangerModal(mangeBtn.dataset.mealName);
      } else if (voirBtn) {
        viewMealRecipe(voirBtn.dataset.mealName);
      }
    });
  }
}

function renderGreeting() {
  const user = getCurrentUser();
  if (user) {
    document.getElementById('greeting').textContent = `Bonjour ${user}`;
  }
  document.getElementById('date-today').textContent = Utils.formatDate(getTodayISO());

  // Fill daily goal
  if (window.dailyGoal) {
    document.getElementById('calorie-objective').textContent = `Objectif: ${window.dailyGoal} kcal`;
  }
}

function loadTodayHistory() {
  const user = getCurrentUser();
  if (!user) return;

  const tabName = `History_${user}`;
  SheetsAPI.readSheetTab(tabName).then(rows => {
    if (!rows) {
      todayConsumptions = [];
      return;
    }

    const today = Utils.getTodayISO();
    const history = SheetsAPI.rowsToObjects(rows);
    todaysConsumptions = history.filter(h => h.Date === today).reverse();
  });
}

// TASK 6: renderConsumptionLog - render table from todaysConsumptions
function renderConsumptionLog() {
  const tbody = document.getElementById('log-body');
  tbody.innerHTML = '';

  // Filter out zero-kcal entries
  const validConsumptions = todaysConsumptions.filter(c => (c.Kcal_total || 0) > 0);

  if (validConsumptions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--color-text-light);">Aucune consommation</td></tr>';
    return;
  }

  validConsumptions.forEach((entry) => {
    const rawIndex = todaysConsumptions.indexOf(entry);
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${entry.Heure || ''}</td>
      <td>${entry.Nom || ''}</td>
      <td>${entry.Quantité} ${entry.Unité || ''}</td>
      <td>${entry.Kcal_total || '0'}</td>
      <td><button class="btn btn-delete" onclick="deleteConsumption(${rawIndex})">✕</button></td>
    `;
    tbody.appendChild(row);
  });
}

// TASK 4: Manger Modal Functions
function openMangerModal(mealName) {
  const modal = document.getElementById('manger-modal');
  const select = document.getElementById('manger-meal');
  const mealGroup = document.getElementById('manger-meal-group');

  // Find if meal is custom
  const meal = todaysMeals.find(m => m.name === mealName);
  const isCustom = meal && meal.isCustom;

  // Toggle between recipe and custom modes
  const recipeMode = document.getElementById('manger-recipe-mode');
  const customMode = document.getElementById('manger-custom-mode');

  if (isCustom) {
    // Show custom mode
    recipeMode.style.display = 'none';
    customMode.style.display = 'block';
    document.getElementById('manger-custom-name').value = mealName || '';
    document.getElementById('manger-custom-qty').value = '';
    document.getElementById('manger-custom-kcal').value = '';
    document.getElementById('manger-custom-qty').focus();

    // Add event listeners for custom preview updates
    const customQtyInput = document.getElementById('manger-custom-qty');
    const customUnitInput = document.getElementById('manger-custom-unit');
    const customKcalInput = document.getElementById('manger-custom-kcal');

    customQtyInput.removeEventListener('input', updateMangerPreview);
    customUnitInput.removeEventListener('change', updateMangerPreview);
    customKcalInput.removeEventListener('input', updateMangerPreview);

    customQtyInput.addEventListener('input', updateMangerPreview);
    customUnitInput.addEventListener('change', updateMangerPreview);
    customKcalInput.addEventListener('input', updateMangerPreview);
  } else {
    // Show recipe mode
    recipeMode.style.display = 'block';
    customMode.style.display = 'none';

    // Populate from todaysMeals with actual recipe data
    select.innerHTML = '<option value="">-- Sélectionner --</option>';
    const mealsWithRecipes = todaysMeals.filter(m => m.name && m.name.trim());
    mealsWithRecipes.forEach(m => {
      const option = document.createElement('option');
      option.value = m.name;
      option.textContent = `${m.name} (${m.kcal_per_100} kcal/100g)`;
      option.dataset.kcalPer100 = m.kcal_per_100;
      option.dataset.isCustom = m.isCustom || false;
      select.appendChild(option);
    });

    // Pre-select meal if passed
    if (mealName) {
      select.value = mealName;
      if (mealGroup) mealGroup.style.display = 'none'; // Hide dropdown, meal already selected
      updateMangerRecipePreview();
    } else {
      if (mealGroup) mealGroup.style.display = 'block';
    }

    document.getElementById('manger-qty').value = '';
    document.getElementById('manger-qty').focus();

    // Add event listeners for recipe preview updates
    select.removeEventListener('change', updateMangerPreview);
    const qtyInput = document.getElementById('manger-qty');
    qtyInput.removeEventListener('input', updateMangerPreview);

    select.addEventListener('change', updateMangerPreview);
    qtyInput.addEventListener('input', updateMangerPreview);
  }

  modal.classList.remove('hidden');
  modal.classList.add('open');
}

function closeMangerModal() {
  const modal = document.getElementById('manger-modal');
  modal.classList.add('hidden');
  modal.classList.remove('open');
  document.getElementById('manger-form').reset();
  document.getElementById('manger-preview').innerHTML = '';
  const mealGroup = document.getElementById('manger-meal-group');
  if (mealGroup) mealGroup.style.display = 'block'; // Restore dropdown visibility
}

function updateMangerPreview() {
  // Check which mode is active
  const recipeMode = document.getElementById('manger-recipe-mode');
  const customMode = document.getElementById('manger-custom-mode');

  if (customMode && customMode.style.display !== 'none') {
    updateMangerCustomPreview();
  } else {
    updateMangerRecipePreview();
  }
}

function updateMangerRecipePreview() {
  const mealSelect = document.getElementById('manger-meal');
  const qtyInput = document.getElementById('manger-qty');
  const previewBox = document.getElementById('manger-preview');

  if (!mealSelect.value || !qtyInput.value) {
    previewBox.innerHTML = '';
    return;
  }

  const mealName = mealSelect.value;
  const qty = parseFloat(qtyInput.value);
  const selectedOption = mealSelect.options[mealSelect.selectedIndex];
  const kcalPer100g = parseFloat(selectedOption.dataset.kcalPer100) || 0;
  const totalKcal = Math.round(qty * (kcalPer100g / 100));

  previewBox.innerHTML = `
    <div style="padding: 12px; background-color: var(--color-bg); border-radius: 6px;">
      <p style="margin: 0; font-size: 0.9em;"><strong>${mealName}</strong></p>
      <p style="margin: 4px 0 0 0; font-size: 0.85em; color: var(--color-text-light);">${qty}g · ${totalKcal} kcal</p>
    </div>
  `;
}

function updateMangerCustomPreview() {
  const nameInput = document.getElementById('manger-custom-name');
  const qtyInput = document.getElementById('manger-custom-qty');
  const unitInput = document.getElementById('manger-custom-unit');
  const kcalInput = document.getElementById('manger-custom-kcal');
  const previewBox = document.getElementById('manger-preview');

  if (!qtyInput.value || !kcalInput.value) {
    previewBox.innerHTML = '';
    return;
  }

  const mealName = nameInput.value;
  const qty = parseFloat(qtyInput.value);
  const unit = unitInput.value;
  const totalKcal = parseFloat(kcalInput.value);

  previewBox.innerHTML = `
    <div style="padding: 12px; background-color: var(--color-bg); border-radius: 6px;">
      <p style="margin: 0; font-size: 0.9em;"><strong>${mealName}</strong></p>
      <p style="margin: 4px 0 0 0; font-size: 0.85em; color: var(--color-text-light);">${qty}${unit} · ${totalKcal} kcal</p>
    </div>
  `;
}

async function submitManger(e) {
  e.preventDefault();

  // Determine which mode is active
  const customMode = document.getElementById('manger-custom-mode');
  const isCustom = customMode && customMode.style.display !== 'none';

  let mealName, qty, unit, totalKcal, kcalPer100g = null;

  if (isCustom) {
    // Custom mode
    const nameInput = document.getElementById('manger-custom-name');
    const qtyInput = document.getElementById('manger-custom-qty');
    const unitInput = document.getElementById('manger-custom-unit');
    const kcalInput = document.getElementById('manger-custom-kcal');

    if (!qtyInput.value || !kcalInput.value) {
      alert('Remplissez les champs');
      return;
    }

    mealName = nameInput.value;
    qty = parseFloat(qtyInput.value);
    unit = unitInput.value;
    totalKcal = parseFloat(kcalInput.value);
    kcalPer100g = null; // Custom meals don't have per-100g
  } else {
    // Recipe mode
    const mealSelect = document.getElementById('manger-meal');
    const qtyInput = document.getElementById('manger-qty');

    if (!mealSelect.value || !qtyInput.value) {
      alert('Remplissez les champs');
      return;
    }

    mealName = mealSelect.value;
    qty = parseFloat(qtyInput.value);
    unit = 'g';
    const selectedOption = mealSelect.options[mealSelect.selectedIndex];
    kcalPer100g = parseFloat(selectedOption.dataset.kcalPer100) || 0;
    totalKcal = Math.round(qty * (kcalPer100g / 100));
  }

  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const date = getTodayISO();
  const user = getCurrentUser();

  try {
    const token = getAccessToken?.();
    const tabName = `History_${user}`;
    const row = [date, time, mealName, qty, unit, totalKcal, 'manger'];

    // Add to local state (match sheet column names)
    todaysConsumptions.push({ Heure: time, Nom: mealName, Quantité: qty, Unité: unit, Kcal_total: totalKcal, Type: 'manger' });

    // Update global calories consumed
    caloriesConsumed = (caloriesConsumed || 0) + totalKcal;

    // Save to sheet
    if (token && SheetsAPI) {
      await SheetsAPI.appendRowWithToken(tabName, row, token);
    }

    renderConsumptionLog();
    updateProgressDisplay();
    renderWheel();
    closeMangerModal();
  } catch (err) {
    console.error('Error submitting manger:', err);
    alert('Erreur sauvegarde');
  }
}

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

function updateConsommerPreview() {
  const qtyInput = document.getElementById('consommer-qty');
  const previewBox = document.getElementById('consommer-preview');

  if (!_consommerSelectedProductId || !qtyInput.value) {
    previewBox.innerHTML = '';
    return;
  }

  const items = InventoryAPI.getActiveItems();
  const product = items.find(i => i.id === _consommerSelectedProductId);
  if (!product) return;

  const qty = parseFloat(qtyInput.value);
  const kcalPer100 = product.calories_per_100 || 0;
  const totalKcal = Math.round(qty * kcalPer100 / 100);

  previewBox.innerHTML = `
    <div style="padding: 12px; background-color: var(--color-bg); border-radius: 6px;">
      <p style="margin: 0; font-size: 0.9em;"><strong>${product.name}</strong></p>
      <p style="margin: 4px 0 0 0; font-size: 0.85em; color: var(--color-text-light);">${qty}${product.unit} · ${totalKcal} kcal</p>
    </div>
  `;
}

function submitConsommerInventaire() {
  const qtyInput = document.getElementById('consommer-qty');
  const qty = parseFloat(qtyInput.value);

  if (!_consommerSelectedProductId || !qty || qty <= 0) {
    alert('Sélectionnez un produit et une quantité');
    return;
  }

  const items = InventoryAPI.getActiveItems();
  const product = items.find(i => i.id === _consommerSelectedProductId);
  if (!product) {
    alert('Produit non trouvé');
    return;
  }

  const kcalPer100 = product.calories_per_100 || 0;
  const totalKcal = Math.round(qty * kcalPer100 / 100);

  _enregistrerConsommation(product.name, qty, product.unit, kcalPer100, totalKcal, 'inventaire');
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
  const totalKcal = Math.round(qty * recipe.kcal_per_100 / 100);

  previewBox.innerHTML = `
    <div style="padding: 12px; background-color: var(--color-bg); border-radius: 6px;">
      <p style="margin: 0; font-size: 0.9em;"><strong>${recipe.name}</strong></p>
      <p style="margin: 4px 0 0 0; font-size: 0.85em; color: var(--color-text-light);">${qty}g · ${totalKcal} kcal</p>
    </div>
  `;
}

function submitConsommerRecette() {
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
  const totalKcal = Math.round(qty * kcalPer100 / 100);

  _enregistrerConsommation(recipe.name, qty, 'g', kcalPer100, totalKcal, 'recette');
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
  if (token && window.SheetsAPI) {
    try {
      await window.SheetsAPI.appendRowWithToken(tabName, row, token);
    } catch (err) {
      console.error('Error saving to Sheets:', err);
    }
  }

  closeConsommerModal();
  renderConsumptionLog();
  updateProgressDisplay();
  renderWheel();
}

// TASK 6: Delete Consumption Function
async function deleteConsumption(index) {
  if (confirm('Êtes-vous sûr de vouloir supprimer cette consommation ?')) {
    const entry = todaysConsumptions[index];
    if (!entry) return;

    const user = getCurrentUser();
    const today = getTodayISO();
    const tabName = `History_${user}`;

    // Remove from local state
    if (entry) {
      caloriesConsumed = (caloriesConsumed || 0) - (entry.Kcal_total || 0);
    }
    todaysConsumptions.splice(index, 1);

    // Persist deletion to localStorage
    try {
      localStorage.setItem(`mealflow:consumptions:${user}:${today}`, JSON.stringify(todaysConsumptions));
      localStorage.setItem(`mealflow:consumed:${user}:${today}`, String(caloriesConsumed || 0));
    } catch (err) {
      console.warn("Could not save consumptions to localStorage:", err);
    }

    // Delete from Sheets
    try {
      const token = getAccessToken?.();
      if (token && window.SheetsAPI) {
        const rows = await window.SheetsAPI.readSheetTab(tabName);
        const objects = window.SheetsAPI.rowsToObjects(rows);

        // Find exact row numbers to delete (idx+2: row 1=header, idx 0 = row 2)
        const toDelete = [];
        objects.forEach((obj, idx) => {
          const rowDate = (obj.Date || "").trim();
          const rowTime = (obj.Heure || obj.Time || "").trim();
          const rowProduct = (obj.Nom || obj.Product || "").trim();
          if (rowDate === today && rowTime === entry.Heure && rowProduct === entry.Nom) {
            toDelete.push(idx + 2);
          }
        });

        // Delete from highest row first to avoid index shifts
        for (const rowNum of toDelete.sort((a, b) => b - a)) {
          await window.SheetsAPI.deleteSheetRow(tabName, rowNum, token);
        }
      }
    } catch (err) {
      console.warn("Could not delete from Sheets:", err.message);
    }

    renderConsumptionLog();
    updateProgressDisplay();
    renderWheel();
  }
}
