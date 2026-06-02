// Courses list module — reads from Courses sheet

let ingredientMap = {};
let rollingWindow = [];

/**
 * Calculate rolling window of 7 days (today through today+6)
 */
function calculateWeekWindow() {
  const today = new Date();
  const days = [];
  const frenchDays = ['DIMANCHE', 'LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI'];

  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dateISO = Utils.getDateISO(i);

    days.push({
      date: date,
      dateStr: Utils.formatDate(dateISO),
      dayOfWeek: frenchDays[date.getDay()],
      dateISO: dateISO
    });
  }

  return days;
}

/**
 * Build courses rows from meal plan + inventory (with deduction)
 * Returns array of rows for Courses!A2:G sheet
 */
function buildCoursesRows(mealPlanArg, inventoryObjects) {
  const map = {};

  // 1. Aggregate ingredients from recipes
  mealPlanArg.forEach(day => {
    ['Midi', 'Soir'].forEach(slot => {
      const recipeValue = day[slot];
      if (!recipeValue) return;
      const recipeEntries = (() => {
        if (!recipeValue) return [];
        if (Array.isArray(recipeValue)) return recipeValue;
        try {
          const parsed = JSON.parse(recipeValue);
          if (Array.isArray(parsed)) return parsed.map(i => typeof i === 'string' ? {name:i,portions:1} : i);
        } catch(e) {}
        return [{name: recipeValue, portions: 1}];
      })();
      recipeEntries.forEach(entry => {
        const recipeName = entry.name || entry;
        const portions = entry.portions || 1;
        const recipe = Object.values(window.recipesData || {}).find(r => r.name === recipeName);
        if (!recipe?.ingredients) return;
        recipe.ingredients.forEach(ing => {
          const key = Utils.normalizeString(ing.name);
          if (!map[key]) map[key] = { name: ing.name, qty: 0, unit: ing.unit || 'g', days: [] };
          map[key].qty += (parseFloat(ing.quantity) || 0) * portions;
          if (!map[key].days.includes(day.dateISO)) map[key].days.push(day.dateISO);
        });
      });
    });
  });

  // 2. Enrich from inventory + deduct stock
  Object.values(map).forEach(ing => {
    const ingKey = Utils.normalizeString(ing.name);
    const match = inventoryObjects.find(item => {
      const k = Utils.normalizeString(item.Produit);
      return k === ingKey || k.includes(ingKey) || ingKey.includes(k);
    });
    if (match) {
      ing.category = match.Catégorie || 'Autres';
      ing.price = parseFloat(match.Prix) || 0;
      // Store original qty — deduction happens in populateIngredientMap via live inventory lookup
    } else {
      ing.category = 'Autres';
      ing.price = 0;
    }
  });

  // 3. Sort and return rows
  return Object.values(map)
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    .map(ing => [ing.name, ing.category, ing.qty.toFixed(1), ing.unit, ing.price.toFixed(2), ing.days.join(','), '']);
}

/**
 * Generate and write Courses sheet from current mealPlan
 */
/**
 * Ensure Courses sheet has proper headers with Date_utilisation column
 */
async function ensureCoursesHeaders(token) {
  try {
    const headerRow = ['Produit', 'Catégorie', 'Qty', 'Unité', 'Prix', 'Date_utilisation', 'Acheté', 'Ajout'];
    await window.SheetsAPI.batchUpdateRange('Courses!A1:H1', [headerRow], token);
  } catch (err) {
    console.warn('Could not ensure Courses headers:', err);
  }
}

