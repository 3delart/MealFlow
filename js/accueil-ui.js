// js/accueil-ui.js
let selectedMealData = null;
let selectedProduct = null;

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

  // Event listeners for Consommer modal
  document.getElementById('consommer-btn').addEventListener('click', openConsommerModal);
  document.getElementById('close-consommer-modal').addEventListener('click', closeConsommerModal);
  document.getElementById('consommer-form').addEventListener('submit', submitConsommer);
  document.getElementById('consommer-qty').addEventListener('input', updateConsommerPreview);
  document.getElementById('consommer-product').addEventListener('change', updateConsommerPreview);

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
  const selectGroup = document.getElementById('manger-meal')?.parentElement;

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
    if (selectGroup) selectGroup.style.display = 'none'; // Hide dropdown, meal already selected
    updateMangerPreview();
  } else {
    if (selectGroup) selectGroup.style.display = 'block';
  }

  document.getElementById('manger-qty').value = '';
  document.getElementById('manger-qty').focus();
  modal.classList.remove('hidden');
}

function closeMangerModal() {
  document.getElementById('manger-modal').classList.add('hidden');
  document.getElementById('manger-form').reset();
  document.getElementById('manger-preview').innerHTML = '';
  const selectGroup = document.getElementById('manger-meal')?.parentElement;
  if (selectGroup) selectGroup.style.display = 'block'; // Restore dropdown visibility
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

// TASK 5: Consommer Modal Functions
function openConsommerModal() {
  const modal = document.getElementById('consommer-modal');
  const select = document.getElementById('consommer-product');

  // Populate products dropdown from inventory
  select.innerHTML = '<option value="">-- Sélectionner --</option>';
  const items = InventoryAPI.getActiveItems();
  items.forEach(item => {
    const option = document.createElement('option');
    option.value = item.ID;
    option.textContent = item.Produit;
    option.dataset.kcalPer100 = item.Kcal_per_100;
    option.dataset.unit = item.Unité;
    select.appendChild(option);
  });

  modal.classList.remove('hidden');
}

function closeConsommerModal() {
  document.getElementById('consommer-modal').classList.add('hidden');
  document.getElementById('consommer-form').reset();
  document.getElementById('consommer-preview').innerHTML = '';
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
  const product = items.find(i => i.ID === productSelect.value);
  if (!product) return;

  const qty = parseFloat(qtyInput.value);
  const kcalPer100 = parseFloat(product.Kcal_per_100) || 0;
  const totalKcal = Utils.calcPortionKcal(qty, kcalPer100);

  previewBox.innerHTML = `
    <div style="padding: 12px; background-color: var(--color-bg); border-radius: 6px;">
      <p style="margin: 0; font-size: 0.9em;"><strong>${product.Produit}</strong></p>
      <p style="margin: 4px 0 0 0; font-size: 0.85em; color: var(--color-text-light);">${qty} ${product.Unité} · ${totalKcal} kcal</p>
    </div>
  `;
}

async function submitConsommer(e) {
  e.preventDefault();

  const productSelect = document.getElementById('consommer-product');
  const qtyInput = document.getElementById('consommer-qty');

  if (!productSelect.value || !qtyInput.value) {
    Utils.showToast('Veuillez remplir tous les champs', 'error');
    return;
  }

  const items = InventoryAPI.getActiveItems();
  const product = items.find(i => i.ID === productSelect.value);
  if (!product) {
    Utils.showToast('Produit non trouvé', 'error');
    return;
  }

  const qty = parseFloat(qtyInput.value);
  const kcalPer100 = parseFloat(product.Kcal_per_100) || 0;
  const totalKcal = Math.round(Utils.calcPortionKcal(qty, kcalPer100));

  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const date = Utils.getTodayISO();

  try {
    const email = UserContext.getCurrentEmail();
    const tabName = `History_${email}`;
    const values = [date, time, product.Produit, qty, product.Unité, totalKcal, 'consommer', productSelect.value];

    await SheetsAPI.appendRow(tabName, values, Auth.getToken());

    closeConsommerModal();
    loadTodayHistory();
    renderConsumptionLog();
    Utils.showToast('Consommation enregistrée', 'success');
  } catch (err) {
    console.error('Error submitting consommer:', err);
    Utils.showToast('Erreur d\'enregistrement', 'error');
  }
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
