/**
 * @fileoverview Leftovers ("Restes") tracking — household-shared.
 *
 * A recipe is cooked whole and yields `portions_total` servings. When a planned
 * meal (repas du jour) with yield > 1 is first eaten, a batch of whole recipe(s)
 * is created and decremented as portions are eaten — by ANY profile, since the
 * food is physically shared. Leftovers live in a single "Restes" sheet:
 *
 *   A: Recette | B: Date_creation | C: Portions_restantes | D: Portion_g | E: Kcal_per_100
 *
 * The remaining portions show up on the home page from the day AFTER creation,
 * until the batch hits zero (its row is then deleted).
 */

const RESTES_TAB = "Restes";
const RESTES_HEADER = ["Recette", "Date_creation", "Portions_restantes", "Portion_g", "Kcal_per_100"];

let restesCache = null;
let _restesCacheDate = null; // ISO day the cache was built; invalidated when the day rolls over
// Set while the Manger modal is being used to eat from a leftover batch.
let currentResteContext = null;

/**
 * Ensure the household Restes sheet exists (create with header if missing).
 * @param {string} token
 */
async function ensureRestesSheet(token) {
  try {
    await SheetsAPI.readSheetTab(RESTES_TAB);
  } catch {
    await SheetsAPI.createSheetTab(RESTES_TAB, RESTES_HEADER, token);
  }
}

/**
 * Load active leftover batches.
 * @returns {Promise<Array<{recette,dateCreation,portionsRestantes,portionG,kcalPer100,rowNumber}>>}
 */
async function loadRestes() {
  const today = Utils.getDateISO(0);
  // Leftovers are shown from the day AFTER creation, so a cache built yesterday is
  // stale once the day rolls over — drop it at midnight.
  if (restesCache && _restesCacheDate === today) return restesCache;
  try {
    const rows = await SheetsAPI.readSheetTab(RESTES_TAB);
    const out = [];
    (rows || []).forEach((r, idx) => {
      if (idx === 0) return; // header
      const recette = r[0];
      const remaining = parseFloat(r[2]);
      if (!recette || isNaN(remaining) || remaining <= 0) return;
      out.push({
        recette,
        dateCreation: r[1] || "",
        portionsRestantes: remaining,
        portionG: parseFloat(r[3]) || 0,
        kcalPer100: parseFloat(r[4]) || 0,
        rowNumber: idx + 1, // 1-based sheet row
      });
    });
    restesCache = out;
    _restesCacheDate = today;
    return out;
  } catch (err) {
    console.error("Failed to load restes:", err);
    return [];
  }
}

/**
 * Create or decrement a leftover batch when a PLANNED recipe is eaten.
 * No-op for recipes with yield <= 1.
 * @param {string} recipeName
 * @param {number} portionsEaten
 * @param {string} token
 */
async function consumePlannedRecipePortions(recipeName, portionsEaten, token) {
  if (!token || !recipeName || !(portionsEaten > 0)) return;

  await ensureRestesSheet(token);
  const rows = await SheetsAPI.readSheetTab(RESTES_TAB);

  // Existing active batch for this recipe?
  let rowNumber = 0;
  let remaining = 0;
  (rows || []).forEach((r, idx) => {
    if (idx === 0) return;
    if (r[0] === recipeName && (parseFloat(r[2]) || 0) > 0) {
      rowNumber = idx + 1;
      remaining = parseFloat(r[2]) || 0;
    }
  });

  if (rowNumber > 0) {
    const left = remaining - portionsEaten;
    if (left > 0) {
      await SheetsAPI.batchUpdateRange(`${RESTES_TAB}!C${rowNumber}`, [[left]], token);
    } else {
      await SheetsAPI.deleteSheetRow(RESTES_TAB, rowNumber, token);
    }
    restesCache = null;
    return;
  }

  // No batch yet — first bite. Create one sized to whole recipe(s).
  const recipe = Object.values(window.recipesData || {}).find(r => r.name === recipeName);
  const yieldPortions = (recipe && recipe.portions_total) || 1;
  if (yieldPortions <= 1) return; // single-serving recipe → no leftovers

  const meal = (window.todaysMeals || []).find(m => m.name === recipeName);
  const planned = (meal && meal.portions) || 1;
  const batch = Math.ceil(planned / yieldPortions) * yieldPortions;
  const left = batch - portionsEaten;
  if (left <= 0) return; // everything eaten, nothing left

  const today = getTodayISO();
  const row = [recipeName, today, left, (recipe && recipe.portion_g) || "", (recipe && recipe.kcal_per_100) || ""];
  await SheetsAPI.appendRowWithToken(RESTES_TAB, row, token);
  restesCache = null;
}

/**
 * Decrement a specific leftover batch (eating from the "Reste" row).
 * @param {number} rowNumber - 1-based sheet row
 * @param {number} portionsEaten
 * @param {string} token
 */
async function decrementResteBatch(rowNumber, portionsEaten, token) {
  if (!token || !rowNumber || !(portionsEaten > 0)) return;
  const rows = await SheetsAPI.readSheetTab(RESTES_TAB);
  const r = (rows || [])[rowNumber - 1];
  if (!r) return;
  const left = (parseFloat(r[2]) || 0) - portionsEaten;
  if (left > 0) {
    await SheetsAPI.batchUpdateRange(`${RESTES_TAB}!C${rowNumber}`, [[left]], token);
  } else {
    await SheetsAPI.deleteSheetRow(RESTES_TAB, rowNumber, token);
  }
  restesCache = null;
}

/**
 * Render leftover rows on the home page (only batches created before today).
 */
async function renderRestes() {
  const section = document.getElementById("restes-section");
  const container = document.getElementById("restes-container");
  if (!container) return;

  const restes = await loadRestes();
  const today = getTodayISO();
  const visible = restes.filter(b => b.portionsRestantes > 0 && b.dateCreation && b.dateCreation < today);

  if (visible.length === 0) {
    container.innerHTML = "";
    if (section) section.style.display = "none";
    return;
  }
  if (section) section.style.display = "";

  container.innerHTML = visible.map(b => {
    const n = b.portionsRestantes;
    const plural = n > 1 ? "s" : "";
    return `
      <div class="meal-card" data-reste-recipe="${Utils.escapeHTML(b.recette)}">
        <div class="meal-info">
          <div style="display: flex; align-items: center;">
            <span class="meal-time-icon">♻️</span>
            <div>
              <p class="meal-name">${Utils.escapeHTML(b.recette)} <span style="color:#999;font-size:0.85em;font-weight:normal;">(reste : ${n} portion${plural})</span></p>
            </div>
          </div>
        </div>
        <div class="meal-actions">
          <button class="btn-meal btn-mange btn-reste-manger"
            data-recipe="${Utils.escapeHTML(b.recette)}"
            data-row="${b.rowNumber}"
            data-portion-g="${b.portionG}"
            data-kcal100="${b.kcalPer100}"
            data-remaining="${n}">
            Manger
          </button>
        </div>
      </div>`;
  }).join("");
}
