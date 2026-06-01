/**
 * MealFlow — Accueil (Landing Page) Logic
 * Renders greeting, progress circle, today's objectives, and search.
 * Reads Profils + Planning tabs from Google Sheets.
 */

/* ============================================================================
   STATE
   ============================================================================ */

let todaysMeals = [];
let dailyGoal = 0;
let todaysConsumptions = [];
let currentUser = null;

/**
 * Grignottage scanner state
 */
let grignottageScanner = null;
let grignottageCurrentBarcode = null;
let lastDateChecked = null;  // ISO date string to detect midnight rollover
let caloriesConsumed = 0;    // For progress circle calculation (from todaysConsumptions)

/* ============================================================================
   DATE HELPERS (inline until utils.js is available in Task 5)
   ============================================================================ */

/**
 * Returns today's date as an ISO string (YYYY-MM-DD)
 * @returns {string}
 */
function getTodayISO() {
  return Utils.getTodayISO();
}

/**
 * Returns a localized French date string, e.g. "Jeudi 22 mai"
 * @returns {string}
 */
function getLocaleDateFr() {
  const today = new Date();
  return today.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/**
 * Meal types with emoji and estimated base calories
 */
const MEAL_TIMES = [
  { type: "petit_dejeuner", label: "Petit-déj", emoji: "🌅", estimatedKcal: 400 },
  { type: "collation_matin", label: "Collation matin", emoji: "🥤", estimatedKcal: 150 },
  { type: "dejeuner", label: "Déjeuner", emoji: "🍽️", estimatedKcal: 700 },
  { type: "collation_apres_midi", label: "Collation après-midi", emoji: "🥪", estimatedKcal: 150 },
  { type: "diner", label: "Dîner", emoji: "🌙", estimatedKcal: 600 },
];

/* ============================================================================
   RENDERING
   ============================================================================ */

/**
 * Renders the greeting section: "Bonjour [Name]", date, calorie objective.
 */
function renderGreeting() {
  const user = getCurrentUser();
  const displayName = user.charAt(0).toUpperCase() + user.slice(1);

  const greetingEl = document.getElementById("greeting");
  const dateTodayEl = document.getElementById("date-today");
  const calorieObjectiveEl = document.getElementById("calorie-objective");

  if (greetingEl) {
    greetingEl.textContent = `Bonjour ${displayName} 👋`;
  }

  if (dateTodayEl) {
    dateTodayEl.textContent = Utils.formatDate(getTodayISO()) || getLocaleDateFr();
  }

  if (calorieObjectiveEl) {
    if (dailyGoal > 0) {
      calorieObjectiveEl.textContent = `Objectif: ${dailyGoal.toLocaleString("fr-FR")} kcal`;
    } else {
      calorieObjectiveEl.textContent = "Objectif: — kcal";
    }
  }
}

/**
 * Calculates the SVG stroke-dashoffset for a given percentage.
 * Circle circumference (r=54): 2 * π * 54 ≈ 339.3
 * @param {number} percentage - 0 to 100+
 * @returns {number} stroke-dashoffset value
 */
function percentToOffset(percentage) {
  const circumference = 2 * Math.PI * 54; // ≈ 339.3
  const clamped = Math.min(Math.max(percentage, 0), 100);
  return circumference * (1 - clamped / 100);
}

/**
 * Animates the SVG progress circle to show the given percentage.
 * @param {number} percentage - 0 to 100+
 */
function renderProgressCircle(percentage) {
  const circlePath = document.getElementById("circle-path");
  const progressPercent = document.getElementById("progress-percent");
  const circleCaption = document.getElementById("circle-caption");

  if (!circlePath || !progressPercent) return;

  const displayPct = Math.round(percentage);
  const offset = percentToOffset(percentage);

  // Animate offset
  circlePath.style.strokeDashoffset = offset;

  // Warn color if over target
  if (percentage > 100) {
    circlePath.classList.add("over-target");
  } else {
    circlePath.classList.remove("over-target");
  }

  // Update text
  progressPercent.textContent = `${displayPct}%`;

  // Update caption
  if (circleCaption) {
    if (dailyGoal > 0) {
      circleCaption.textContent = `${caloriesConsumed.toLocaleString("fr-FR")} / ${dailyGoal.toLocaleString("fr-FR")} kcal`;
    } else {
      circleCaption.textContent = `${caloriesConsumed.toLocaleString("fr-FR")} kcal consommées`;
    }
  }
}

/**
 * Renders the meals section with today's 2 meals (Midi and Soir) and action buttons.
 */
function renderMeals() {
  const container = document.getElementById("meals-container");
  if (!container) return;

  // Clear previous content
  container.innerHTML = "";

  if (todaysMeals.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: var(--spacing-lg); color: var(--color-text-light);">
        <p>📋 Aucun repas planifié pour aujourd'hui</p>
        <p style="font-size: var(--font-size-small);">Génère une semaine dans la page Planning</p>
      </div>`;
    return;
  }

  // Filter: only show meals with names
  const mealsWithNames = todaysMeals.filter(m => m.name && m.name.trim());

  if (mealsWithNames.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: var(--spacing-lg); color: var(--color-text-light);">
        <p>📋 Aucun repas planifié pour aujourd'hui</p>
      </div>`;
    return;
  }

  const mealsHtml = mealsWithNames
    .map(meal => {
      const displayKcal = meal.actualKcal || meal.estimatedKcal;
      const eatenClass = meal.eaten ? "eaten" : "";

      // For snacks (grignottage), display quantity with unit
      let displayName = meal.name;
      if (meal.mealType === "grignottage" && meal.quantity !== undefined && meal.unit) {
        // Calculate quantity for display based on unit type
        // If unit is ml/litre, show as ml; if g/pièce, show as-is
        let displayQty = meal.quantity;
        let displayUnit = meal.unit;

        // Normalize litre to ml for display
        if (meal.unit === "litre") {
          displayQty = meal.quantity * 1000;
          displayUnit = "ml";
        }

        displayName = `${meal.name} (${Math.round(displayQty)} ${displayUnit})`;
      }

      return `
        <div class="meal-card ${eatenClass}" data-meal-type="${meal.mealType}">
          <div class="meal-info">
            <div style="display: flex; align-items: center;">
              <span class="meal-time-icon">${meal.emoji}</span>
              <div>
                <p class="meal-name">${displayName}</p>
                <p class="meal-kcal">${meal.kcal_per_100 ? meal.kcal_per_100 + ' kcal/100g' : ''}${(meal.portions||1) > 1 ? ` · ${meal.portions} portions` : ''}${(() => { const r = window.recipesData && Object.values(window.recipesData).find(r => r.name === meal.name); const p = meal.portions||1; return r && r.portion_g ? ` · 🍽️ ${r.portion_g*p}g = ${Math.round(r.portion_g*p*(meal.kcal_per_100||0)/100)} kcal` : ''; })()}</p>
              </div>
            </div>
          </div>
          <div class="meal-actions">
            <button class="btn-meal btn-mange" data-meal-name="${meal.name}">
              Manger
            </button>
            <button class="btn-meal btn-voir" data-meal-name="${meal.name}">
              👁️ Voir
            </button>
          </div>
        </div>
      `;
    })
    .join("");

  container.innerHTML = mealsHtml;
}

/**
 * Toggles "eaten" state for a meal and updates localStorage.
 */
function toggleMealEaten(mealType) {
  const meal = todaysMeals.find(m => m.mealType === mealType);
  if (!meal) return;

  meal.eaten = !meal.eaten;

  // Calorie wheel tracks ONLY History consumption (real meals logged), not Planning
  // Planning is just a plan, not actual consumption
  caloriesConsumed = todaysConsumptions.reduce((sum, c) => sum + (c.Kcal_total || 0), 0);

  // Persist to localStorage
  saveMealsState();

  // Update UI
  renderMeals();
  updateProgressDisplay();
  renderWheel();
}

/**
 * Shows recipe (placeholder — can link to Sheets or open modal).
 */
function showRecipe(mealType) {
  const meal = todaysMeals.find(m => m.mealType === mealType);
  if (!meal) return;

  console.log(`Recipe requested for: ${meal.name}`);
}

/**
 * Updates the progress circle + caption after calories change.
 */
function updateProgressDisplay() {
  const pct = dailyGoal > 0 ? (caloriesConsumed / dailyGoal) * 100 : 0;
  console.log(`updateProgressDisplay: target=${dailyGoal}, consumed=${caloriesConsumed}, pct=${pct}%`);
  renderProgressCircle(pct);
}

/**
 * Renders the calorie wheel: shows consumption percentage, remaining calories,
 * and color-codes the wheel border (green/orange/red).
 */
function renderWheel() {
  // Filter zero-kcal entries
  const validConsumptions = todaysConsumptions.filter(c => (c.Kcal_total || 0) > 0);
  const consumed = validConsumptions.reduce((sum, c) => sum + (c.Kcal_total || 0), 0);

  // Add meals that were eaten
  const mealsConsumed = todaysMeals
    .filter(m => m.eaten)
    .reduce((sum, m) => sum + (m.actualKcal || m.estimatedKcal), 0);
  const total = consumed + mealsConsumed;
  const percentage = dailyGoal > 0 ? Math.round((total / dailyGoal) * 100) : 0;
  const remaining = Math.max(0, dailyGoal - total);

  const percentageEl = document.getElementById("wheel-percentage");
  const remainingEl = document.getElementById("wheel-remaining");

  if (percentageEl) {
    percentageEl.textContent = `${percentage}%`;
  }

  if (remainingEl) {
    remainingEl.textContent = `Remaining : ${remaining}kcal`;
  }

  const wheelContainer = document.querySelector(".accueil-wheel");
  if (wheelContainer) {
    if (percentage >= 100) {
      wheelContainer.style.borderColor = "var(--color-error)";
    } else if (percentage >= 80) {
      wheelContainer.style.borderColor = "var(--color-warning)";
    } else {
      wheelContainer.style.borderColor = "var(--color-success)";
    }
  }

  // Sync SVG ring with the same computed percentage
  renderProgressCircle(percentage);
}

/**
 * Saves meals state (eaten status) to localStorage, separated by user and date.
 * Includes quantity and unit for snacks (grignottage items).
 */
function saveMealsState() {
  try {
    const user = getCurrentUser();
    const today = getTodayISO();
    const stateToSave = todaysMeals.map(m => {
      const saved = {
        mealType: m.mealType,
        eaten: m.eaten,
        actualKcal: m.actualKcal,
      };
      // Include quantity and unit for snacks
      if (m.mealType === "grignottage" && m.quantity !== undefined && m.unit) {
        saved.quantity = m.quantity;
        saved.unit = m.unit;
      }
      return saved;
    });
    localStorage.setItem(`mealflow:meals:${user}:${today}`, JSON.stringify(stateToSave));
    localStorage.setItem(`mealflow:consumed:${user}:${today}`, String(caloriesConsumed));
  } catch (err) {
    console.warn("Could not save meals state to localStorage:", err);
  }
}

/**
 * Loads meals state (eaten status) from localStorage, separated by user and date.
 * Restores quantity and unit for snacks (grignottage items).
 */
function loadMealsState() {
  const user = getCurrentUser();
  const today = getTodayISO();
  const savedState = localStorage.getItem(`mealflow:meals:${user}:${today}`);
  const savedConsumed = localStorage.getItem(`mealflow:consumed:${user}:${today}`);

  if (savedState) {
    try {
      const stateArray = JSON.parse(savedState);
      stateArray.forEach(saved => {
        const meal = todaysMeals.find(m => m.mealType === saved.mealType);
        if (meal) {
          meal.eaten = saved.eaten;
          meal.actualKcal = saved.actualKcal || meal.estimatedKcal;
          // Restore quantity and unit for snacks
          if (meal.mealType === "grignottage" && saved.quantity !== undefined && saved.unit) {
            meal.quantity = saved.quantity;
            meal.unit = saved.unit;
          }
        }
      });
    } catch (err) {
      console.warn("Could not parse saved meals state:", err);
    }
  }

  // caloriesConsumed is computed from Sheets in loadTodaysConsumptions() — don't overwrite with localStorage
}

/* ============================================================================
   DATA LOADING
   ============================================================================ */

/**
 * Gets the current user ID (florian or naomi).
 * @returns {string} Current user
 */
function getCurrentUser() {
  if (currentUser) return currentUser;
  return window.UserContext ? window.UserContext.getCurrentUser() : "florian";
}

/**
 * Loads the daily calorie goal from Profils tab for current user.
 */
async function loadDailyGoal() {
  if (!window.SheetsAPI) {
    console.warn("Accueil: SheetsAPI not available");
    return;
  }

  try {
    const rows = await window.SheetsAPI.readSheetTab("Profils");
    const objects = window.SheetsAPI.rowsToObjects(rows);

    console.log("Accueil: Profils columns available:", objects.length > 0 ? Object.keys(objects[0]) : "no data");

    const user = getCurrentUser();

    // Find profile for current user
    const profile = objects.find(p => {
      const key = (p.User || p.nom || "").toLowerCase().trim();
      return key === user;
    });

    if (profile) {
      console.log(`Accueil: Loaded profile ${user}:`, profile);
      const kcal = Number(profile.Calories_cible || profile.Objectif || profile.objectifKcal || 0);
      dailyGoal = kcal;
      window.dailyGoal = dailyGoal;
      console.log(`Accueil: Daily goal for ${user} = ${dailyGoal} kcal`);
    } else {
      console.warn(`Accueil: No profile found for ${user}`);
      dailyGoal = 0;
      window.dailyGoal = 0;
    }
  } catch (err) {
    console.error("Accueil: Could not load Profils tab:", err.message);
    dailyGoal = 0;
  }
}

/**
 * Loads the Planning tab and builds todaysMeals array for today.
 * Filters to ONLY Midi and Soir columns, ignoring all other meal types.
 */
async function loadTodaysMeals() {
  if (!window.SheetsAPI) return;

  try {
    const rows = await window.SheetsAPI.readSheetTab("Planning");
    const objects = window.SheetsAPI.rowsToObjects(rows);
    const todayISO = getTodayISO();

    // Find today's row by matching date column
    const todayRow = objects.find(row => {
      const rowDate = (row.Date || row.date || "").trim();
      return rowDate === todayISO;
    });

    if (!todayRow) {
      console.warn("Accueil: No Planning row for today");
      todaysMeals = [];
      return;
    }

    // Parse recipe value — returns [{name, portions}] objects
    function parseRecipeValue(value) {
      if (!value) return [];
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed.filter(r => r).map(item =>
            typeof item === 'string' ? { name: item, portions: 1 } : item
          );
        }
      } catch (e) {}
      return value ? [{ name: value, portions: 1 }] : [];
    }

    // Build meals array from ONLY Midi and Soir columns
    const mealTypesToLoad = [
      { type: "midi", label: "Midi", emoji: "🍽️", estimatedKcal: 700, columnName: "Midi" },
      { type: "soir", label: "Soir", emoji: "🌙", estimatedKcal: 600, columnName: "Soir" }
    ];

    todaysMeals = [];
    mealTypesToLoad.forEach(mealDef => {
      const mealValue = todayRow[mealDef.columnName] || "";
      const recipeNames = parseRecipeValue(mealValue);

      // Create entry for each recipe (support multiple recipes per meal)
      recipeNames.forEach(entry => {
        const recipeName = entry.name || entry;
        const portions = entry.portions || 1;
        if (!recipeName) return;

        let recipeKcal = mealDef.estimatedKcal;
        let isCustom = false;
        if (window.recipesData) {
          const recipe = Object.values(window.recipesData).find(r => r.name === recipeName);
          if (recipe && recipe.kcal_per_100) {
            recipeKcal = recipe.kcal_per_100;
          } else {
            isCustom = true;
            recipeKcal = null;
          }
        }

        todaysMeals.push({
          mealType: mealDef.type,
          label: mealDef.label,
          emoji: mealDef.emoji,
          name: recipeName,
          portions,
          kcal_per_100: recipeKcal,
          estimatedKcal: recipeKcal,
          actualKcal: null,
          eaten: false,
          timestamp: null,
          isCustom,
        });
      });
    });

    console.log(`Accueil: Loaded ${todaysMeals.length} meals for today (Midi/Soir only)`);
  } catch (err) {
    console.warn("Accueil: Could not load Planning tab:", err.message);
    todaysMeals = [];
  }
}

