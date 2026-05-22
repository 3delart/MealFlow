/**
 * MealFlow — Accueil (Landing Page) Logic
 * Renders greeting, progress circle, today's objectives, and search.
 * Reads Profils + Planning tabs from Google Sheets.
 */

/* ============================================================================
   STATE
   ============================================================================ */

const AccueilState = {
  profiles: { florian: null, naomi: null },
  todayMeals: [
    // Structure: { mealType, name, estimatedKcal, eaten, actualKcal, timestamp }
  ],
  caloriesConsumed: 0,    // Will be populated from localStorage + Grignottage
  grignottageCalories: 0, // Calories from scanned snacks today
  lastDateChecked: null,  // ISO date string to detect midnight rollover
};

/**
 * Grignottage scanner state
 */
let grignottageScanner = null;
let grignottageCurrentBarcode = null;

/* ============================================================================
   DATE HELPERS (inline until utils.js is available in Task 5)
   ============================================================================ */

/**
 * Returns today's date as an ISO string (YYYY-MM-DD)
 * @returns {string}
 */
function getTodayISO() {
  return new Date().toISOString().split("T")[0];
}

/**
 * Returns a localized French date string, e.g. "Jeudi 22 mai"
 * @returns {string}
 */
function getLocaleDateFr() {
  return new Date().toLocaleDateString("fr-FR", {
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
  const user = window.UserContext ? window.UserContext.getCurrentUser() : "florian";
  const displayName = user.charAt(0).toUpperCase() + user.slice(1);

  const greetingEl = document.getElementById("greeting");
  const dateTodayEl = document.getElementById("date-today");
  const calorieObjectiveEl = document.getElementById("calorie-objective");

  if (greetingEl) {
    greetingEl.textContent = `Bonjour ${displayName} 👋`;
  }

  if (dateTodayEl) {
    dateTodayEl.textContent = getLocaleDateFr();
  }

  if (calorieObjectiveEl) {
    const profile = AccueilState.profiles[user];
    if (profile && (profile.Calories_cible || profile.Objectif || profile.objectifKcal)) {
      const kcal = Number(profile.Calories_cible || profile.Objectif || profile.objectifKcal) || 0;
      calorieObjectiveEl.textContent = `Objectif: ${kcal.toLocaleString("fr-FR")} kcal`;
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
    const user = window.UserContext ? window.UserContext.getCurrentUser() : "florian";
    const profile = AccueilState.profiles[user];
    const target = profile && (profile.Calories_cible || profile.Objectif || profile.objectifKcal) ? Number(profile.Calories_cible || profile.Objectif || profile.objectifKcal) : null;
    const consumed = AccueilState.caloriesConsumed;

    if (target) {
      circleCaption.textContent = `${consumed.toLocaleString("fr-FR")} / ${target.toLocaleString("fr-FR")} kcal`;
    } else {
      circleCaption.textContent = `${consumed.toLocaleString("fr-FR")} kcal consommées`;
    }
  }
}

/**
 * Renders the meals section with today's 5 meals and action buttons.
 */
function renderMeals() {
  const container = document.getElementById("meals-container");
  if (!container) return;

  // Clear previous content
  container.innerHTML = "";

  if (AccueilState.todayMeals.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: var(--spacing-lg); color: var(--color-text-light);">
        <p>📋 Aucun repas planifié pour aujourd'hui</p>
        <p style="font-size: var(--font-size-small);">Génère une semaine dans la page Planning</p>
      </div>`;
    return;
  }

  const mealsHtml = AccueilState.todayMeals
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
                <p class="meal-kcal">${displayKcal} kcal</p>
              </div>
            </div>
          </div>
          <div class="meal-actions">
            <button class="btn-meal btn-recette" onclick="showRecipe('${meal.mealType}')">
              📖
            </button>
            <button class="btn-meal btn-mange" onclick="toggleMealEaten('${meal.mealType}')">
              ${meal.eaten ? "✓" : "Mangé"}
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
  const meal = AccueilState.todayMeals.find(m => m.mealType === mealType);
  if (!meal) return;

  meal.eaten = !meal.eaten;

  // Recalculate consumed calories
  AccueilState.caloriesConsumed = AccueilState.todayMeals
    .filter(m => m.eaten)
    .reduce((sum, m) => sum + (m.actualKcal || m.estimatedKcal), 0);

  // Persist to localStorage
  saveMealsState();

  // Update UI
  renderMeals();
  updateProgressDisplay();
}

/**
 * Shows recipe (placeholder — can link to Sheets or open modal).
 */
function showRecipe(mealType) {
  const meal = AccueilState.todayMeals.find(m => m.mealType === mealType);
  if (!meal) return;

  // TODO: Link to Recipes tab or show modal with recipe details
  // For now, just log to console
  console.log(`Recipe requested for: ${meal.name}`);
}

/**
 * Updates the progress circle + caption after calories change.
 */
function updateProgressDisplay() {
  const user = window.UserContext ? window.UserContext.getCurrentUser() : "florian";
  const profile = AccueilState.profiles[user];
  const target = profile && (profile.Calories_cible || profile.Objectif || profile.objectifKcal) ? Number(profile.Calories_cible || profile.Objectif || profile.objectifKcal) : 0;
  if (!profile || target === 0) {
    console.warn(`updateProgressDisplay: No valid target for ${user}. Set Objectif in Profils sheet.`);
  }
  const pct = target > 0 ? (AccueilState.caloriesConsumed / target) * 100 : 0;
  console.log(`updateProgressDisplay: user=${user}, target=${target}, consumed=${AccueilState.caloriesConsumed}, pct=${pct}%`);
  renderProgressCircle(pct);
}

/**
 * Saves meals state (eaten status) to localStorage, separated by user and date.
 * Includes quantity and unit for snacks (grignottage items).
 */
function saveMealsState() {
  try {
    const user = window.UserContext ? window.UserContext.getCurrentUser() : "florian";
    const today = getTodayISO();
    const stateToSave = AccueilState.todayMeals.map(m => {
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
    localStorage.setItem(`mealflow:consumed:${user}:${today}`, String(AccueilState.caloriesConsumed));
  } catch (err) {
    console.warn("Could not save meals state to localStorage:", err);
  }
}

/**
 * Loads meals state (eaten status) from localStorage, separated by user and date.
 * Restores quantity and unit for snacks (grignottage items).
 */
function loadMealsState() {
  const user = window.UserContext ? window.UserContext.getCurrentUser() : "florian";
  const today = getTodayISO();
  const savedState = localStorage.getItem(`mealflow:meals:${user}:${today}`);
  const savedConsumed = localStorage.getItem(`mealflow:consumed:${user}:${today}`);

  if (savedState) {
    try {
      const stateArray = JSON.parse(savedState);
      stateArray.forEach(saved => {
        const meal = AccueilState.todayMeals.find(m => m.mealType === saved.mealType);
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

  if (savedConsumed) {
    AccueilState.caloriesConsumed = Number(savedConsumed);
  }
}

/* ============================================================================
   DATA LOADING
   ============================================================================ */

/**
 * Loads the Profils tab from Google Sheets and populates AccueilState.profiles.
 * Falls back gracefully if the API is not configured.
 */
async function loadProfilsData() {
  if (!window.SheetsAPI) {
    console.warn("Accueil: SheetsAPI not available");
    return;
  }

  try {
    const rows = await window.SheetsAPI.readSheetTab("Profils");
    const objects = window.SheetsAPI.rowsToObjects(rows);

    console.log("Accueil: Profils columns available:", objects.length > 0 ? Object.keys(objects[0]) : "no data");

    // Expected columns: User (or nom), Objectif (or objectifKcal)
    objects.forEach(profile => {
      const key = (profile.User || profile.nom || "").toLowerCase().trim();
      if (key === "florian" || key === "naomi") {
        console.log(`Accueil: Loaded profile ${key}:`, profile);
        console.log(`Accueil: Profile ${key} Objectif value:`, profile.Objectif, "type:", typeof profile.Objectif);
        AccueilState.profiles[key] = profile;
      }
    });
    console.log("Accueil: Profiles loaded:", AccueilState.profiles);
    Object.entries(AccueilState.profiles).forEach(([key, profile]) => {
      if (profile) {
        console.log(`Accueil: ${key} Objectif = ${profile.Objectif || "NULL"}`);
        const numVal = Number(profile.Calories_cible || profile.Objectif || profile.objectifKcal || 0);
        if (isNaN(numVal) || numVal === 0) {
          console.warn(`Accueil: ${key} Objectif is ${numVal} - check Sheets has numeric value`);
        }
      }
    });
    const foundProfiles = Object.values(AccueilState.profiles).filter(p => p !== null).length;
    if (foundProfiles === 0) {
      console.warn("Accueil: No profiles loaded! Check Sheets 'User' column matches 'florian' or 'naomi'");
    }
  } catch (err) {
    console.error("Accueil CRITICAL: Could not load Profils tab:", err.message);
    console.error("This means profile.Objectif will be undefined and calorie target will show as 0");
    // Leave profiles as null — UI will show placeholder
  }
}

/**
 * Loads the Planning tab and builds todayMeals array for today.
 */
async function loadPlanningData() {
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
      AccueilState.todayMeals = [];
      return;
    }

    // Build meals array from columns: Petit-déj, Collation_matin, Déjeuner, etc.
    AccueilState.todayMeals = MEAL_TIMES.map(mealDef => {
      // Try different column name variations
      const mealTypeToColumn = {
        "petit_dejeuner": "Petit-déj",
        "collation_matin": "Collation_matin",
        "dejeuner": "Déjeuner",
        "collation_apres_midi": "Collation_après-midi",
        "diner": "Diner"
      };
      const columnName = mealTypeToColumn[mealDef.type];
      const mealName = (todayRow[columnName] || "").trim();

      return {
        mealType: mealDef.type,
        label: mealDef.label,
        emoji: mealDef.emoji,
        name: mealName || mealDef.label,
        estimatedKcal: mealDef.estimatedKcal,
        actualKcal: null,
        eaten: false,
        timestamp: null,
      };
    });

    console.log(`Accueil: Loaded ${AccueilState.todayMeals.length} meals for today`);
  } catch (err) {
    console.warn("Accueil: Could not load Planning tab:", err.message);
    AccueilState.todayMeals = [];
  }
}

/**
 * Placeholder: fetches Courses tab and calculates calories consumed today.
 * Full integration deferred until Courses page is built (Task 8).
 */
async function updateProgressFromSheets() {
  // TODO (Task 8 integration): read Courses tab, sum kcal for today's date
  // For now, consumed stays at 0
  AccueilState.caloriesConsumed = 0;
}

/* ============================================================================
   SEARCH
   ============================================================================ */

function initializeSearch() {
  const input = document.getElementById("search-meals");
  const results = document.getElementById("search-results");
  if (!input || !results) return;

  input.addEventListener("input", function () {
    const query = input.value.trim().toLowerCase();

    if (query.length < 2) {
      results.classList.add("hidden");
      results.innerHTML = "";
      return;
    }

    // Search within today's meals
    const matches = AccueilState.todayMeals.filter(m =>
      m.name.toLowerCase().includes(query) || m.label.toLowerCase().includes(query)
    );

    if (matches.length === 0) {
      results.innerHTML = `<div class="search-result-item">Aucun résultat pour "${query}"</div>`;
    } else {
      results.innerHTML = matches
        .map(m => `<div class="search-result-item">${m.emoji} ${m.name}</div>`)
        .join("");
    }

    results.classList.remove("hidden");
  });

  document.addEventListener("click", function (e) {
    if (!input.contains(e.target) && !results.contains(e.target)) {
      results.classList.add("hidden");
    }
  });
}

/* ============================================================================
   MIDNIGHT DATE-CHANGE DETECTION
   ============================================================================ */

/**
 * Checks if the date has changed since last render (midnight rollover).
 * If so, re-fetches data and re-renders.
 */
function checkDateChange() {
  const today = getTodayISO();
  if (AccueilState.lastDateChecked && AccueilState.lastDateChecked !== today) {
    console.info("Accueil: New day detected, re-loading data");
    initAccueil();
  }
  AccueilState.lastDateChecked = today;
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

    const headerRow = [
      "Date",
      "Product",
      "Quantity",
      "Unit",
      "Calories_per_100g",
      "Total_calories",
      "Type"
    ];

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
  AccueilState.lastDateChecked = getTodayISO();

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

  // Load data in parallel
  await Promise.all([
    loadProfilsData(),
    loadPlanningData(),
  ]);

  // Load saved meals state (eaten/calories) from localStorage
  loadMealsState();

  // Re-render with real data
  renderGreeting();
  renderMeals();
  updateProgressDisplay();

  // Ensure History sheet exists for current user
  const currentUser = window.UserContext ? window.UserContext.getCurrentUser() : "florian";
  const accessToken = getAccessToken();
  if (accessToken) {
    await ensureHistorySheetExists(currentUser, accessToken);
  } else {
    console.warn("Accueil: No OAuth token available. History sheet sync disabled.");
  }

  // Initialize search (searches within meal names)
  initializeSearch();

  // Initialize Grignottage button
  initializeGrignottageButton();
}

/**
 * Opens the Grignottage scanner modal.
 */
function initializeGrignottageButton() {
  const btn = document.getElementById("grignottage-btn");
  if (btn) {
    btn.addEventListener("click", openGrignottageModal);
  }

  // Initialize radio button handlers for mode selection
  initializeGrignottageMode();
}

/**
 * Initializes grignottage mode radio button handlers.
 * Toggles visibility between scan and pick sections.
 */
function initializeGrignottageMode() {
  const radios = document.querySelectorAll('input[name="grignottage-mode"]');
  radios.forEach(radio => {
    radio.addEventListener("change", (e) => {
      const mode = e.target.value;
      const scanSection = document.getElementById("scanner-mode-section");
      const pickSection = document.getElementById("pick-mode-section");

      if (mode === "scan") {
        if (scanSection) scanSection.classList.remove("hidden");
        if (pickSection) pickSection.classList.add("hidden");
        // Start scanner when switching to scan mode
        startScanner();
      } else if (mode === "pick") {
        if (scanSection) scanSection.classList.add("hidden");
        if (pickSection) pickSection.classList.remove("hidden");
        // Stop scanner when switching away from scan mode
        stopScanner();
        // Populate inventory list for pick mode
        pickInventoryProduct();
      }
    });
  });
}

/**
 * Populates the pick-mode-section with active inventory items.
 * Creates a dropdown/list of products with Qty > 0.
 * On product select: logs selection and prepares for renderGrignottageForm (Task 5).
 */
function pickInventoryProduct() {
  const inventoryList = document.getElementById("inventory-list");
  if (!inventoryList) return;

  // Get active items from inventory
  if (!window.InventoryAPI || !window.InventoryAPI.getActiveItems) {
    inventoryList.innerHTML = '<div style="color: var(--color-text-light); padding: var(--spacing-md);">❌ Inventaire non disponible</div>';
    console.warn("pickInventoryProduct: InventoryAPI.getActiveItems not available");
    return;
  }

  const activeItems = window.InventoryAPI.getActiveItems();

  if (activeItems.length === 0) {
    inventoryList.innerHTML = '<div style="color: var(--color-text-light); padding: var(--spacing-md);">📭 Aucun produit en inventaire</div>';
    return;
  }

  // Build dropdown/list of products grouped by category
  let html = '<div style="display: flex; flex-direction: column; gap: var(--spacing-md);">';
  let currentCategory = null;

  activeItems.forEach(item => {
    // Add category header if changed
    if (item.category !== currentCategory) {
      if (currentCategory !== null) {
        html += '</div>'; // Close previous category group
      }
      currentCategory = item.category;
      html += `<div style="margin-top: 8px;"><div style="font-weight: bold; color: var(--color-primary); font-size: 0.9em; text-transform: uppercase; letter-spacing: 0.5px;">${item.category}</div>`;
    }

    // Product item
    const calorieInfo = item.calories_per_100 ? ` | ${item.calories_per_100} kcal/100` : '';
    html += `
      <div style="
        padding: var(--spacing-md);
        margin: 6px 0;
        background-color: var(--color-bg);
        border: 1px solid var(--color-border);
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
      "
      class="inventory-pick-item"
      data-item-id="${item.id}"
      data-item-name="${item.name}"
      onclick="selectProductForGrignottage(this)">
        <strong style="display: block; margin-bottom: 4px;">${item.name}</strong>
        <div style="font-size: 0.85em; color: var(--color-text-light);">
          ${item.qty} ${item.unit}${calorieInfo}
        </div>
      </div>
    `;
  });

  if (currentCategory !== null) {
    html += '</div>'; // Close last category group
  }
  html += '</div>';

  inventoryList.innerHTML = html;

  // Add hover effects
  document.querySelectorAll('.inventory-pick-item').forEach(el => {
    el.addEventListener('mouseenter', function() {
      this.style.backgroundColor = 'var(--color-primary)';
      this.style.color = 'white';
    });
    el.addEventListener('mouseleave', function() {
      this.style.backgroundColor = 'var(--color-bg)';
      this.style.color = 'inherit';
    });
  });
}

/**
 * Handles product selection in pick mode.
 * Calls renderGrignottageForm (to be created in Task 5) with selected product data.
 * For now, logs selection and shows alert.
 * @param {HTMLElement} element - The clicked product element
 */
function selectProductForGrignottage(element) {
  const itemId = element.getAttribute('data-item-id');

  if (!window.InventoryAPI) {
    console.error("selectProductForGrignottage: InventoryAPI not available");
    return;
  }

  // Find full item data
  const allItems = window.InventoryAPI.getData();
  const selectedProduct = allItems.find(i => i.id === itemId);

  if (!selectedProduct) {
    console.error(`selectProductForGrignottage: Item ${itemId} not found`);
    return;
  }

  console.log("Selected product for grignottage:", selectedProduct);

  // Render the form for this product
  renderGrignottageForm(selectedProduct);
}

/**
 * Opens the scanner modal.
 */
function openGrignottageModal() {
  const modal = document.getElementById("scanner-modal");
  if (!modal) return;

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");

  // Check which mode is currently selected
  const selectedMode = document.querySelector('input[name="grignottage-mode"]:checked');
  if (selectedMode && selectedMode.value === "scan") {
    startScanner();
  }
}

/**
 * Closes the scanner modal.
 */
async function closeGrignottageModal() {
  const modal = document.getElementById("scanner-modal");
  if (modal) {
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
  }
  if (grignottageScanner) {
    await grignottageScanner.stop().catch(() => {});
    grignottageScanner = null;
  }
}

/**
 * Starts the html5-qrcode scanner.
 */
function startScanner() {
  const scannerContainer = document.getElementById("scanner-container");
  if (!scannerContainer) return;

  // Stop any existing scanner before starting a new one
  if (grignottageScanner) {
    grignottageScanner.stop().catch(() => {});
  }

  grignottageScanner = new Html5Qrcode("scanner-container");

  grignottageScanner.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: 250 },
    (decodedText) => {
      grignottageCurrentBarcode = decodedText;
      onBarcodeDetected(decodedText);
    },
    (error) => {
      console.log(`Scanner error: ${error}`);
    }
  ).catch((err) => {
    console.error("Failed to start scanner:", err);
    alert("Caméra non disponible");
    closeGrignottageModal();
  });
}

/**
 * Stops the scanner.
 */
function stopScanner() {
  if (grignottageScanner) {
    grignottageScanner.stop().catch(() => {});
    grignottageScanner = null;
  }
}

/**
 * Called when a barcode is detected in scan mode.
 * Delegates to scanGrignottageProduct to handle the scanning.
 */
async function onBarcodeDetected(barcode) {
  console.log(`Barcode detected: ${barcode}`);
  await scanGrignottageProduct(barcode);
}

/**
 * Renders the grignottage consumption form in the modal.
 * Shows product info and form for quantity input with live calorie calculation.
 * @param {Object} product - Product data with name, unit, calories_per_100, sheetRowNumber
 * @param {string} mode - "scan" or "pick" to determine which container to use
 */
function renderGrignottageForm(product, mode = "pick") {
  const containerId = mode === "scan" ? "grignottage-form-container-scan" : "grignottage-form-container-pick";
  const formContainer = document.getElementById(containerId);
  if (!formContainer) {
    console.error(`renderGrignottageForm: ${containerId} not found`);
    return;
  }

  const unit = product.unit || product.Unité || "g";
  const caloriesPer100 = product.calories_per_100 || 0;
  const productName = product.name || product.Produit || "Produit inconnu";

  const html = `
    <form id="grignottage-form" style="display: flex; flex-direction: column; gap: var(--spacing-md);">
      <!-- Product Name (display only) -->
      <div style="padding: var(--spacing-md); background-color: var(--color-bg); border-radius: 6px; border-left: 3px solid var(--color-primary);">
        <label style="font-size: 0.9em; color: var(--color-text-light); display: block; margin-bottom: 4px;">Produit</label>
        <div id="form-product-name" style="font-weight: bold; font-size: 1.1em;">${productName}</div>
      </div>

      <!-- Quantity Input -->
      <div style="display: flex; gap: var(--spacing-md);">
        <div style="flex: 1;">
          <label for="form-quantity" style="font-size: 0.9em; color: var(--color-text-light); display: block; margin-bottom: 4px;">Quantité</label>
          <input
            type="number"
            id="form-quantity"
            min="0"
            step="0.5"
            placeholder="0"
            required
            style="
              width: 100%;
              padding: var(--spacing-sm) var(--spacing-md);
              border: 1px solid var(--color-border);
              border-radius: 4px;
              font-size: 1em;
              font-family: inherit;
            "
          />
        </div>
        <div style="flex: 0.8;">
          <label for="form-unit" style="font-size: 0.9em; color: var(--color-text-light); display: block; margin-bottom: 4px;">Unité</label>
          <select
            id="form-unit"
            style="
              width: 100%;
              padding: var(--spacing-sm) var(--spacing-md);
              border: 1px solid var(--color-border);
              border-radius: 4px;
              font-size: 1em;
              font-family: inherit;
            "
          >
            <option value="g">g</option>
            <option value="ml">ml</option>
            <option value="litre">litre</option>
            <option value="pièce">pièce</option>
          </select>
        </div>
      </div>

      <!-- Calories Info -->
      <div style="display: flex; gap: var(--spacing-md); font-size: 0.9em;">
        <div style="flex: 1; padding: var(--spacing-sm) var(--spacing-md); background-color: var(--color-bg); border-radius: 4px;">
          <span style="color: var(--color-text-light); display: block; margin-bottom: 2px;">Kcal / 100</span>
          <strong id="form-calories-per-100">${Math.round(caloriesPer100)}</strong>
        </div>
        <div style="flex: 1; padding: var(--spacing-sm) var(--spacing-md); background-color: var(--color-primary); border-radius: 4px; color: white;">
          <span style="display: block; margin-bottom: 2px;">Kcal total</span>
          <strong id="form-total-calories" style="font-size: 1.2em;">0</strong>
        </div>
      </div>

      <!-- Submit Button -->
      <button
        type="submit"
        style="
          padding: var(--spacing-md);
          background-color: var(--color-primary);
          color: white;
          border: none;
          border-radius: 6px;
          font-weight: bold;
          font-size: 1em;
          cursor: pointer;
          transition: background-color 0.2s ease;
        "
      >
        ✓ Ajouter à ma consommation
      </button>
    </form>
  `;

  formContainer.innerHTML = html;

  // Store product data in a data attribute for addGrignottage to access
  const form = document.getElementById("grignottage-form");
  if (form) {
    form.dataset.productData = JSON.stringify({
      name: productName,
      unit: unit,
      calories_per_100: caloriesPer100,
      sheetRowNumber: product.sheetRowNumber || null,
      id: product.id || null
    });

    // Add event listeners
    const quantityInput = document.getElementById("form-quantity");
    const unitSelect = document.getElementById("form-unit");

    if (quantityInput && unitSelect) {
      const updateCalories = () => {
        const qty = parseFloat(quantityInput.value) || 0;
        const totalCalories = (caloriesPer100 / 100) * qty;
        const totalEl = document.getElementById("form-total-calories");
        if (totalEl) {
          totalEl.textContent = Math.round(totalCalories);
        }
      };

      quantityInput.addEventListener("input", updateCalories);
      unitSelect.addEventListener("change", updateCalories);
    }

    // Add form submission listener
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      addGrignottage();
    });

    // Focus on quantity input
    if (quantityInput) {
      quantityInput.focus();
    }
  }
}

/**
 * Scans a product from barcode in grignottage modal.
 * Fetches from Open Food Facts API, auto-adds to inventory if needed,
 * and renders the product form for quantity input.
 * @param {string} barcode - Product barcode
 */
async function scanGrignottageProduct(barcode) {
  const resultDiv = document.getElementById("scanner-result");
  const nameEl = document.getElementById("result-name");
  const kcalEl = document.getElementById("result-kcal");

  if (!resultDiv || !nameEl || !kcalEl) {
    console.error("Scanner result elements not found");
    stopScanner();
    return;
  }

  resultDiv.classList.remove("hidden");

  try {
    // Fetch product from inventory.js function if available
    let product = null;
    if (window.fetchProductFromOpenFoodFacts) {
      product = await window.fetchProductFromOpenFoodFacts(barcode);
    } else {
      console.warn("fetchProductFromOpenFoodFacts not available, falling back to inline fetch");
      const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      if (response.ok) {
        const data = await response.json();
        if (data.product && data.status === 1) {
          product = {
            name: data.product.product_name || data.product.generic_name || barcode,
            calories: data.product.nutriments?.["energy-kcal"] || data.product.nutriments?.["energy-kcal_100g"] || 0,
            category: "Autres",
            unit: "pièce",
            quantity: 1
          };
        }
      }
    }

    if (product) {
      console.log("Product fetched:", product);

      // Check if product already in inventory
      let existingItem = null;
      if (window.InventoryAPI) {
        const existing = window.InventoryAPI.searchByName(product.name, true);
        if (existing.length > 0) {
          console.log("Product found in inventory:", existing[0]);
          existingItem = existing[0];
        } else {
          console.log("Product not in inventory, will auto-add if selected");
        }
      }

      // Prepare product object for renderGrignottageForm
      // Use inventory item if found, otherwise use API data
      const formProduct = existingItem || {
        name: product.name,
        Produit: product.name,
        unit: product.unit || "g",
        Unité: product.unit || "g",
        calories_per_100: product.calories || 0,
        category: product.category || "Autres",
        sheetRowNumber: existingItem?.sheetRowNumber || null,
        id: existingItem?.id || null
      };

      // Hide old scanner result UI and show form
      resultDiv.classList.add("hidden");
      renderGrignottageForm(formProduct, "scan");
    } else {
      // Product not found in API
      console.log("No product found in API for barcode:", barcode);
      nameEl.textContent = `Code ${barcode}`;
      kcalEl.value = "";
      kcalEl.focus();
      kcalEl.placeholder = "Entrer calories";
    }
  } catch (err) {
    console.error("Failed to fetch product data:", err);
    nameEl.textContent = `Code ${barcode}`;
    kcalEl.value = "";
    kcalEl.focus();
  }

  stopScanner();
}

/**
 * Shows matching inventory products when barcode result displayed.
 * Called after API fetch to suggest existing products user already has.
 * @param {string} productName - Name from API result
 */
function showInventorySuggestions(productName) {
  if (!window.InventoryAPI) {
    console.log("InventoryAPI not available, skipping suggestions");
    return;
  }

  const suggestions = window.InventoryAPI.searchByName(productName, true);
  const container = document.getElementById("inventory-suggestions");
  if (!container) return;

  if (suggestions.length === 0) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = `
    <div style="font-size: 12px; color: var(--color-text-light); margin-bottom: 8px;">
      📦 Produits en inventaire qui correspondent:
    </div>
  ` + suggestions.map(item => `
    <div style="
      padding: 8px;
      margin-bottom: 4px;
      background-color: var(--color-bg);
      border-radius: 4px;
      border-left: 3px solid var(--color-primary);
      cursor: pointer;
      font-size: 13px;
    " onclick="selectInventoryProduct('${item.id}')">
      <strong>${item.Produit}</strong>
      <div style="color: var(--color-text-light); font-size: 11px; margin-top: 2px;">
        ${item.Qty} ${item.Unité} | ${item.calories_per_100 ? item.calories_per_100 + ' kcal/100' : '—'}
      </div>
    </div>
  `).join("");
}

/**
 * Selects an inventory product and pre-fills calories based on quantity.
 * User can still adjust before confirming.
 * @param {string} itemId
 */
function selectInventoryProduct(itemId) {
  if (!window.InventoryAPI) return;

  const item = window.InventoryAPI.getData().find(i => i.id === itemId);
  if (!item) return;

  // Pre-fill result elements
  document.getElementById("result-name").textContent = item.Produit;
  document.getElementById("result-brand").textContent = `Inventaire: ${item.Qty} ${item.Unité}`;

  // If has calorie data, calculate total calories for available qty
  if (item.calories_per_100) {
    const caloriesPer100 = parseFloat(item.calories_per_100);
    const totalQty = parseFloat(item.Qty);
    const totalCalories = (totalQty * caloriesPer100) / 100;
    document.getElementById("result-kcal").value = Math.round(totalCalories);
    console.log(`Selected: ${item.Produit} - ${totalQty}${item.Unité} = ${Math.round(totalCalories)} kcal`);
  } else {
    document.getElementById("result-kcal").value = "";
    document.getElementById("result-kcal").placeholder = `(${item.Produit} n'a pas données nutrition)`;
  }

  // Clear suggestions after selection
  const container = document.getElementById("inventory-suggestions");
  if (container) container.innerHTML = "";
}

/**
 * Restarts the scanner after result is shown.
 */
function restartScanner() {
  const resultDiv = document.getElementById("scanner-result");
  if (resultDiv) {
    resultDiv.classList.add("hidden");
  }
  startScanner();
}

/**
 * Adds grignottage from the consumption form.
 * Creates a meal object, updates inventory, saves to History sheet, and updates state.
 */
async function addGrignottage() {
  const form = document.getElementById("grignottage-form");
  if (!form) {
    console.error("addGrignottage: form not found");
    return;
  }

  // Get product data from form data attribute
  let productData = {};
  try {
    productData = JSON.parse(form.dataset.productData || "{}");
  } catch (err) {
    console.error("addGrignottage: failed to parse product data:", err);
    return;
  }

  // Get form inputs
  const quantityInput = document.getElementById("form-quantity");
  const unitSelect = document.getElementById("form-unit");

  if (!quantityInput || !unitSelect) {
    console.error("addGrignottage: form inputs not found");
    return;
  }

  const quantity = parseFloat(quantityInput.value) || 0;
  const unit = unitSelect.value || "g";
  const caloriesPer100 = productData.calories_per_100 || 0;
  const productName = productData.name || "Produit inconnu";

  // Validate quantity
  if (quantity < 0.1 || quantity > 100000) {
    alert("Entrer une quantité valide (> 0)");
    return;
  }

  // Calculate total calories
  const totalCalories = (caloriesPer100 / 100) * quantity;

  if (totalCalories < 1) {
    alert("Calories totales doivent être >= 1 kcal");
    return;
  }

  try {
    // Create snack item for todayMeals
    const snackItem = {
      mealType: "grignottage",
      label: "Grignottage",
      emoji: "🍪",
      name: productName,
      quantity: quantity,
      unit: unit,
      estimatedKcal: Math.round(totalCalories),
      actualKcal: Math.round(totalCalories),
      eaten: true,
      timestamp: Date.now()
    };

    // Add to todayMeals
    AccueilState.todayMeals.push(snackItem);
    AccueilState.caloriesConsumed += Math.round(totalCalories);
    AccueilState.grignottageCalories += Math.round(totalCalories);

    // Note: Inventory quantity reduction is handled by the inventory page itself
    // We log the consumption but don't auto-decrement inventory here
    if (productData.sheetRowNumber) {
      console.log(`addGrignottage: Consumed product at inventory row ${productData.sheetRowNumber}`);
    }

    // Save consumption to History sheet
    if (window.SheetsAPI && window.SheetsAPI.appendConsumptionRecord) {
      const user = window.UserContext ? window.UserContext.getCurrentUser() : "florian";
      const token = typeof getAccessToken === "function" ? getAccessToken() : null;
      const historyTab = `History_${user}`;
      const today = getTodayISO();

      if (!token) {
        console.warn("addGrignottage: No access token for History sheet, skipping");
      } else {
        try {
          await window.SheetsAPI.appendConsumptionRecord(
            historyTab,
            today,
            productName,
            quantity,
            unit,
            caloriesPer100,
            Math.round(totalCalories),
            "grignottage",
            token
          );
          console.log("addGrignottage: Saved to History sheet");
        } catch (err) {
          console.warn("addGrignottage: Failed to save to History sheet:", err);
        }
      }
    }

    // Save state to localStorage
    saveMealsState();

    // Update UI
    renderMeals();
    updateProgressDisplay();

    // Notify user
    alert(`Ajouté: ${productName} (${Math.round(totalCalories)} kcal)`);

    // Close modal and reset form
    closeGrignottageModal();
  } catch (err) {
    console.error("addGrignottage: Unexpected error:", err);
    alert("Erreur lors de l'ajout du grignottage");
  }
}

/* ============================================================================
   EVENT LISTENERS
   ============================================================================ */

document.addEventListener("userChanged", function () {
  // Reset meals state and reload for new user
  AccueilState.caloriesConsumed = 0;
  AccueilState.todayMeals.forEach(m => {
    m.eaten = false;
    m.actualKcal = null;
  });

  // Load the new user's meals state
  loadMealsState();

  // Update UI
  renderGreeting();
  renderMeals();
  updateProgressDisplay();
});

// Check for midnight rollover every minute
setInterval(checkDateChange, 60 * 1000);

// Boot
document.addEventListener("DOMContentLoaded", initAccueil);
