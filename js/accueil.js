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
    if (profile && (profile.Objectif || profile.objectifKcal)) {
      const kcal = Number(profile.Objectif || profile.objectifKcal) || 0;
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
    const target = profile && (profile.Objectif || profile.objectifKcal) ? Number(profile.Objectif || profile.objectifKcal) : null;
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

      return `
        <div class="meal-card ${eatenClass}" data-meal-type="${meal.mealType}">
          <div class="meal-info">
            <div style="display: flex; align-items: center;">
              <span class="meal-time-icon">${meal.emoji}</span>
              <div>
                <p class="meal-name">${meal.name}</p>
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
  const target = profile && (profile.Objectif || profile.objectifKcal) ? Number(profile.Objectif || profile.objectifKcal) : 0;
  const pct = target > 0 ? (AccueilState.caloriesConsumed / target) * 100 : 0;
  console.log(`updateProgressDisplay: user=${user}, target=${target}, consumed=${AccueilState.caloriesConsumed}, pct=${pct}%`);
  renderProgressCircle(pct);
}

/**
 * Saves meals state (eaten status) to localStorage.
 */
function saveMealsState() {
  try {
    const today = getTodayISO();
    const stateToSave = AccueilState.todayMeals.map(m => ({
      mealType: m.mealType,
      eaten: m.eaten,
      actualKcal: m.actualKcal,
    }));
    localStorage.setItem(`mealflow:meals:${today}`, JSON.stringify(stateToSave));
    localStorage.setItem(`mealflow:consumed:${today}`, String(AccueilState.caloriesConsumed));
  } catch (err) {
    console.warn("Could not save meals state to localStorage:", err);
  }
}

/**
 * Loads meals state (eaten status) from localStorage.
 */
function loadMealsState() {
  const today = getTodayISO();
  const savedState = localStorage.getItem(`mealflow:meals:${today}`);
  const savedConsumed = localStorage.getItem(`mealflow:consumed:${today}`);

  if (savedState) {
    try {
      const stateArray = JSON.parse(savedState);
      stateArray.forEach(saved => {
        const meal = AccueilState.todayMeals.find(m => m.mealType === saved.mealType);
        if (meal) {
          meal.eaten = saved.eaten;
          meal.actualKcal = saved.actualKcal || meal.estimatedKcal;
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
      }
    });
  } catch (err) {
    console.warn("Accueil: Could not load Profils tab:", err.message);
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
}

/**
 * Opens the scanner modal.
 */
function openGrignottageModal() {
  const modal = document.getElementById("scanner-modal");
  if (!modal) return;

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  startScanner();
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
 * Called when a barcode is detected. Fetches nutrition data from Open Food Facts.
 */
async function onBarcodeDetected(barcode) {
  console.log(`Barcode detected: ${barcode}`);

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
    // Fetch from Open Food Facts API
    const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const data = await response.json();
    console.log("Open Food Facts API full response:", data);

    if (data.product) {
      const product = data.product;
      console.log("Product object keys:", Object.keys(product));
      console.log("Nutriments:", product.nutriments);

      const name = product.product_name || product.generic_name || barcode;
      const kcal = product.nutriments?.["energy-kcal"] || product.nutriments?.["energy-kcal_100g"] || 0;
      const brand = product.brands || "—";
      const quantity = product.quantity || "—";
      const categories = product.categories || "—";

      console.log(`Parsed: name="${name}", kcal=${kcal}, brands="${brand}", quantity="${quantity}", categories="${categories}"`);

      nameEl.textContent = name;

      // Display brand
      const brandEl = document.getElementById("result-brand");
      if (brandEl) brandEl.textContent = `Marque: ${brand}`;

      // Display quantity
      const qtyEl = document.getElementById("result-quantity");
      if (qtyEl) qtyEl.textContent = `Quantité: ${quantity}`;

      // Display category/packaging
      const catEl = document.getElementById("result-category");
      if (catEl) catEl.textContent = `Type: ${categories}`;

      kcalEl.value = Math.round(kcal);
      kcalEl.focus();
    } else {
      console.log("No product found in API response");
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
 * Adds the scanned/entered calories to today's consumption.
 */
function addGrignottage() {
  const nameEl = document.getElementById("result-name");
  const kcalEl = document.getElementById("result-kcal");

  const name = nameEl.textContent || "Snack";
  const kcal = Number(kcalEl.value) || 0;

  if (kcal < 1 || kcal > 10000) {
    alert("Entrer une valeur entre 1 et 10000 kcal");
    return;
  }

  // Add to consumed calories
  AccueilState.caloriesConsumed += kcal;
  AccueilState.grignottageCalories += kcal;

  // Save state
  saveMealsState();

  // Update UI
  updateProgressDisplay();

  // Notify user
  alert(`Ajouté: ${name} (+${kcal} kcal)`);

  // Close modal
  closeGrignottageModal();
}

/* ============================================================================
   EVENT LISTENERS
   ============================================================================ */

document.addEventListener("userChanged", function () {
  renderGreeting();
  updateProgressDisplay();
  // Meals stay the same (they're per-day, not per-user)
});

// Check for midnight rollover every minute
setInterval(checkDateChange, 60 * 1000);

// Boot
document.addEventListener("DOMContentLoaded", initAccueil);
