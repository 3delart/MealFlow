// js/accueil-ui.js
let todayHistory = [];
let selectedMealData = null;

document.addEventListener('DOMContentLoaded', async () => {
  const email = await Auth.init();
  if (!email) {
    Auth.showLoginButton();
    return;
  }

  await UserContext.init(email);
  await RecipesAPI.load();
  await InventoryAPI.load();

  renderGreeting();
  await loadTodayHistory();
  renderProgress();
  renderJournal();

  document.getElementById('log-meal-btn').addEventListener('click', openMealModal);
  document.getElementById('cancel-meal-btn').addEventListener('click', closeMealModal);
  document.getElementById('meal-form').addEventListener('submit', handleLogMeal);

  document.querySelectorAll('.meal-option').forEach(btn => {
    btn.addEventListener('click', () => selectMealOption(btn.dataset.option));
  });

  window.addEventListener('auth-changed', async (e) => {
    if (e.detail.email) {
      await UserContext.init(e.detail.email);
      renderGreeting();
      await loadTodayHistory();
      renderProgress();
      renderJournal();
    }
  });
});

function renderGreeting() {
  const profile = UserContext.getCurrentProfile();
  if (profile) {
    document.getElementById('greeting').textContent = `Bonjour ${profile.name}`;
  }
  document.getElementById('date-today').textContent = Utils.getLocaleDateFr(Utils.getTodayISO());
}

async function loadTodayHistory() {
  const user = UserContext.getCurrentUser();
  if (!user) return;

  const tabName = `History_${user}`;
  const rows = await SheetsAPI.readTab(tabName);
  if (!rows) {
    todayHistory = [];
    return;
  }

  const today = Utils.getTodayISO();
  const history = SheetsAPI.rowsToObjects(rows);
  todayHistory = history.filter(h => h.Date === today).reverse();
}

function renderProgress() {
  const profile = UserContext.getCurrentProfile();
  if (!profile) return;

  const target = profile.calorieTarget;
  const consumed = todayHistory.reduce((sum, h) => sum + (parseInt(h.Kcal_total) || 0), 0);
  const percent = Math.min((consumed / target) * 100, 100);

  const svg = document.getElementById('progress-circle');
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);

  svg.setAttribute('viewBox', '0 0 120 120');
  svg.setAttribute('width', '120');
  svg.setAttribute('height', '120');

  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  bg.setAttribute('cx', '60');
  bg.setAttribute('cy', '60');
  bg.setAttribute('r', radius);
  bg.setAttribute('fill', 'none');
  bg.setAttribute('stroke', 'var(--primary-border)');
  bg.setAttribute('stroke-width', '8');
  svg.appendChild(bg);

  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', '60');
  circle.setAttribute('cy', '60');
  circle.setAttribute('r', radius);
  circle.setAttribute('fill', 'none');
  circle.setAttribute('stroke', percent > 100 ? 'var(--warning)' : 'var(--primary)');
  circle.setAttribute('stroke-width', '8');
  circle.setAttribute('stroke-dasharray', circumference);
  circle.setAttribute('stroke-dashoffset', offset);
  circle.setAttribute('transform', 'rotate(-90 60 60)');
  svg.appendChild(circle);

  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  text.setAttribute('x', '60');
  text.setAttribute('y', '65');
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('font-size', '20');
  text.setAttribute('font-weight', 'bold');
  text.textContent = `${Math.round(percent)}%`;
  svg.appendChild(text);

  document.getElementById('progress-text').textContent = `${consumed} / ${target} kcal`;
}

function renderJournal() {
  const list = document.getElementById('journal-list');
  list.innerHTML = '';

  if (todayHistory.length === 0) {
    list.innerHTML = '<p style="color: var(--text-secondary);">Aucune entrée aujourd\'hui</p>';
    return;
  }

  todayHistory.forEach(entry => {
    const emoji = entry.Type === 'recette' ? '🍽️' : entry.Type === 'scanner' ? '📱' : entry.Type === 'inventaire' ? '📦' : '✏️';
    const card = document.createElement('div');
    card.className = 'card journal-entry';
    card.innerHTML = `
      <div class="entry-header">
        <span class="entry-emoji">${emoji}</span>
        <span class="entry-name">${entry.Nom}</span>
        <span class="entry-time">${entry.Heure}</span>
      </div>
      <div class="entry-details">${entry.Quantité} ${entry.Unité} · <strong>${entry.Kcal_total} kcal</strong></div>
    `;
    list.appendChild(card);
  });
}

