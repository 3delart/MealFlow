// js/accueil-ui.js
let selectedMealData = null;
let selectedProduct = null;

function viewMealRecipe(mealName) {
  if (!window.recipesData) return;

  // Find recipe by name
  const recipeID = Object.keys(window.recipesData).find(id => {
    return window.recipesData[id].name === mealName;
  });

  if (!recipeID) {
    alert("Recette non trouvée");
    return;
  }

  // Use openViewModal from recettes.js if available
  if (typeof openViewModal === "function") {
    openViewModal(recipeID);
  } else {
    alert("Modal recette non disponible");
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

  // Event listeners for Consommer modal - tabs
  document.getElementById('consommer-btn').addEventListener('click', openConsommerModal);
  document.getElementById('close-consommer-modal').addEventListener('click', closeConsommerModal);
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchConsommerTab(btn.dataset.tab));
  });

  // Consommer - Scanner tab
  document.getElementById('consommer-btn-scan')?.addEventListener('click', consommerScannerStart);
  document.getElementById('consommer-btn-stop-scan')?.addEventListener('click', consommerScannerStop);

  // Consommer - Inventaire tab
  document.getElementById('consommer-product')?.addEventListener('change', updateConsommerPreview);
  document.getElementById('consommer-qty')?.addEventListener('input', updateConsommerPreview);

  // Consommer - Recette tab
  document.getElementById('consommer-recette')?.addEventListener('change', updateConsommerRecettePreview);
  document.getElementById('consommer-recette-qty')?.addEventListener('input', updateConsommerRecettePreview);

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
  await loadTodayHistory();
  renderConsumptionLog();
}