/**
 * Loads today's consumptions from the History_[user] sheet.
 * Filters to current date and populates todaysConsumptions.
 * Format: {time, name, qty, unit, kcal_total, type}
 */
async function loadTodaysConsumptions() {
  if (!window.SheetsAPI) {
    console.warn("Accueil: SheetsAPI not available");
    return;
  }

  try {
    const user = getCurrentUser();
    const historyTabName = `History_${user}`;
    const todayISO = getTodayISO();

    const rows = await window.SheetsAPI.readSheetTab(historyTabName);
    if (!rows || rows.length === 0) {
      console.log(`Accueil: No consumptions in ${historyTabName}`);
      todaysConsumptions = [];
      return;
    }

    const objects = window.SheetsAPI.rowsToObjects(rows);

    // Filter by today's date
    // Expected columns: Date, Time/Heure, Product/Nom, Quantity/Quantité, Unit/Unité, Total_calories/Kcal_total, Type
    todaysConsumptions = objects
      .filter(row => (row.Date || "").trim() === todayISO)
      .map(row => ({
        Heure: row.Time || row.Heure || "",
        Nom: row.Product || row.Nom || "",
        Quantité: Number(row.Quantity || row.Quantité || row.Quantite || row["Quantitée"] || row.Qty || 0),
        Unité: row.Unit || row.Unité || row.Unite || row.Unité || "g",
        Kcal_total: Number(row.Total_calories || row.Kcal_total || row.Kcal_total || 0),
        Type: row.Type || "other"
      }));

    // Recalculate total consumed calories
    caloriesConsumed = todaysConsumptions.reduce((sum, c) => sum + (c.Kcal_total || 0), 0);

    console.log(`Accueil: Loaded ${todaysConsumptions.length} consumptions for today, total=${caloriesConsumed} kcal`);
    renderWheel();
  } catch (err) {
    console.warn(`Accueil: Could not load History tab for ${user}:`, err.message);

    // Fallback to localStorage
    try {
      const today = getTodayISO();
      const saved = localStorage.getItem(`mealflow:consumptions:${user}:${today}`);
      if (saved) {
        todaysConsumptions = JSON.parse(saved);
        caloriesConsumed = todaysConsumptions.reduce((sum, c) => sum + (c.Kcal_total || 0), 0);
        console.log(`Accueil: Loaded ${todaysConsumptions.length} consumptions from localStorage, total=${caloriesConsumed} kcal`);
        renderWheel();
        return;
      }
    } catch (localErr) {
      console.warn(`Accueil: Could not load from localStorage:`, localErr.message);
    }

    todaysConsumptions = [];
    caloriesConsumed = 0;
  }
}

