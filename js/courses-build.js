/**
 * Shared shopping-list builder, used by BOTH the planning page (regenerates on
 * every meal add/remove) and the courses page (regenerates on open). Single
 * source of truth so the list is recomputed identically wherever the planning
 * changes — no reliance on one page's debounced write reaching the other.
 *
 * Requires (already loaded before this file): Utils, SheetsAPI, window.recipesData.
 */

let _coursesSyncInProgress = false;
let _coursesPendingToken = null;

/** today .. today+6 (local ISO), the rolling window the courses page displays. */
function _coursesWeekWindow() {
  const out = [];
  for (let i = 0; i < 7; i++) out.push(Utils.getDateISO(i));
  return out;
}

/** Normalize a Planning cell into an array of recipe/inventory entries. */
function _parseRecipeEntries(recipeValue) {
  if (!recipeValue) return [];
  if (Array.isArray(recipeValue)) return recipeValue;
  try {
    const parsed = JSON.parse(recipeValue);
    if (Array.isArray(parsed)) return parsed.map(i => (typeof i === 'string' ? { name: i, portions: 1 } : i));
  } catch (e) { /* not JSON — treat as a plain recipe name below */ }
  return [{ name: recipeValue, portions: 1 }];
}

/**
 * Build Courses rows (cols A-I) from Planning sheet objects + inventory.
 * Aggregates over the today..+6 window. A recipe is cooked whole and yields
 * `portions_total` servings, so shop for ceil(wanted / yield) whole recipes.
 * @param {Object[]} planObjects - rowsToObjects(Planning)
 * @param {Object[]} inventoryObjects - rowsToObjects(Inventory)
 * @returns {Array[]} rows [Produit, Catégorie, Qty, Unité, Prix, Date_utilisation, Acheté, Ajout, Prix_unité]
 */
function buildCoursesRows(planObjects, inventoryObjects) {
  const map = {};
  const byDate = {};
  (planObjects || []).forEach(p => { if (p.Date) byDate[p.Date] = p; });

  _coursesWeekWindow().forEach(dateISO => {
    const day = byDate[dateISO];
    if (!day) return;
    ['Midi', 'Soir'].forEach(slot => {
      const recipeValue = day[slot];
      if (!recipeValue) return;
      _parseRecipeEntries(recipeValue).forEach(entry => {
        // Inventory items: add the product directly; stock deduction (buy only the
        // shortfall) happens later in the Courses view.
        if (entry.type === 'inventory') {
          const key = Utils.normalizeString(entry.name);
          if (!map[key]) map[key] = { name: entry.name, qty: 0, unit: entry.unit || 'g', days: [] };
          map[key].qty += parseFloat(entry.qty) || 0;
          if (!map[key].days.includes(dateISO)) map[key].days.push(dateISO);
          return;
        }
        const recipeName = entry.name || entry;
        const portions = entry.portions || 1;
        const recipeKey = Utils.normalizeString(recipeName);
        const recipe = Object.values(window.recipesData || {})
          .find(r => Utils.normalizeString(r.name) === recipeKey);
        if (!recipe?.ingredients) return;
        const recipeCount = Math.ceil(portions / (recipe.portions_total || 1));
        recipe.ingredients.forEach(ing => {
          const key = Utils.normalizeString(ing.name);
          if (!map[key]) map[key] = { name: ing.name, qty: 0, unit: ing.unit || 'g', days: [] };
          map[key].qty += (parseFloat(ing.quantity) || 0) * recipeCount;
          if (!map[key].days.includes(dateISO)) map[key].days.push(dateISO);
        });
      });
    });
  });

  // Enrich from inventory (category / price). Plural/whitespace-tolerant match.
  Object.values(map).forEach(ing => {
    const match = (inventoryObjects || []).find(item => Utils.foodMatch(item.Produit, ing.name));
    if (match) {
      ing.category = match.Catégorie || 'Autres';
      ing.price = parseFloat(match.Prix) || 0;
      ing.priceUnit = match['Prix_unité'] || Utils.defaultPriceUnit(ing.unit);
    } else {
      ing.category = 'Autres';
      ing.price = 0;
      ing.priceUnit = Utils.defaultPriceUnit(ing.unit);
    }
  });

  return Object.values(map)
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    .map(ing => [ing.name, ing.category, ing.qty.toFixed(1), ing.unit, ing.price.toFixed(2), ing.days.join(','), '', '', ing.priceUnit || '']);
}

