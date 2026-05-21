/**
 * MealFlow — Accueil (Landing Page) Logic
 * Renders greeting, progress circle, today's objectives, and search.
 * Reads Profils + Planning tabs from Google Sheets.
 */

/* ============================================================================
   STATE
   ============================================================================ */

/** @type {{ florian: Object|null, naomi: Object|null }} */
const AccueilState = {
  profiles: { florian: null, naomi: null },
  todayMeals: [],         // Array of meal names planned for today
  caloriesConsumed: 0,    // Will be populated from Courses tab (future)
  lastDateChecked: null,  // ISO date string to detect midnight rollover
};

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
    if (profile && profile.objectifKcal) {
      const kcal = Number(profile.objectifKcal) || 0;
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
    const target = profile && profile.objectifKcal ? Number(profile.objectifKcal) : null;
    const consumed = AccueilState.caloriesConsumed;

    if (target) {
      circleCaption.textContent = `${consumed.toLocaleString("fr-FR")} / ${target.toLocaleString("fr-FR")} kcal`;
    } else {
      circleCaption.textContent = `${consumed.toLocaleString("fr-FR")} kcal consommées`;
    }
  }
}

/**
 * Renders the "TODAY'S OBJECTIVES" section.
 * Shows a card per user with calorie goal, consumed, and progress bar.
 * Also shows meals planned today if available.
 */
function renderObjectives() {
  const container = document.getElementById("objectives-content");
  if (!container) return;

  // Clear previous content
  container.innerHTML = "";

  const users = ["florian", "naomi"];

  // Check if any profile data available
  const hasAnyData = users.some(u => AccueilState.profiles[u] !== null);

  if (!hasAnyData) {
    container.innerHTML = `
      <p class="loading-text">
        Données non disponibles — configurez votre Google Sheet dans js/sheets-api.js
      </p>`;
    return;
  }

  users.forEach(user => {
    const profile = AccueilState.profiles[user];
    const displayName = user.charAt(0).toUpperCase() + user.slice(1);
    const target = profile && profile.objectifKcal ? Number(profile.objectifKcal) : 0;

    // For now, consumed is global (future: per-user tracking)
    const currentUser = window.UserContext ? window.UserContext.getCurrentUser() : "florian";
    const consumed = user === currentUser ? AccueilState.caloriesConsumed : 0;

    const pct = target > 0 ? Math.min(Math.round((consumed / target) * 100), 100) : 0;
    const barWidth = Math.min(pct, 100);

    const card = document.createElement("div");
    card.className = `objective-card ${user}`;

    // Header: name + badge
    const headerHtml = `
      <div class="objective-card-header">
        <span class="objective-user-name">${displayName}</span>
        <span class="objective-badge">${pct}%</span>
      </div>`;

    // Calories consumed / target
    const calorieHtml = `
      <p class="objective-calories">
        <strong>${consumed.toLocaleString("fr-FR")}</strong> / ${target > 0 ? target.toLocaleString("fr-FR") : "—"} kcal
      </p>`;

    // Progress bar
    const barHtml = `
      <div class="objective-progress-bar-wrap">
        <div class="objective-progress-bar" style="width: ${barWidth}%"></div>
      </div>`;

    // Meals today (only for current user)
    let mealsHtml = "";
    if (user === currentUser && AccueilState.todayMeals.length > 0) {
      const chipsHtml = AccueilState.todayMeals
        .map(m => `<li class="meal-chip">${m}</li>`)
        .join("");
      mealsHtml = `
        <div class="today-meals">
          <h4>Repas prévus aujourd'hui</h4>
          <ul class="meal-chip-list">${chipsHtml}</ul>
        </div>`;
    } else if (user === currentUser) {
      mealsHtml = `
        <div class="today-meals">
          <h4>Repas prévus aujourd'hui</h4>
          <p class="no-meals-text">Aucun repas planifié pour aujourd'hui.</p>
        </div>`;
    }

    card.innerHTML = headerHtml + calorieHtml + barHtml + mealsHtml;
    container.appendChild(card);
  });
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

    // Expected columns: nom, objectifKcal, poids, taille, age, sexe, activite, etc.
    objects.forEach(profile => {
      const key = (profile.nom || "").toLowerCase().trim();
      if (key === "florian" || key === "naomi") {
        AccueilState.profiles[key] = profile;
      }
    });
  } catch (err) {
    console.warn("Accueil: Could not load Profils tab:", err.message);
    // Leave profiles as null — UI will show placeholder
  }
}

/**
 * Loads the Planning tab and finds meals scheduled for today.
 * Populates AccueilState.todayMeals.
 */
async function loadPlanningData() {
  if (!window.SheetsAPI) return;

  try {
    const rows = await window.SheetsAPI.readSheetTab("Planning");
    const objects = window.SheetsAPI.rowsToObjects(rows);
    const todayISO = getTodayISO();

    // Expected columns: date (YYYY-MM-DD), repas, recette, ...
    AccueilState.todayMeals = objects
      .filter(row => (row.date || "").trim() === todayISO)
      .map(row => row.recette || row.repas || "")
      .filter(Boolean);
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

/**
 * Initializes the recipe search input.
 * Searches within today's meals and profile data as a basic MVP.
 * Full search against Sheets planned for a future task.
 */
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

    // Search within today's meals as a basic demo
    const matches = AccueilState.todayMeals.filter(m =>
      m.toLowerCase().includes(query)
    );

    if (matches.length === 0) {
      results.innerHTML = `<div class="search-result-item">Aucun résultat pour "${query}"</div>`;
    } else {
      results.innerHTML = matches
        .map(m => `<div class="search-result-item">${m}</div>`)
        .join("");
    }

    results.classList.remove("hidden");
  });

  // Hide results when clicking elsewhere
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
 * Main initialization function.
 * Loads data, renders all sections, and sets up event listeners.
 */
async function initAccueil() {
  AccueilState.lastDateChecked = getTodayISO();

  // Apply user-specific styling
  if (window.UserContext) {
    window.UserContext.applyUserStyling();
    window.UserContext.initializeUserToggle();
  }

  // Render greeting immediately with whatever state we have
  renderGreeting();

  // Show 0% circle while data loads
  renderProgressCircle(0);

  // Render placeholder objectives
  renderObjectives();

  // Load data in parallel
  await Promise.all([
    loadProfilsData(),
    loadPlanningData(),
    updateProgressFromSheets(),
  ]);

  // Re-render with real data
  renderGreeting();

  const user = window.UserContext ? window.UserContext.getCurrentUser() : "florian";
  const profile = AccueilState.profiles[user];
  const target = profile && profile.objectifKcal ? Number(profile.objectifKcal) : 0;
  const pct = target > 0 ? (AccueilState.caloriesConsumed / target) * 100 : 0;

  renderProgressCircle(pct);
  renderObjectives();

  // Initialize search after data is loaded
  initializeSearch();
}

/* ============================================================================
   EVENT LISTENERS
   ============================================================================ */

// Re-render when user is switched (without full page reload for smoother UX)
document.addEventListener("userChanged", function () {
  const user = window.UserContext ? window.UserContext.getCurrentUser() : "florian";
  const profile = AccueilState.profiles[user];
  const target = profile && profile.objectifKcal ? Number(profile.objectifKcal) : 0;
  const pct = target > 0 ? (AccueilState.caloriesConsumed / target) * 100 : 0;

  renderGreeting();
  renderProgressCircle(pct);
  renderObjectives();
});

// Check for midnight rollover every minute
setInterval(checkDateChange, 60 * 1000);

// Boot
document.addEventListener("DOMContentLoaded", initAccueil);