/* ============================================================================
   DEFERRED: SEARCH (Task 5)
   ============================================================================ */
// Search functionality deferred to Task 5: Grignottage and Search

/* ============================================================================
   MIDNIGHT DATE-CHANGE DETECTION
   ============================================================================ */

/**
 * Checks if the date has changed since last render (midnight rollover).
 * If so, re-fetches data and re-renders.
 */
function checkDateChange() {
  const today = getTodayISO();
  if (lastDateChecked && lastDateChecked !== today) {
    console.info("Accueil: New day detected, re-loading data");
    initAccueil();
  }
  lastDateChecked = today;
}

/* ============================================================================
   INITIALIZATION
   ============================================================================ */

/**
 * Ensures the History sheet for the current user exists.
 * If the sheet doesn't exist, creates it with the header row.
 * @param {string} user - The current user (e.g., "florian" or "naomi")
 * @param {string} token - OAuth2 access token
 * @returns {Promise<void>}
 */
async function ensureHistorySheetExists(user, token) {
  const sheetName = `History_${user}`;

  try {
    // Attempt to read the sheet to check if it exists
    await readSheetTab(sheetName);
    console.log(`Accueil: History sheet "${sheetName}" already exists`);
  } catch (error) {
    // Sheet doesn't exist, create it with header row
    console.log(`Accueil: Creating history sheet "${sheetName}"`);

    const headerRow = ["Date", "Heure", "Nom", "Quantité", "Unité", "Kcal_total", "Type"];

    try {
      await appendRowWithToken(sheetName, headerRow, token);
      console.log(`Accueil: History sheet "${sheetName}" created successfully`);
    } catch (appendError) {
      console.error(`Accueil: Failed to create history sheet "${sheetName}":`, appendError);
      // Don't throw - user can still use app, just won't sync to Sheets
    }
  }
}