function renderGreeting() {
  const user = getCurrentUser();
  if (user) {
    document.getElementById('greeting').textContent = `Bonjour ${user}`;
  }
  document.getElementById('date-today').textContent = formatDate(getTodayISO());

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
    todayConsumptions = history.filter(h => h.Date === today).reverse();
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

  validConsumptions.forEach((entry, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${entry.Heure || ''}</td>
      <td>${entry.Nom || ''}</td>
      <td>${entry.Quantité || ''} ${entry.Unité || ''}</td>
      <td>${entry.Kcal_total || '0'}</td>
      <td><button class="btn btn-delete" onclick="deleteConsumption(${index})">✕</button></td>
    `;
    tbody.appendChild(row);
  });
}

// TASK 4: Manger Modal Functions
function openMangerModal(mealName) {
  const modal = document.getElementById('manger-modal');
  const select = document.getElementById('manger-meal');
  const mealGroup = document.getElementById('manger-meal-group');

  // Populate from todaysMeals with actual recipe data
  select.innerHTML = '<option value="">-- Sélectionner --</option>';
  const mealsWithRecipes = todaysMeals.filter(m => m.name && m.name.trim());
  mealsWithRecipes.forEach(meal => {
    const option = document.createElement('option');
    option.value = meal.name;
    option.textContent = `${meal.name} (${meal.kcal_per_100} kcal/100g)`;
    option.dataset.kcalPer100 = meal.kcal_per_100;
    select.appendChild(option);
  });

  // Pre-select meal if passed
  if (mealName) {
    select.value = mealName;
    if (mealGroup) mealGroup.style.display = 'none'; // Hide dropdown, meal already selected
    updateMangerPreview();
  } else {
    if (mealGroup) mealGroup.style.display = 'block';
  }

  document.getElementById('manger-qty').value = '';
  document.getElementById('manger-qty').focus();
  modal.classList.remove('hidden');
}

function closeMangerModal() {
  document.getElementById('manger-modal').classList.add('hidden');
  document.getElementById('manger-form').reset();
  document.getElementById('manger-preview').innerHTML = '';
  const mealGroup = document.getElementById('manger-meal-group');
  if (mealGroup) mealGroup.style.display = 'block'; // Restore dropdown visibility
}

function updateMangerPreview() {
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

async function submitManger(e) {
  e.preventDefault();

  const mealSelect = document.getElementById('manger-meal');
  const qtyInput = document.getElementById('manger-qty');

  if (!mealSelect.value || !qtyInput.value) {
    alert('Remplissez les champs');
    return;
  }

  const mealName = mealSelect.value;
  const qty = parseFloat(qtyInput.value);
  const selectedOption = mealSelect.options[mealSelect.selectedIndex];
  const kcalPer100g = parseFloat(selectedOption.dataset.kcalPer100) || 0;
  const totalKcal = Math.round(qty * (kcalPer100g / 100));

  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const date = getTodayISO();
  const user = getCurrentUser();

  try {
    const token = getAccessToken?.();
    const tabName = `History_${user}`;
    const row = [date, time, mealName, qty, 'g', totalKcal, 'manger'];

    // Add to local state (match sheet column names)
    todaysConsumptions.push({ Heure: time, Nom: mealName, Quantité: qty, Unité: 'g', Kcal_total: totalKcal, Type: 'manger' });

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
  const inventaireSelect = document.getElementById('consommer-product');
  const recetteSelect = document.getElementById('consommer-recette');

  // Populate inventory select
  inventaireSelect.innerHTML = '<option value="">-- Sélectionner --</option>';
  const items = InventoryAPI.getActiveItems();
  items.forEach(item => {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = `${item.name} (${item.calories_per_100} kcal/100g)`;
    option.dataset.kcalPer100 = item.calories_per_100;
    option.dataset.unit = item.unit;
    inventaireSelect.appendChild(option);
  });

  // Populate recette select
  recetteSelect.innerHTML = '<option value="">-- Sélectionner --</option>';
  if (window.recipesData) {
    Object.keys(window.recipesData).forEach(key => {
      const recipe = window.recipesData[key];
      const option = document.createElement('option');
      option.value = key;
      option.textContent = recipe.name;
      option.dataset.kcalPer100 = recipe.kcal_per_100;
      recetteSelect.appendChild(option);
    });
  }

  // Show first tab (scanner)
  switchConsommerTab('scanner');
  modal.classList.remove('hidden');
}

function closeConsommerModal() {
  document.getElementById('consommer-modal').classList.add('hidden');
  consommerScannerStop();
  document.getElementById('consommer-product').value = '';
  document.getElementById('consommer-qty').value = '';
  document.getElementById('consommer-preview').innerHTML = '';
  document.getElementById('consommer-recette').value = '';
  document.getElementById('consommer-recette-qty').value = '';
  document.getElementById('consommer-recette-preview').innerHTML = '';
  document.getElementById('consommer-manuel-nom').value = '';
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
  const productSelect = document.getElementById('consommer-product');
  const qtyInput = document.getElementById('consommer-qty');
  const previewBox = document.getElementById('consommer-preview');

  if (!productSelect.value || !qtyInput.value) {
    previewBox.innerHTML = '';
    return;
  }

  const items = InventoryAPI.getActiveItems();
  const product = items.find(i => i.id === productSelect.value);
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
  const productSelect = document.getElementById('consommer-product');
  const qtyInput = document.getElementById('consommer-qty');
  const qty = parseFloat(qtyInput.value);

  if (!productSelect.value || !qty || qty <= 0) {
    alert('Sélectionnez un produit et une quantité');
    return;
  }

  const items = InventoryAPI.getActiveItems();
  const product = items.find(i => i.id === productSelect.value);
  if (!product) {
    alert('Produit non trouvé');
    return;
  }

  const kcalPer100 = product.calories_per_100 || 0;
  const totalKcal = Math.round(qty * kcalPer100 / 100);

  _enregistrerConsommation(product.name, qty, product.unit, kcalPer100, totalKcal, 'inventaire');
}

function updateConsommerRecettePreview() {
  const recetteSelect = document.getElementById('consommer-recette');
  const qtyInput = document.getElementById('consommer-recette-qty');
  const previewBox = document.getElementById('consommer-recette-preview');

  if (!recetteSelect.value || !qtyInput.value) {
    previewBox.innerHTML = '';
    return;
  }

  const recipe = window.recipesData[recetteSelect.value];
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
  const recetteSelect = document.getElementById('consommer-recette');
  const qtyInput = document.getElementById('consommer-recette-qty');
  const qty = parseFloat(qtyInput.value);

  if (!recetteSelect.value || !qty || qty <= 0) {
    alert('Sélectionnez une recette et une quantité');
    return;
  }

  const recipe = window.recipesData[recetteSelect.value];
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
  const kcalEl = document.getElementById('consommer-manuel-kcal');
  const nom = nomEl.value.trim();
  const totalKcal = parseFloat(kcalEl.value);

  if (!nom || !totalKcal || totalKcal <= 0) {
    alert('Entrez un nom et des calories');
    return;
  }

  _enregistrerConsommation(nom, totalKcal, 'kcal', null, totalKcal, 'manuel');
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

        // Filter out the deleted entry by matching Date, Time, and Product
        const filtered = objects.filter(row => {
          const rowDate = (row.Date || "").trim();
          const rowTime = (row.Time || row.Heure || "").trim();
          const rowProduct = (row.Product || row.Nom || "").trim();

          return !(rowDate === today && rowTime === entry.Heure && rowProduct === entry.Nom);
        });

        // Clear data range and re-append filtered rows
        await window.SheetsAPI.clearSheetRange(`${tabName}!A2:Z999`, token);

        for (const obj of filtered) {
          const row = [
            obj.Date,
            obj.Time || obj.Heure,
            obj.Product || obj.Nom,
            obj.Quantity || obj.Quantité,
            obj.Unit || obj.Unité,
            obj.Total_calories || obj.Kcal_total,
            obj.Type
          ];
          await window.SheetsAPI.appendRowWithToken(tabName, row, token);
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