function openMealModal() {
  document.getElementById('log-meal-modal').classList.remove('hidden');
}

function closeMealModal() {
  document.getElementById('log-meal-modal').classList.add('hidden');
  document.getElementById('meal-form-container').classList.add('hidden');
  document.getElementById('meal-form').reset();
  selectedMealData = null;
}

async function selectMealOption(option) {
  const container = document.getElementById('meal-form-container');
  container.classList.remove('hidden');

  if (option === 'scanner') {
    startScanner();
  } else if (option === 'recipe') {
    showRecipePicker();
  } else if (option === 'inventory') {
    showInventoryPicker();
  } else if (option === 'manual') {
    showManualEntry();
  }
}

function showRecipePicker() {
  const recipes = RecipesAPI.getRecipeList();
  const html = recipes.map(r => `
    <div class="picker-item" data-id="${r.id}">
      <div>${r.name}</div>
      <div style="font-size: 0.8em; color: var(--text-secondary);">${Math.round(r.kcalPer100g)} kcal/100g</div>
    </div>
  `).join('');

  const container = document.querySelector('.meal-options');
  container.innerHTML = html;
  container.querySelectorAll('.picker-item').forEach(item => {
    item.addEventListener('click', () => {
      const recipeId = item.dataset.id;
      selectedMealData = { type: 'recipe', id: recipeId };
      document.getElementById('meal-qty').focus();
    });
  });
}

function showInventoryPicker() {
  const items = InventoryAPI.getActiveItems();
  const html = items.map(i => `
    <div class="picker-item" data-id="${i.ID}">
      <div>${i.Produit}</div>
      <div style="font-size: 0.8em; color: var(--text-secondary);">${i.Qty} ${i.Unité} · ${i.Kcal_per_100} kcal/100g</div>
    </div>
  `).join('');

  const container = document.querySelector('.meal-options');
  container.innerHTML = html;
  container.querySelectorAll('.picker-item').forEach(item => {
    item.addEventListener('click', () => {
      const itemId = item.dataset.id;
      selectedMealData = { type: 'inventory', id: itemId };
      document.getElementById('meal-qty').focus();
    });
  });
}

function showManualEntry() {
  document.getElementById('meal-kcal-label').classList.remove('hidden');
  document.getElementById('meal-kcal').classList.remove('hidden');
  selectedMealData = { type: 'manual' };
}

async function handleLogMeal(e) {
  e.preventDefault();

  if (!selectedMealData) return;

  const qty = parseFloat(document.getElementById('meal-qty').value);
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const date = Utils.getTodayISO();

  let kcal = 0;
  let name = '';
  let type = selectedMealData.type;
  let recipeId = '';
  let unit = 'g';

  if (type === 'recipe') {
    const recipe = RecipesAPI.getRecipe(selectedMealData.id);
    name = recipe.name;
    const kcalPer100g = RecipesAPI.calcKcalPer100g(selectedMealData.id);
    kcal = Utils.calcPortionKcal(qty, kcalPer100g);
    recipeId = selectedMealData.id;
  } else if (type === 'inventory') {
    const item = InventoryAPI.getActiveItems().find(i => i.ID === selectedMealData.id);
    name = item.Produit;
    kcal = Utils.calcPortionKcal(qty, parseFloat(item.Kcal_per_100));
    unit = item.Unité;
  } else if (type === 'manual') {
    name = 'Saisie manuelle';
    kcal = parseFloat(document.getElementById('meal-kcal').value);
  }

  try {
    const values = [date, time, name, qty, unit, Math.round(kcal), type, recipeId];
    const user = UserContext.getCurrentUser();
    const tabName = `History_${user}`;

    await SheetsAPI.appendRow(tabName, values, Auth.getToken());

    closeMealModal();
    await loadTodayHistory();
    renderProgress();
    renderJournal();
    Utils.showToast('Repas enregistré', 'success');
  } catch (e) {
    Utils.showToast('Erreur d\'enregistrement', 'error');
  }
}

function startScanner() {
  // Scanner logic will depend on html5-qrcode library
  // For now, placeholder
}