async function initAccueil() {
  lastDateChecked = getTodayISO();
  currentUser = window.UserContext ? window.UserContext.getCurrentUser() : "florian";

  // Apply user-specific styling
  if (window.UserContext) {
    window.UserContext.applyUserStyling();
    window.UserContext.initializeUserToggle();
  }

  // Render greeting immediately
  renderGreeting();

  // Show 0% circle while data loads
  renderProgressCircle(0);

  // Render placeholder meals
  renderMeals();

  // Setup modal handlers (from recettes.js)
  if (typeof setupModalHandlers === 'function') {
    setupModalHandlers();
  }

  // Load data in parallel
  await Promise.all([
    loadDailyGoal(),
    loadTodaysMeals(),
    loadTodaysConsumptions(),
    loadConversionFactors ? loadConversionFactors() : Promise.resolve(),
  ]);

  // Load saved meals state (eaten/calories) from localStorage
  loadMealsState();

  // Re-render with real data
  renderGreeting();
  renderMeals();
  updateProgressDisplay();
  renderWheel();

  // Deduct past meals from inventory (once per day)
  await deductPastMeals();

  // Ensure History sheet exists for current user
  const accessToken = getAccessToken();
  if (accessToken) {
    await ensureHistorySheetExists(currentUser, accessToken);
  } else {
    console.warn("Accueil: No OAuth token available. History sheet sync disabled.");
  }

  // Initialize search (searches within meal names) — DEFERRED: Task 5 feature
  // Initialize Grignottage button — DEFERRED: Task 5 feature
}

