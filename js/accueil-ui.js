// js/accueil-ui.js
let selectedMealData = null;
let selectedProduct = null;
let _consommerSelectedProductId = null;
let _consommerSelectedRecetteKey = null;
let _consommerProductDebounce = null;
let _consommerRecetteDebounce = null;

function _normStr(s) {
  return Utils.normalizeString(s);
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
    const items = InventoryAPI.getAllItems();
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
        // Update label and step for product unit
        const invItem = (window.inventoryData || []).find(i => i.id === item.id);
        const unit = invItem?.Unité || item.unit || 'g';
        const label = document.getElementById('consommer-qty-label');
        if (label) label.textContent = `Quantité (${unit}) :`;
        const qtyInput = document.getElementById('consommer-qty');
        if (qtyInput) qtyInput.step = (unit === 'pièce' || unit === 'piece') ? '1' : '0.1';
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

  // Planning number = servings wanted; the recipe is cooked whole and yields
  // `portions_total` servings, so the view shows ceil(servings / yield) whole recipes.
  const meal = (window.todaysMeals || []).find(m => m.name === mealName);
  const portions = meal?.portions || 1;
  const yieldPortions = window.recipesData[recipeID].portions_total || 1;
  const recipeCount = Math.ceil(portions / yieldPortions);

  if (typeof openViewModal === "function") {
    openViewModal(recipeID, recipeCount);
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

function onMangerUnitChange() {
  const unit = document.getElementById('manger-unit').value;
  const label = document.getElementById('manger-qty-label');
  label.textContent = unit === 'portions' ? 'Nombre de portions :' : 'Quantité (g) :';
  updateMangerPreview();
}

function onConsommerRecetteUnitChange() {
  const unit = document.getElementById('consommer-recette-unit').value;
  const label = document.getElementById('consommer-recette-qty-label');
  label.textContent = unit === 'portions' ? 'Nombre de portions :' : 'Quantité (g) :';
  updateConsommerRecettePreview();
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
  document.getElementById('manger-unit')?.addEventListener('change', onMangerUnitChange);
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
  document.getElementById('consommer-recette-unit')?.addEventListener('change', onConsommerRecetteUnitChange);

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
      const mangeInvBtn = e.target.closest('.btn-mange-inv');
      const mangeBtn = e.target.closest('.btn-mange');
      const voirBtn = e.target.closest('.btn-voir');
      if (mangeInvBtn) {
        mangerInventoryItem(mangeInvBtn.dataset.name, parseFloat(mangeInvBtn.dataset.qty) || 0, mangeInvBtn.dataset.unit);
      } else if (mangeBtn) {
        openMangerModal(mangeBtn.dataset.mealName);
      } else if (voirBtn) {
        viewMealRecipe(voirBtn.dataset.mealName);
      }
    });
  }

  // Event delegation for leftover ("Reste") Manger buttons
  const restesContainer = document.getElementById('restes-container');
  if (restesContainer) {
    restesContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-reste-manger');
      if (!btn) return;
      openResteMangerModal({
        recipe: btn.dataset.recipe,
        row: parseInt(btn.dataset.row, 10),
        portionG: parseFloat(btn.dataset.portionG) || 0,
        kcal100: parseFloat(btn.dataset.kcal100) || 0,
        remaining: parseFloat(btn.dataset.remaining) || 0,
      });
    });
  }
}

function renderGreeting() {
  const user = getCurrentUser();
  const greetingEl = document.getElementById('greeting');
  if (greetingEl && user) {
    greetingEl.textContent = `Bonjour ${user}`;
  }
  const dateEl = document.getElementById('date-today');
  if (dateEl) dateEl.textContent = Utils.formatDate(getTodayISO());

  // Fill daily goal
  const objEl = document.getElementById('calorie-objective');
  if (objEl && window.dailyGoal) {
    objEl.textContent = `Objectif: ${window.dailyGoal} kcal`;
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
      <td>${Utils.escapeHTML(entry.Heure || '')}</td>
      <td>${Utils.escapeHTML(entry.Nom || '')}</td>
      <td>${Utils.escapeHTML(entry.Quantité)} ${Utils.escapeHTML(entry.Unité || '')}</td>
      <td>${Utils.escapeHTML(entry.Kcal_total || '0')}</td>
      <td><button class="btn btn-delete" onclick="deleteConsumption(${rawIndex})">✕</button></td>
    `;
    tbody.appendChild(row);
  });
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
