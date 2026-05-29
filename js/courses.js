// Courses list module — dynamically generate shopping list from planning + recipes + inventory

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
 * Normalize string for matching: lowercase, remove accents, trim
 */
function normalize(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

/**
 * Build ingredient map from planning + recipes
 * Returns { normalized_name: { name, needed, unit, days, category, inStock, fullyStocked } }
 */
function buildIngredientMap(window7, planningObjects) {
  const map = {};

  window7.forEach(day => {
    const planRow = planningObjects.find(r => r.Date === day.dateISO);
    if (!planRow) return;

    [planRow.Midi, planRow.Soir].forEach(recipeName => {
      if (!recipeName) return;

      const recipe = Object.values(window.recipesData || {}).find(r => r.name === recipeName);
      if (!recipe || !recipe.ingredients) return;

      recipe.ingredients.forEach(ing => {
        const key = normalize(ing.name);
        if (!map[key]) {
          map[key] = {
            name: ing.name,
            needed: 0,
            unit: ing.unit || 'g',
            days: [],
            category: null,
            price: 0,
            inStock: 0,
            fullyStocked: false
          };
        }
        map[key].needed += parseFloat(ing.quantity) || 0;
        if (!map[key].days.includes(day.dateISO)) {
          map[key].days.push(day.dateISO);
        }
      });
    });
  });

  return map;
}

/**
 * Apply inventory deductions: reduce needed quantities by what's in stock
 * Also populate category from inventory
 */
function applyInventoryDeductions(ingredientMap, inventoryObjects) {
  inventoryObjects.forEach(invItem => {
    const invQty = parseFloat(invItem.Qty) || 0;
    const invKey = normalize(invItem.Produit);
    const invUnit = invItem.Unité || 'g';
    const invCategory = invItem.Catégorie || 'Autres';

    // Try exact match first
    let matched = ingredientMap[invKey];

    // If no exact match, try partial matches
    if (!matched) {
      const possibleKeys = Object.keys(ingredientMap).filter(k => {
        const ing = ingredientMap[k];
        return invKey.includes(k) || k.includes(invKey);
      });
      if (possibleKeys.length > 0) {
        matched = ingredientMap[possibleKeys[0]];
      }
    }

    if (matched) {
      // Always set category and price from inventory if found
      if (!matched.category) {
        matched.category = invCategory;
      }
      if (matched.price === 0) {
        matched.price = parseFloat(invItem.Prix) || 0;
      }

      // Only deduct if units match
      if (invQty > 0) {
        const unitMatch =
          matched.unit === invUnit ||
          (matched.unit === 'piece' && invUnit === 'pièce') ||
          (matched.unit === 'pièce' && invUnit === 'piece');

        if (unitMatch) {
          matched.inStock = invQty;
          matched.needed = Math.max(0, matched.needed - invQty);
          matched.fullyStocked = matched.needed <= 0;
        }
      }
    }
  });
}

/**
 * Render the courses list into DOM, grouped by category
 */
function renderCoursesList() {
  const container = document.getElementById('courses-list');
  const customSection = document.getElementById('custom-section');

  // Separate into "to buy" and "in stock"
  const toBuy = Object.values(ingredientMap).filter(ing => ing.needed > 0);
  const inStock = Object.values(ingredientMap).filter(ing => ing.fullyStocked);

  // Calculate total price for "to buy" items
  const totalPrice = toBuy.reduce((sum, ing) => {
    const price = loadPriceOverride(ing.name) || ing.price || 0;
    return sum + (parseFloat(price) || 0);
  }, 0);

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

  // Sort items within each group by name
  function sortGroup(group) {
    return group.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }

  let html = '';

  // Show total price if there are items to buy
  if (toBuy.length > 0) {
    html += `<div style="text-align:center;font-size:17px;font-weight:bold;color:#2E7D32;margin:0 0 8px;">Budget estimé : ~${totalPrice.toFixed(2)}€</div>`;
  }

  // "À acheter" section by category
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

  // "En stock" section by category
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
  document.querySelectorAll('#courses-list input[type="checkbox"]').forEach((checkbox, i) => {
    const ingredientName = checkbox.dataset.ingredient;
    const today = Utils.getDateISO(0);
    const stateKey = `COURSES_${today}_${ingredientName}`;

    checkbox.checked = localStorage.getItem(stateKey) === '1';
    checkbox.parentElement.classList.toggle('done', checkbox.checked);

    checkbox.addEventListener('change', () => {
      localStorage.setItem(stateKey, checkbox.checked ? '1' : '0');
      checkbox.parentElement.classList.toggle('done', checkbox.checked);
      updateProgress();
    });
  });

  updateProgress();
  renderCustomItems();
}

/**
 * Render a single ingredient item with badges and price
 */
function renderIngredientItem(ing, dimmed = false) {
  const today = new Date();
  const todayDay = today.getDate();
  const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const todayAbbr = dayNames[today.getDay()];

  const dimmClass = dimmed ? ' dimmed' : '';
  const qtyDisplay = ing.inStock > 0 && ing.fullyStocked
    ? ''
    : ` <small style="color:#999;font-size:0.85em;">(${ing.needed.toFixed(0)}${ing.unit})</small>`;

  const priceOverride = loadPriceOverride(ing.name);
  const displayPrice = priceOverride || ing.price || 0;
  const priceDisplay = displayPrice > 0 ? ` <small style="color:#aaa;font-size:0.8em;">~${displayPrice.toFixed(2)}€</small>` : '';

  let dayBadges = '';
  ing.days.forEach(dateISO => {
    const d = new Date(dateISO);
    const dayNum = d.getDate();
    const dayAbbr = dayNames[d.getDay()];
    let badgeColor = '#e8f5e9'; // green

    if (dayAbbr === todayAbbr && dayNum === todayDay) {
      badgeColor = '#ffcdd2'; // red
    } else if (dayNum < todayDay) {
      badgeColor = '#e0e0e0'; // gray (past)
    } else {
      const tomorrow = todayDay + 1;
      const dayAfter = todayDay + 2;
      if ((dayAbbr === dayNames[(today.getDay() + 1) % 7] && dayNum === tomorrow) ||
          (dayAbbr === dayNames[(today.getDay() + 2) % 7] && dayNum === dayAfter)) {
        badgeColor = '#fff9c4'; // yellow
      }
    }

    dayBadges += `<span style="background:${badgeColor};padding:1px 4px;margin-right:2px;border-radius:2px;">${dayAbbr} ${dayNum}</span>`;
  });

  return `
    <label${dimmClass} style="position:relative;">
      <input type="checkbox" data-ingredient="${ing.name}" />
      <span style="flex:1;">
        ${ing.name}${qtyDisplay}${priceDisplay}
        <div style="color:#2E7D32;font-size:0.75em;margin-top:2px;">${dayBadges}</div>
      </span>
      <button class="price-edit-btn" onclick="showPriceModal('${ing.name.replace(/'/g, "\\'")}', ${displayPrice})" style="background:none;border:none;color:#999;font-size:12px;cursor:pointer;padding:4px 8px;margin-left:4px;">corriger</button>
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

/**
 * Custom items (manual additions)
 */
const today = Utils.getDateISO(0);
const customKey = `COURSES_${today}_customs`;

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

/**
 * Load price override from localStorage
 */
function loadPriceOverride(ingredientName) {
  const key = `COURSES_PRICE_${ingredientName}`;
  const val = localStorage.getItem(key);
  return val ? parseFloat(val) : null;
}

/**
 * Save price override to localStorage
 */
function savePriceOverride(ingredientName, price) {
  const key = `COURSES_PRICE_${ingredientName}`;
  if (price && parseFloat(price) > 0) {
    localStorage.setItem(key, price);
  } else {
    localStorage.removeItem(key);
  }
}

/**
 * Show modal to edit price for an ingredient
 */
function showPriceModal(ingredientName, currentPrice) {
  const input = document.getElementById('price-edit-input');
  input.value = currentPrice || '';
  input.dataset.ingredient = ingredientName;
  document.getElementById('price-modal-overlay').classList.add('active');
  setTimeout(() => input.focus(), 50);
}

function hidePriceModal() {
  document.getElementById('price-modal-overlay').classList.remove('active');
}

function savePriceAndUpdate() {
  const input = document.getElementById('price-edit-input');
  const ingredientName = input.dataset.ingredient;
  const price = input.value.trim();

  savePriceOverride(ingredientName, price);

  // Update the display
  const ing = Object.values(ingredientMap).find(i => i.name === ingredientName);
  if (ing) {
    renderCoursesList();
  }
  hidePriceModal();
}

/**
 * Initialize courses page
 */
async function initCourses() {
  UserContext.applyUserStyling();
  UserContext.initializeUserToggle();

  try {
    document.getElementById('loading-state').textContent = 'Chargement...';

    // Load recipes first
    await loadRecipes();

    // Calculate week window
    rollingWindow = calculateWeekWindow();
    const first = rollingWindow[0];
    const last = rollingWindow[6];
    document.getElementById('week-range-label').textContent = `${first.dateStr} – ${last.dateStr}`;

    // Load planning
    const planningRows = await SheetsAPI.readSheetTab('Planning');
    const planningObjects = SheetsAPI.rowsToObjects(planningRows);

    // Load inventory
    const inventoryRows = await SheetsAPI.readSheetTab('Inventory');
    const inventoryObjects = SheetsAPI.rowsToObjects(inventoryRows);

    // Build and process ingredient map
    ingredientMap = buildIngredientMap(rollingWindow, planningObjects);
    applyInventoryDeductions(ingredientMap, inventoryObjects);

    // Render
    document.getElementById('loading-state').textContent = '';
    renderCoursesList();

  } catch (error) {
    console.error('Error loading courses:', error);
    document.getElementById('loading-state').textContent = 'Erreur au chargement. Vérifiez votre connexion.';
  }
}

document.addEventListener('DOMContentLoaded', initCourses);