async function generateAndWriteCourses(token, existingAcheté = {}) {
  if (!window.SheetsAPI || !token) return;

  try {
    await ensureCoursesHeaders(token);

    const invRows = await window.SheetsAPI.readSheetTab('Inventory');
    const inventory = window.SheetsAPI.rowsToObjects(invRows);

    const planRows = await window.SheetsAPI.readSheetTab('Planning');
    const planObjects = window.SheetsAPI.rowsToObjects(planRows);
    const tempMealPlan = calculateWeekWindow().map(day => ({
      ...day,
      Midi: planObjects.find(p => p.Date === day.dateISO)?.Midi || null,
      Soir: planObjects.find(p => p.Date === day.dateISO)?.Soir || null
    }));

    let rows = buildCoursesRows(tempMealPlan, inventory);
    rows = rows.map(row => {
      const key = Utils.normalizeString(row[0]);
      row[6] = existingAcheté[key] || '';
      row[7] = 'planning';
      return row;
    });

    // Read current sheet, delete only planning rows — use raw col position (index 7 = col H)
    const existingRaw = await window.SheetsAPI.readSheetTab('Courses', 'A:H');
    const planningRowNums = [];
    for (let i = 1; i < existingRaw.length; i++) { // i=0 is header
      const ajout = (existingRaw[i][7] || '').toString().trim();
      if (ajout === 'planning') planningRowNums.push(i + 1);
    }

    if (planningRowNums.length > 0) {
      await window.SheetsAPI.deleteSheetRows('Courses', planningRowNums, token);
    }

    for (const row of rows) {
      await window.SheetsAPI.appendRowWithToken('Courses', row, token);
    }
  } catch (err) {
    console.warn('Courses sync failed:', err);
  }
}

/**
 * Populate ingredientMap from Courses sheet rows
 */
function populateIngredientMap(objects) {
  ingredientMap = {};
  rollingWindow = calculateWeekWindow();
  const first = rollingWindow[0];
  const last = rollingWindow[6];
  document.getElementById('week-range-label').textContent = `${first.dateStr} – ${last.dateStr}`;
  document.getElementById('loading-state').textContent = '';

  const norm = s => Utils.normalizeString(s);

  objects.forEach((row, idx) => {
    if (!row.Produit) return;
    const isCustom = row.Ajout === 'custom';
    const achetéVal = row.Acheté || '';
    const isChecked = !!achetéVal;

    if (isCustom) {
      const customKey = `${row.Produit}__perso_${idx + 2}`;
      // Auto-derive price from inventory if this product exists there; otherwise no price.
      const invMatch = (window.inventoryData || []).find(item => {
        const k = norm(item.Produit);
        const n = norm(row.Produit);
        return k === n || k.includes(n) || n.includes(k);
      });
      const customPrice = invMatch ? (parseFloat(invMatch.Prix) || 0) : 0;
      ingredientMap[customKey] = {
        name: row.Produit,
        mapKey: customKey,
        category: row.Catégorie || 'Autres',
        totalNeeded: parseFloat(row.Qty) || 0,
        needed: parseFloat(row.Qty) || 0,
        stock: 0,
        unit: row.Unité || 'g',
        price: customPrice,
        days: [],
        acheté: isChecked,
        isCustom: true,
        sheetRow: idx + 2
      };
      return;
    }

    const totalNeeded = parseFloat(row.Qty) || 0;
    const invItem = (window.inventoryData || []).find(item => {
      const k = norm(item.Produit);
      const n = norm(row.Produit);
      return k === n || k.includes(n) || n.includes(k);
    });
    const unit = row.Unité || 'g';
    const invUnit = invItem ? (invItem.Unité || 'g') : unit;
    const unitMatch = unit === invUnit ||
      (unit === 'piece' && invUnit === 'pièce') ||
      (unit === 'pièce' && invUnit === 'piece');
    const stock = (invItem && unitMatch) ? (parseFloat(invItem.Qty) || 0) : 0;
    const needed = Math.max(0, totalNeeded - stock);

    ingredientMap[row.Produit] = {
      name: row.Produit,
      mapKey: row.Produit,
      category: row.Catégorie || 'Autres',
      totalNeeded,
      needed,
      stock,
      unit,
      price: parseFloat(row.Prix) || 0,
      days: row['Date_utilisation'] ? row['Date_utilisation'].split(',').filter(Boolean) : [],
      acheté: isChecked,
      isCustom: false,
      sheetRow: idx + 2
    };
  });

  // Inject low-stock products: inventory items below their reorder threshold (Min_qty)
  // that aren't already covered by the meal-plan list. Self-maintaining: they disappear
  // once the stock is replenished above the threshold.
  (window.inventoryData || []).forEach(item => {
    const minQty = parseFloat(item.minQty) || 0;
    if (minQty <= 0) return;
    const qty = parseFloat(item.Qty) || 0;
    if (qty >= minQty) return;
    const key = norm(item.Produit);
    const existing = Object.values(ingredientMap).find(ing => norm(ing.name) === key);
    if (existing) {
      existing.isLowStock = true;
      return;
    }
    const shortfall = minQty - qty;
    ingredientMap[`${item.Produit}__lowstock`] = {
      name: item.Produit,
      mapKey: `${item.Produit}__lowstock`,
      category: item.Catégorie || 'Autres',
      totalNeeded: minQty,
      needed: shortfall,
      stock: qty,
      unit: item.Unité || 'g',
      price: parseFloat(item.Prix) || 0,
      days: [],
      acheté: false,
      isCustom: false,
      isLowStock: true,
      sheetRow: null
    };
  });
}

