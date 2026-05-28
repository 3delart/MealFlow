// js/accueil-ui.js
let todayConsumptions = [];
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

  initAccueil();

  // Event listeners for Manger modal
  document.getElementById('manger-btn').addEventListener('click', openMangerModal);
  document.getElementById('close-manger-modal').addEventListener('click', closeMangerModal);
  document.getElementById('manger-form').addEventListener('submit', submitManger);
  document.getElementById('manger-qty').addEventListener('input', updateMangerPreview);

  // Event listeners for Consommer modal
  document.getElementById('consommer-btn').addEventListener('click', openConsommerModal);
  document.getElementById('close-consommer-modal').addEventListener('click', closeConsommerModal);
  document.getElementById('consommer-form').addEventListener('submit', submitConsommer);
  document.getElementById('consommer-qty').addEventListener('input', updateConsommerPreview);
  document.getElementById('consommer-product').addEventListener('change', updateConsommerPreview);

  window.addEventListener('auth-changed', async (e) => {
    if (e.detail.email) {
      await UserContext.init(e.detail.email);
      initAccueil();
    }
  });
});

function initAccueil() {
  renderGreeting();
  loadTodayHistory();
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

  if (todayConsumptions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--color-text-light);">Aucune consommation</td></tr>';
    return;
  }

  todayConsumptions.forEach((entry, index) => {
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
function openMangerModal() {
  const modal = document.getElementById('manger-modal');
  const select = document.getElementById('manger-meal');

  // Populate meals dropdown from RecipesAPI
  select.innerHTML = '<option value="">-- Sélectionner --</option>';
  const recipes = RecipesAPI.getRecipeList();
  recipes.forEach(r => {
    const option = document.createElement('option');
    option.value = r.id;
    option.textContent = r.name;
    select.appendChild(option);
  });

  modal.classList.remove('hidden');
}

function closeMangerModal() {
  document.getElementById('manger-modal').classList.add('hidden');
  document.getElementById('manger-form').reset();
  document.getElementById('manger-preview').innerHTML = '';
}

function updateMangerPreview() {
  const mealSelect = document.getElementById('manger-meal');
  const qtyInput = document.getElementById('manger-qty');
  const previewBox = document.getElementById('manger-preview');

  if (!mealSelect.value || !qtyInput.value) {
    previewBox.innerHTML = '';
    return;
  }

  const recipe = RecipesAPI.getRecipe(mealSelect.value);
  const qty = parseFloat(qtyInput.value);
  const kcalPer100g = RecipesAPI.calcKcalPer100g(mealSelect.value);
  const totalKcal = Utils.calcPortionKcal(qty, kcalPer100g);

  previewBox.innerHTML = `
    <div style="padding: 12px; background-color: var(--color-bg); border-radius: 6px;">
      <p style="margin: 0; font-size: 0.9em;"><strong>${recipe.name}</strong></p>
      <p style="margin: 4px 0 0 0; font-size: 0.85em; color: var(--color-text-light);">${qty}g · ${totalKcal} kcal</p>
    </div>
  `;
}

async function submitManger(e) {
  e.preventDefault();

  const mealSelect = document.getElementById('manger-meal');
  const qtyInput = document.getElementById('manger-qty');

  if (!mealSelect.value || !qtyInput.value) {
    Utils.showToast('Veuillez remplir tous les champs', 'error');
    return;
  }

  const recipe = RecipesAPI.getRecipe(mealSelect.value);
  const qty = parseFloat(qtyInput.value);
  const kcalPer100g = RecipesAPI.calcKcalPer100g(mealSelect.value);
  const totalKcal = Math.round(Utils.calcPortionKcal(qty, kcalPer100g));

  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const date = Utils.getTodayISO();

  try {
    const email = UserContext.getCurrentEmail();
    const tabName = `History_${email}`;
    const values = [date, time, recipe.name, qty, 'g', totalKcal, 'manger', mealSelect.value];

    await SheetsAPI.appendRow(tabName, values, Auth.getToken());

    closeMangerModal();
    loadTodayHistory();
    renderConsumptionLog();
    Utils.showToast('Repas enregistré', 'success');
  } catch (err) {
    console.error('Error submitting manger:', err);
    Utils.showToast('Erreur d\'enregistrement', 'error');
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
function deleteConsumption(index) {
  if (confirm('Êtes-vous sûr de vouloir supprimer cette consommation ?')) {
    todayConsumptions.splice(index, 1);
    renderConsumptionLog();
    Utils.showToast('Consommation supprimée', 'success');
  }
}