/**
 * Core worker: recompute the planning-driven part of the Courses sheet from the
 * live Planning + Inventory. Deletes only rows tagged "planning" (col H) so custom
 * rows survive, preserves the Acheté state of items still present, then re-appends.
 * Not concurrency-guarded — call it through requestCoursesRegen().
 * @param {string} token
 * @param {Object<string,string>} existingAcheté - normalized product name → Acheté value to keep
 */
async function _writeCoursesSheet(token, existingAcheté = {}) {
  if (!window.SheetsAPI || !token) return;
  // Guard: without recipes loaded we'd build an empty list and wipe the planning
  // rows. Skip the rewrite and keep whatever is already on the sheet.
  if (!window.recipesData || Object.keys(window.recipesData).length === 0) return;
  try {
    // Ensure col H header "Ajout" exists, else rowsToObjects won't map it and
    // custom rows (Ajout=custom) would be treated as planning rows and deleted.
    await window.SheetsAPI.batchUpdateRange('Courses!A1:I1',
      [['Produit', 'Catégorie', 'Qty', 'Unité', 'Prix', 'Date_utilisation', 'Acheté', 'Ajout', 'Prix_unité']], token);

    const planRows = await window.SheetsAPI.readSheetTab('Planning');
    const planObjects = window.SheetsAPI.rowsToObjects(planRows);
    const invRows = await window.SheetsAPI.readSheetTab('Inventory');
    const inventory = window.SheetsAPI.rowsToObjects(invRows);

    const rows = buildCoursesRows(planObjects, inventory).map(r => {
      const c = [...r];
      c[6] = existingAcheté[Utils.normalizeString(c[0])] || '';
      c[7] = 'planning';
      return c;
    });

    // Delete only planning-tagged rows (raw col index 7 = col H). Never relies on
    // header name so custom rows are always safe.
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
    console.warn('Courses regen failed:', err);
  }
}

/**
 * Request a Courses rebuild after a planning change. Coalesces rapid calls: while
 * a rebuild runs, further requests only mark the latest token, and the loop runs
 * once more for it — so back-to-back meal edits never lose the final state, and
 * two edits can't overlap into a corrupted sheet.
 * @param {string} token
 */
async function requestCoursesRegen(token) {
  _coursesPendingToken = token || _coursesPendingToken;
  if (_coursesSyncInProgress) return; // a run is active; it will pick up the pending token
  _coursesSyncInProgress = true;
  try {
    while (_coursesPendingToken) {
      const t = _coursesPendingToken;
      _coursesPendingToken = null;
      const existingAcheté = await captureExistingAcheté();
      await _writeCoursesSheet(t, existingAcheté);
    }
  } finally {
    _coursesSyncInProgress = false;
  }
}

/**
 * Read the current Courses sheet and capture the Acheté state of every product
 * (any non-empty value — checked items store a date, not "1") so a regeneration
 * doesn't wipe what the user already ticked.
 * @returns {Promise<Object<string,string>>}
 */
async function captureExistingAcheté() {
  const out = {};
  try {
    const rows = await window.SheetsAPI.readSheetTab('Courses');
    window.SheetsAPI.rowsToObjects(rows).forEach(row => {
      if (row.Produit && row.Acheté && row.Acheté !== '') {
        out[Utils.normalizeString(row.Produit)] = row.Acheté;
      }
    });
  } catch (e) { /* sheet may not exist yet */ }
  return out;
}

if (typeof window !== 'undefined') {
  window.buildCoursesRows = buildCoursesRows;
  window.requestCoursesRegen = requestCoursesRegen;
  window.captureExistingAcheté = captureExistingAcheté;
}