/**
 * Color day badges based on date: red (today), yellow (tomorrow+1), green (rest), gray (past)
 */
function colorDayBadges() {
  const today = new Date();
  const todayDay = today.getDate();
  const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const todayAbbr = dayNames[today.getDay()];
  const tomorrowDay = todayDay + 1;
  const tomorrowAbbr = dayNames[(today.getDay() + 1) % 7];
  const dayAfterDay = todayDay + 2;
  const dayAfterAbbr = dayNames[(today.getDay() + 2) % 7];

  document.querySelectorAll('span[style*="background:#e8f5e9"]').forEach(span => {
    const text = span.textContent.trim();
    const parts = text.split(/\s+/);
    const day = parts[0];
    const dayNum = parseInt(parts[1]);

    let bgColor = '#e8f5e9';
    if (day === todayAbbr && dayNum === todayDay) bgColor = '#ffcdd2';
    else if ((day === tomorrowAbbr && dayNum === tomorrowDay) ||
             (day === dayAfterAbbr && dayNum === dayAfterDay)) bgColor = '#fff9c4';
    else if (dayNum < todayDay) bgColor = '#e0e0e0';

    span.style.background = bgColor;
  });

  // Strike entire item if ALL dates are past
  const todayISO = new Date().toISOString().split('T')[0];
  Object.values(ingredientMap).forEach(ing => {
    // Check if all dates for this ingredient are past
    const allPast = ing.days && ing.days.length > 0 && ing.days.every(dateISO => dateISO < todayISO);

    if (allPast) {
      // Find label element for this ingredient
      document.querySelectorAll('#courses-list label').forEach(label => {
        const ingName = label.querySelector('span')?.textContent.split('(')[0].trim();
        if (ingName === ing.name) {
          label.classList.add('past-day');
        }
      });
    }
  });
}

/**
 * Render the courses list into DOM, grouped by category
 */
function renderCoursesList() {
  const container = document.getElementById('courses-list');

  // Separate into "to buy" and "in stock"
  const toBuy = Object.values(ingredientMap).filter(ing => ing.needed > 0);
  const inStock = Object.values(ingredientMap).filter(ing => ing.needed <= 0);

  // Calculate total price
  const totalPrice = toBuy.reduce((sum, ing) => sum + (ing.price || 0), 0);

  // Group by category
  function groupByCategory(items) {
    const groups = {};
    items.forEach(ing => {
      const cat = ing.category || 'Autres';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(ing);
    });
    return groups;
  }

  function sortGroup(group) {
    return group.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }

  let html = '';

  if (toBuy.length > 0) {
    html += `<div style="text-align:center;font-size:17px;font-weight:bold;color:#2E7D32;margin:0 0 8px;">Budget estimé : ~${totalPrice.toFixed(2)}€</div>`;
  }

  if (toBuy.length > 0) {
    const toBuyGroups = groupByCategory(toBuy);
    const categories = Object.keys(toBuyGroups).sort();

    categories.forEach(cat => {
      html += `<div class="cat">${cat}</div>`;
      sortGroup(toBuyGroups[cat]).forEach(ing => {
        html += renderIngredientItem(ing);
      });
    });
  }

  if (inStock.length > 0) {
    html += '<div class="cat in-stock">En stock ✓</div>';
    const inStockGroups = groupByCategory(inStock);
    const categories = Object.keys(inStockGroups).sort();

    categories.forEach(cat => {
      html += `<div class="cat in-stock" style="margin-top: 8px; margin-bottom: 2px;">${cat}</div>`;
      sortGroup(inStockGroups[cat]).forEach(ing => {
        html += renderIngredientItem(ing, true);
      });
    });
  }

  container.innerHTML = html;

  // Attach checkbox listeners
  document.querySelectorAll('#courses-list input[type="checkbox"]').forEach((checkbox) => {
    const key = checkbox.dataset.key;
    const ing = ingredientMap[key];
    if (!ing) return;

    checkbox.checked = ing.acheté;
    if (checkbox.checked) checkbox.parentElement.classList.add('done');

    checkbox.addEventListener('change', async () => {
      checkbox.parentElement.classList.toggle('done', checkbox.checked);
      ing.acheté = checkbox.checked;
      const token = window.getAccessToken ? window.getAccessToken() : null;
      if (token && window.SheetsAPI && ing.sheetRow) {
        try {
          const val = checkbox.checked ? Utils.getDateISO(0) : '';
          await window.SheetsAPI.updateSheetCell(`Courses!G${ing.sheetRow}`, val, token);
        } catch (e) { console.error('Failed to update Acheté:', e); }
      }
      updateProgress();
    });
  });

  updateProgress();
  colorDayBadges();
}