/* ============================================================================
   AUTOMATIC INVENTORY DEDUCTION
   ============================================================================ */

let _deductionDone = false;

function parseRecipeValueLocal(value) {
  if (!value || value === "None") return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter(r => r).map(item =>
        typeof item === 'string' ? { name: item, portions: 1 } : item
      );
    }
  } catch (e) {}
  return value ? [{ name: value, portions: 1 }] : [];
}

async function readParametre(key, token) {
  try {
    const rows = await window.SheetsAPI.readSheetTab('Parametres');
    const obj = window.SheetsAPI.rowsToObjects(rows).find(r => r.Cle === key);
    return obj ? { value: obj.Valeur || '', rowNum: rows.findIndex((r,i) => i > 0 && r[0] === key) + 1 } : null;
  } catch (e) { return null; }
}

async function writeParametre(key, value, token) {
  try {
    const rows = await window.SheetsAPI.readSheetTab('Parametres');
    const objects = window.SheetsAPI.rowsToObjects(rows);
    const idx = objects.findIndex(r => r.Cle === key);
    if (idx >= 0) {
      await window.SheetsAPI.updateSheetCell(`Parametres!B${idx + 2}`, value, token);
    } else {
      // Init headers if empty
      if (rows.length <= 1) {
        await window.SheetsAPI.batchUpdateRange('Parametres!A1:B1', [['Cle', 'Valeur']], token);
      }
      await window.SheetsAPI.appendRowWithToken('Parametres', [key, value], token);
    }
  } catch (e) { console.warn('writeParametre failed:', e); }
}

