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
      const recipeName = day[slot];
      if (!recipeName) return;
      const recipe = Object.values(window.recipesData || {}).find(r => r.name === recipeName);
      if (!recipe?.ingredients) return;
      recipe.ingredients.forEach(ing => {
        const key = ing.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();
        if (!map[key]) map[key] = { name: ing.name, qty: 0, unit: ing.unit || 'g', days: [] };
        map[key].qty += parseFloat(ing.quantity) || 0;
        if (!map[key].days.includes(day.dateISO)) map[key].days.push(day.dateISO);
      });
    });
  });

  // 2. Enrich from inventory + deduct stock
  Object.values(map).forEach(ing => {
    const ingKey = ing.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();
    const match = inventoryObjects.find(item => {
      const k = (item.Produit||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();
      return k === ingKey || k.includes(ingKey) || ingKey.includes(k);
    });
    if (match) {
      ing.category = match.Catégorie || 'Autres';
      ing.price = parseFloat(match.Prix) || 0;
      const stock = parseFloat(match.Qty) || 0;
      const unitMatch = ing.unit === match.Unité ||
        (ing.unit === 'piece' && match.Unité === 'pièce') ||
        (ing.unit === 'pièce' && match.Unité === 'piece');
      if (unitMatch) ing.qty = Math.max(0, ing.qty - stock);
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
async function generateAndWriteCourses(token, existingAcheté = {}) {
  if (!window.SheetsAPI || !token) return;

  try {
    const invRows = await window.SheetsAPI.readSheetTab('Inventory');
    const inventory = window.SheetsAPI.rowsToObjects(invRows);

    // Build a temporary mealPlan from Planning sheet for generation
    const planRows = await window.SheetsAPI.readSheetTab('Planning');
    const planObjects = window.SheetsAPI.rowsToObjects(planRows);
    const tempMealPlan = calculateWeekWindow().map(day => ({
      ...day,
      Midi: planObjects.find(p => p.Date === day.dateISO)?.Midi || null,
      Soir: planObjects.find(p => p.Date === day.dateISO)?.Soir || null
    }));

    let rows = buildCoursesRows(tempMealPlan, inventory);

    rows = rows.map(row => {
      const key = row[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();
      row[6] = existingAcheté[key] || '';
      return row;
    });

    await window.SheetsAPI.batchUpdateRange('Courses!A2:G1000', rows, token);
    console.log(`Courses synced: ${rows.length} rows`);
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

  objects.forEach((row, idx) => {
    if (!row.Produit) return;
    ingredientMap[row.Produit] = {
      name: row.Produit,
      category: row.Catégorie || 'Autres',
      needed: parseFloat(row.Qty) || 0,
      unit: row.Unité || 'g',
      price: parseFloat(row.Prix) || 0,
      days: row['Date_utilisation'] ? row['Date_utilisation'].split(',').filter(Boolean) : [],
      acheté: row.Acheté === '1' || row.Acheté === 1,
      sheetRow: idx + 2
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
  document.querySelectorAll('#courses-list label').forEach(label => {
    const dateSpans = label.querySelectorAll('span[style*="background"]');
    if (dateSpans.length === 0) return;

    let allPast = true;
    dateSpans.forEach(span => {
      const text = span.textContent.trim();
      const dayNum = parseInt(text.split(/\s+/)[1]);
      if (dayNum >= todayDay) allPast = false;
    });

    if (allPast) {
      label.classList.add('past-day');
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
  const inStock = Object.values(ingredientMap).filter(ing => ing.needed <= 0 && ing.price > 0);

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
      if (token && window.SheetsAPI) {
        try {
          console.log(`Writing Acheté=${checkbox.checked ? '1' : ''} to Courses!G${ing.sheetRow}`);
          await window.SheetsAPI.updateSheetCell(`Courses!G${ing.sheetRow}`, checkbox.checked ? '1' : '', token);
          console.log(`✓ Updated Acheté`);
        } catch (e) { console.error('❌ Failed to update Acheté:', e); }
      }
      updateProgress();
    });
  });

  updateProgress();
  renderCustomItems();
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
  const qtyDisplay = ing.needed <= 0
    ? ''
    : ` <small style="color:#999;font-size:0.85em;">(${ing.needed.toFixed(0)}${ing.unit})</small>`;

  const priceText = ing.price > 0 ? `${ing.price.toFixed(2)}€` : '-€';

  let dayBadges = '';
  ing.days.forEach(dateISO => {
    const d = new Date(dateISO);
    const dayNum = d.getDate();
    const dayAbbr = dayNames[d.getDay()];
    let badgeColor = '#e8f5e9';

    if (dayAbbr === todayAbbr && dayNum === todayDay) {
      badgeColor = '#ffcdd2';
    } else if (dayNum < todayDay) {
      badgeColor = '#e0e0e0';
    } else {
      const tomorrow = todayDay + 1;
      const dayAfter = todayDay + 2;
      if ((dayAbbr === dayNames[(today.getDay() + 1) % 7] && dayNum === tomorrow) ||
          (dayAbbr === dayNames[(today.getDay() + 2) % 7] && dayNum === dayAfter)) {
        badgeColor = '#fff9c4';
      }
    }

    dayBadges += `<span style="background:${badgeColor};padding:1px 4px;margin-right:2px;border-radius:2px;">${dayAbbr} ${dayNum}</span>`;
  });

  return `
    <label${dimmClass} style="position:relative;">
      <input type="checkbox" data-key="${ing.name.replace(/'/g, "\\'")}" />
      <span style="flex:1;">
        ${ing.name}${qtyDisplay}
        <div style="color:#2E7D32;font-size:0.75em;margin-top:2px;">${dayBadges}</div>
      </span>
      <div class="price-correction">
        <span class="price-display">${priceText}</span>
        <button class="price-edit-btn" onclick="openEditModal('${ing.name.replace(/'/g, "\\'")}')">Corriger</button>
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

// Custom items
const customKey = `COURSES_${Utils.getDateISO(0)}_customs`;

function loadCustomItems() {
  try {
    return JSON.parse(localStorage.getItem(customKey) || '[]');
  } catch (e) {
    return [];
  }
}

function saveCustomItems(items) {
  localStorage.setItem(customKey, JSON.stringify(items));
}

function renderCustomItems() {
  const items = loadCustomItems();
  const section = document.getElementById('custom-section');

  if (items.length === 0) {
    section.innerHTML = '';
    return;
  }

  let html = '<div class="cat custom-cat">Ajouts perso</div>';
  items.forEach((item, i) => {
    const doneClass = item.checked ? ' done' : '';
    const qty = item.qty ? ` <small style="color:#999;font-size:0.85em;">(${item.qty})</small>` : '';
    html += `
      <label class="custom-item${doneClass}">
        <input type="checkbox" ${item.checked ? 'checked' : ''} onchange="toggleCustom(${i}, this)" />
        <span>${item.name}${qty}</span>
        <button class="del-btn" onclick="deleteCustom(event, ${i})">×</button>
      </label>
    `;
  });

  section.innerHTML = html;
  updateProgress();
}

function toggleCustom(i, cb) {
  const items = loadCustomItems();
  items[i].checked = cb.checked;
  saveCustomItems(items);
  cb.parentElement.classList.toggle('done', cb.checked);
  updateProgress();
}

function deleteCustom(e, i) {
  e.preventDefault();
  e.stopPropagation();
  const items = loadCustomItems();
  items.splice(i, 1);
  saveCustomItems(items);
  renderCustomItems();
}

function showAddModal() {
  document.getElementById('modal-overlay').classList.add('active');
  setTimeout(() => document.getElementById('item-name').focus(), 50);
}

function hideAddModal() {
  document.getElementById('modal-overlay').classList.remove('active');
  document.getElementById('item-name').value = '';
  document.getElementById('item-qty').value = '';
}

function hideModal(e) {
  if (e.target === document.getElementById('modal-overlay')) hideAddModal();
}

function saveCustomItem() {
  const name = document.getElementById('item-name').value.trim();
  if (!name) {
    document.getElementById('item-name').focus();
    return;
  }
  const qty = document.getElementById('item-qty').value.trim();
  const items = loadCustomItems();
  items.unshift({ name, qty, checked: false });
  saveCustomItems(items);
  hideAddModal();
  renderCustomItems();
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
      console.log(`Ingredient updated: ${ingredientName}`);
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

  document.getElementById('loading-state').textContent = 'Chargement...';

  try {
    // Read Courses sheet
    const rows = await SheetsAPI.readSheetTab('Courses');
    const objects = SheetsAPI.rowsToObjects(rows);

    // Auto-refresh si sheet vide ou date périmée
    const firstDate = objects[0]?.['Date_utilisation']?.split(',')[0];
    const today = Utils.getDateISO(0);
    const isStale = !firstDate || !objects[0]?.Produit || !objects.some(r => r['Date_utilisation']?.includes(today));

    if (isStale) {
      const token = window.getAccessToken ? window.getAccessToken() : null;
      if (token) {
        await loadRecipes();
        const existingAcheté = {};
        objects.forEach(r => {
          if (r.Produit && r.Acheté === '1') {
            const k = r.Produit.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();
            existingAcheté[k] = '1';
          }
        });
        await generateAndWriteCourses(token, existingAcheté);
        const updated = await SheetsAPI.readSheetTab('Courses');
        populateIngredientMap(SheetsAPI.rowsToObjects(updated));
      } else {
        populateIngredientMap(objects);
      }
    } else {
      populateIngredientMap(objects);
    }

    renderCoursesList();
  } catch (error) {
    console.error('Error loading courses:', error);
    document.getElementById('loading-state').textContent = 'Erreur au chargement. Vérifiez votre connexion.';
  }
}

document.addEventListener('DOMContentLoaded', initCourses);