/**
 * Render a single ingredient item with badges
 */
function renderIngredientItem(ing, dimmed = false) {
  const today = new Date();
  const todayDay = today.getDate();
  const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const todayAbbr = dayNames[today.getDay()];

  const dimmClass = dimmed ? ' dimmed' : '';
  const stockStr = ing.stock > 0
    ? `<span style="color:#2E7D32;">${ing.stock.toFixed(0)}</span>`
    : `<span style="color:#c62828;">0</span>`;
  let qtyDisplay = '';
  if (ing.totalNeeded > 0) {
    qtyDisplay = ` <small style="font-size:0.85em;">(${stockStr}<span style="color:#999;"> / ${ing.totalNeeded.toFixed(0)}${ing.unit}</span>)</small>`;
  } else if (ing.stock > 0) {
    qtyDisplay = ` <small style="font-size:0.85em;color:#2E7D32;">(${ing.stock.toFixed(0)}${ing.unit})</small>`;
  }

  const priceText = ing.price > 0 ? `${ing.price.toFixed(2)}€` : '-€';

  let dayBadges = '';
  const todayISO = today.toISOString().split('T')[0];
  ing.days.forEach(dateISO => {
    const d = new Date(dateISO);
    const dayNum = d.getDate();
    const dayAbbr = dayNames[d.getDay()];
    let badgeColor = '#e8f5e9';

    if (dateISO === todayISO) {
      badgeColor = '#ffcdd2';
    } else if (dateISO < todayISO) {
      badgeColor = '#e0e0e0';
    } else {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowISO = tomorrow.toISOString().split('T')[0];
      const dayAfter = new Date(today);
      dayAfter.setDate(dayAfter.getDate() + 2);
      const dayAfterISO = dayAfter.toISOString().split('T')[0];
      if (dateISO === tomorrowISO || dateISO === dayAfterISO) {
        badgeColor = '#fff9c4';
      }
    }

    dayBadges += `<span style="background:${badgeColor};padding:1px 4px;margin-right:2px;border-radius:2px;">${dayAbbr} ${dayNum}</span>`;
  });

  const customBadge = ing.isCustom
    ? ' <small style="color:#E65100;font-size:0.75em;">(perso)</small>' : '';
  const lowStockBadge = ing.isLowStock
    ? ' <small style="color:#c62828;font-size:0.75em;" title="Stock sous le seuil de réappro">📉 stock bas</small>' : '';
  const safeKey = Utils.escapeHTML(String(ing.mapKey || ing.name).replace(/'/g, "\\'"));
  const safeName = Utils.escapeHTML(ing.name);
  const safeNameAttr = Utils.escapeHTML(String(ing.name).replace(/'/g, "\\'"));
  const deleteBtn = ing.isCustom
    ? `<button onclick="deleteCustomItem('${safeKey}',event)"
         style="background:none;border:none;color:#bbb;cursor:pointer;font-size:18px;padding:0 4px;line-height:1;">×</button>`
    : '';

  return `
    <label${dimmClass} style="position:relative;">
      <input type="checkbox" data-key="${safeKey}" />
      <span style="flex:1;">
        ${safeName}${customBadge}${lowStockBadge}${qtyDisplay}
        <div style="color:#2E7D32;font-size:0.75em;margin-top:2px;">${dayBadges}</div>
      </span>
      <div class="price-correction">
        <span class="price-display">${priceText}</span>
        ${ing.isCustom ? deleteBtn : `<button class="price-edit-btn" onclick="openEditModal('${safeNameAttr}')">Corriger</button>`}
      </div>
    </label>
  `;
}

/**
 * Update progress counter
 */
function updateProgress() {
  const allBoxes = document.querySelectorAll('#courses-list input[type="checkbox"]');
  const checked = Array.from(allBoxes).filter(b => b.checked).length;
  const percent = allBoxes.length > 0 ? Math.round((checked / allBoxes.length) * 100) : 0;
  document.getElementById('progress').textContent = `${checked} / ${allBoxes.length} articles cochés (${percent}%)`;
}

async function deleteCustomItem(mapKey, e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  const ing = ingredientMap[mapKey];
  if (!ing || !ing.isCustom) return;
  const token = window.getAccessToken ? window.getAccessToken() : null;
  if (token && window.SheetsAPI && ing.sheetRow) {
    try {
      await window.SheetsAPI.deleteSheetRow('Courses', ing.sheetRow, token);
      Object.values(ingredientMap).forEach(i => { if (i.sheetRow > ing.sheetRow) i.sheetRow--; });
    } catch (e) { console.error('Failed to delete custom item:', e); }
  }
  delete ingredientMap[mapKey];
  renderCoursesList();
}

let _customDebounce = null;

function initCustomAutocomplete() {
  const input = document.getElementById('item-name');
  if (!input) return;
  input.addEventListener('input', e => {
    clearTimeout(_customDebounce);
    _customDebounce = setTimeout(() => {
      const q = e.target.value.trim();
      const dd = document.getElementById('custom-item-dropdown');
      if (q.length < 2) { dd.style.display = 'none'; return; }
      const norm = s => Utils.normalizeString(s);
      const matches = (window.inventoryData || [])
        .filter(i => norm(i.Produit).includes(norm(q))).slice(0, 5);
      if (!matches.length) { dd.style.display = 'none'; return; }
      dd.innerHTML = '';
      matches.forEach(item => {
        const div = document.createElement('div');
        div.style.cssText = 'padding:8px 12px;cursor:pointer;font-size:14px;';
        div.textContent = item.Produit;
        div.addEventListener('mouseover', () => div.style.background = '#f0f0f0');
        div.addEventListener('mouseout', () => div.style.background = '');
        div.addEventListener('click', () => {
          input.value = item.Produit;
          input.dataset.category = item.Catégorie || 'Autres';
          const catEl = document.getElementById('item-category');
          if (catEl) catEl.value = item.Catégorie || 'Autres';
          document.getElementById('item-unit').value = item.Unité || 'g';
          dd.style.display = 'none';
        });
        dd.appendChild(div);
      });
      dd.style.display = 'block';
    }, 300);
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('#modal-overlay')) {
      const dd = document.getElementById('custom-item-dropdown');
      if (dd) dd.style.display = 'none';
    }
  });
}

function showAddModal() {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('hidden');
  overlay.classList.add('open');
  document.getElementById('item-name').value = '';
  document.getElementById('item-name').dataset.category = '';
  document.getElementById('item-category').value = 'Autres';
  document.getElementById('item-qty').value = '';
  document.getElementById('item-unit').value = 'g';
  setTimeout(() => { document.getElementById('item-name').focus(); initCustomAutocomplete(); }, 50);
}

function hideAddModal() {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.add('hidden');
  overlay.classList.remove('open');
  const dd = document.getElementById('custom-item-dropdown');
  if (dd) dd.style.display = 'none';
}

function hideModal(e) {
  if (e.target === document.getElementById('modal-overlay')) hideAddModal();
}

async function saveCustomItem() {
  const nameEl = document.getElementById('item-name');
  const name = nameEl.value.trim();
  if (!name) { nameEl.focus(); return; }
  const qty = document.getElementById('item-qty').value || '0';
  const unit = document.getElementById('item-unit').value || 'g';
  const category = nameEl.dataset.category || 'Autres';
  // Price is auto-derived from inventory at load time (see ingredientMap build), not entered here.
  const token = window.getAccessToken ? window.getAccessToken() : null;
  if (token && window.SheetsAPI) {
    try {
      await window.SheetsAPI.appendRowWithToken('Courses',
        [name, category, qty, unit, '0', Utils.getDateISO(0), '', 'custom'], token);
      hideAddModal();
      await initCourses();
    } catch (e) { console.error('Failed to add custom item:', e); }
  }
}

document.addEventListener('keydown', (e) => {
  if (!document.getElementById('modal-overlay').classList.contains('active')) return;
  if (e.key === 'Enter') saveCustomItem();
  if (e.key === 'Escape') hideAddModal();
});

// Edit modal
function openEditModal(ingredientName) {
  const ing = ingredientMap[ingredientName];
  if (!ing) return;

  const modal = document.getElementById('edit-modal');
  document.getElementById('edit-ingredient-name').value = ing.name;
  document.getElementById('edit-ingredient-category').value = ing.category || '';
  document.getElementById('edit-ingredient-quantity').value = ing.needed.toFixed(1);
  document.getElementById('edit-ingredient-unit').value = ing.unit || 'g';
  document.getElementById('edit-ingredient-price').value = ing.price.toFixed(2);

  modal.setAttribute('aria-hidden', 'false');
  modal.classList.remove('hidden');
  modal.setAttribute('data-ingredient-name', ing.name);
}

function closeEditModal() {
  const modal = document.getElementById('edit-modal');
  modal.setAttribute('aria-hidden', 'true');
  modal.classList.add('hidden');
  modal.removeAttribute('data-ingredient-name');
}

async function saveEditedIngredient(e) {
  e.preventDefault();

  const ingredientName = document.getElementById('edit-modal').getAttribute('data-ingredient-name');
  const ing = ingredientMap[ingredientName];
  if (!ing) return;

  const category = document.getElementById('edit-ingredient-category').value || ing.category;
  const quantity = document.getElementById('edit-ingredient-quantity').value || ing.needed;
  const unit = document.getElementById('edit-ingredient-unit').value || ing.unit;
  const price = document.getElementById('edit-ingredient-price').value || ing.price;

  ing.category = category;
  ing.needed = parseFloat(quantity);
  ing.unit = unit;
  ing.price = parseFloat(price);

  try {
    const token = window.getAccessToken ? window.getAccessToken() : null;
    if (token && window.SheetsAPI) {
      const range = `Courses!A${ing.sheetRow}:G${ing.sheetRow}`;
      await window.SheetsAPI.batchUpdateRange(range, [[ing.name, category, quantity, unit, price.toFixed(2), ing.days.join(','), ing.acheté ? '1' : '']], token);
    }
  } catch (err) {
    console.warn('Failed to save to Sheets:', err);
  }

  closeEditModal();
  renderCoursesList();
}

document.addEventListener('DOMContentLoaded', () => {
  const editForm = document.getElementById('edit-form');
  if (editForm) {
    editForm.addEventListener('submit', saveEditedIngredient);
  }
});

/**
 * Initialize courses page
 */
async function initCourses() {
  UserContext.applyUserStyling();
  UserContext.initializeUserToggle();
  if (window.loadConversionFactors) await window.loadConversionFactors();  // Load unit conversions

  document.getElementById('loading-state').textContent = 'Chargement...';

  try {
    const rows = await SheetsAPI.readSheetTab('Courses', 'A:H');
    let objects = SheetsAPI.rowsToObjects(rows);

    if (typeof loadInventory === 'function') await loadInventory();

    // Supprimer customs expirés (cochés avant aujourd'hui)
    const token = window.getAccessToken ? window.getAccessToken() : null;
    if (token && window.SheetsAPI) {
      const todayISO = Utils.getDateISO(0);
      const toDelete = objects
        .map((r, idx) => ({ r, rowNum: idx + 2 }))
        .filter(({ r }) => r.Ajout === 'custom' && r.Acheté && r.Acheté < todayISO);
      for (const { rowNum } of toDelete.sort((a, b) => b.rowNum - a.rowNum)) {
        await SheetsAPI.deleteSheetRow('Courses', rowNum, token);
      }
      if (toDelete.length > 0) {
        // Re-lire après suppression pour avoir les bons sheetRow
        const fresh = await SheetsAPI.readSheetTab('Courses', 'A:H');
        objects = SheetsAPI.rowsToObjects(fresh);
      }
    }

    populateIngredientMap(objects);
    renderCoursesList();
  } catch (error) {
    console.error('Error loading courses:', error);
    document.getElementById('loading-state').textContent = 'Erreur au chargement. Vérifiez votre connexion.';
  }
}

document.addEventListener('DOMContentLoaded', initCourses);