async function deductPastMeals() {
  if (_deductionDone) return;
  _deductionDone = true;
  const token = getAccessToken?.();
  if (!token || !window.SheetsAPI) return;

  const yesterdayISO = getDateISO(-1);

  // Read last deduction date from Sheets Parametres
  const param = await readParametre('derniere_deduction', token);
  const lastDeduction = param?.value || null;

  // If already deducted up to yesterday → nothing to do
  if (lastDeduction >= yesterdayISO) return;

  // Calculate dates to deduct: lastDeduction+1 to yesterday (max 7 days)
  const toDeductDates = [];
  for (let i = 1; i <= 7; i++) {
    const dateISO = getDateISO(-i);
    if (!lastDeduction || dateISO > lastDeduction) toDeductDates.push(dateISO);
  }
  // Sort chronologically
  toDeductDates.sort();
  if (toDeductDates.length === 0) return;

  // Read Planning sheet
  let planByDate = {};
  try {
    const planRows = await window.SheetsAPI.readSheetTab('Planning');
    window.SheetsAPI.rowsToObjects(planRows).forEach(row => {
      if (row.Date && toDeductDates.includes(row.Date)) {
        planByDate[row.Date] = {
          Midi: parseRecipeValueLocal(row.Midi),
          Soir: parseRecipeValueLocal(row.Soir)
        };
      }
    });
  } catch (e) {
    console.warn('deductPastMeals: could not read Planning sheet', e);
    return;
  }

  const norm = s => (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');

  // Collect all quantity changes in memory first
  const inventoryChanges = {}; // key: sheetRowNumber → newQty (string)

  for (const dateISO of toDeductDates) {
    const dayPlan = planByDate[dateISO];
    if (!dayPlan) continue;

    const entries = [...(dayPlan.Midi || []), ...(dayPlan.Soir || [])];
    for (const { name: recipeName, portions } of entries) {
      const recipe = Object.values(window.recipesData || {}).find(r => r.name === recipeName);
      if (!recipe?.ingredients) continue;

      for (const ing of recipe.ingredients) {
        const item = (window.inventoryData || []).find(i => norm(i.Produit) === norm(ing.name));
        if (!item || !item.sheetRowNumber) continue;

        const recipeUnit = ing.unit || 'g';
        const invUnit = item.Unité || 'g';
        const unitOk = recipeUnit === invUnit ||
          (recipeUnit === 'piece' && invUnit === 'pièce') ||
          (recipeUnit === 'pièce' && invUnit === 'piece');
        if (!unitOk) continue;

        const qtyToDeduct = (parseFloat(ing.quantity) || 0) * (portions || 1);
        // Read current qty from item (may have been updated by previous iteration)
        const current = parseFloat(item.Qty) || 0;
        const newQty = Math.max(0, current - qtyToDeduct);
        item.Qty = newQty.toString();
        inventoryChanges[item.sheetRowNumber] = newQty.toString();
      }
    }
  }

  // Single batch call for all inventory updates
  const updates = Object.entries(inventoryChanges).map(([row, val]) => ({
    range: `Inventory!D${row}`,
    value: val
  }));

  if (updates.length > 0) {
    try {
      await window.SheetsAPI.batchUpdateCells(updates, token);
      console.log(`Déduction: ${updates.length} cellules inventaire mises à jour`);
    } catch (e) {
      console.warn('deductPastMeals: batch update failed', e);
      // Don't update derniere_deduction if writes failed
      return;
    }
  }

  // Update last deduction date to yesterday (single write)
  await writeParametre('derniere_deduction', yesterdayISO, token);
  if (typeof saveInventory === 'function') saveInventory();
  console.log(`Déduction inventaire effectuée jusqu'au ${yesterdayISO}`);
}

/* ============================================================================
   EVENT LISTENERS
   ============================================================================ */

document.addEventListener("userChanged", function () {
  // Reset meals state and reload for new user
  caloriesConsumed = 0;
  todaysMeals.forEach(m => {
    m.eaten = false;
    m.actualKcal = null;
  });

  // Load the new user's meals state
  loadMealsState();

  // Update UI
  renderGreeting();
  renderMeals();
  updateProgressDisplay();
  renderWheel();
});

// Check for midnight rollover every minute
setInterval(checkDateChange, 60 * 1000);

// Boot
document.addEventListener("DOMContentLoaded", initAccueil);
