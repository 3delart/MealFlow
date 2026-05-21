/**
 * MealFlow — Planning Page Logic
 * Renders a weekly meal grid (5 meal types × 7 days), loaded from Google Sheets.
 * Supports week navigation (prev / next) and color-codes cells by user.
 */

/* ============================================================================
   CONSTANTS
   ============================================================================ */

/** Ordered list of meal types (row headers). */
const MEAL_TYPES = [
  "Petit-déj",
  "Collation matin",
  "Déjeuner",
  "Collation après-midi",
  "Diner"
];

/**
 * Demo/fallback data used when Sheets API is unavailable.
 * Format: { "YYYY-MM-DD": { "Meal type": { florian: "...", naomi: "..." } } }
 */
const DEMO_PLANNING_DATA = (function () {
  // Build a week of demo data anchored to today's Monday
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sun
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday);

  const demoMeals = {
    "Petit-déj": { florian: "Granola + yaourt", naomi: "Granola + yaourt" },
    "Collation matin": { florian: "—", naomi: "Pomme" },
    "Déjeuner": { florian: "Wrap poulet", naomi: "Salade caesar" },
    "Collation après-midi": { florian: "Noix", naomi: "—" },
    "Diner": { florian: "Pâtes bolognaise", naomi: "Pâtes bolognaise" },
  };

  const data = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = d.toISOString().split("T")[0];
    // Vary meals slightly by day of week for realism
    if (i === 2 /* Wed */ || i === 5 /* Sat */) {
      data[iso] = {
        "Petit-déj": { florian: "Oeufs brouillés", naomi: "Toast avocat" },
        "Collation matin": { florian: "—", naomi: "—" },
        "Déjeuner": { florian: "Steak + légumes", naomi: "Steak + légumes" },
        "Collation après-midi": { florian: "Yaourt", naomi: "Fruit" },
        "Diner": { florian: "Soupe légumes", naomi: "Soupe légumes" },
      };
    } else {
      data[iso] = demoMeals;
    }
  }
  return data;
}());

/* ============================================================================
   STATE
   ============================================================================ */

const PlanningState = {
  /** ISO date string for the Monday of the currently displayed week. */
  weekStart: null,

  /**
   * Raw planning data indexed by ISO date and meal type.
   * Structure: { "YYYY-MM-DD": { "Meal type": { florian: string, naomi: string } } }
   */
  planningData: {},

  /** True once Sheets data has been loaded (or fallback applied). */
  dataLoaded: false,
};

/* ============================================================================
   WEEK HELPERS
   ============================================================================ */

/**
 * Find the ISO string for the Monday of the week containing dateISO.
 * @param {string} dateISO - Any ISO date (YYYY-MM-DD)
 * @returns {string} ISO date for that week's Monday
 */
function getMondayISO(dateISO) {
  const d = Utils.parseISO(dateISO);
  const day = d.getDay(); // 0 = Sun, 1 = Mon, …
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return d.toISOString().split("T")[0];
}

/**
 * Set the currently displayed week.
 * @param {string} dateISO - Any date within the desired week
 */
function setCurrentWeek(dateISO) {
  PlanningState.weekStart = getMondayISO(dateISO);
}

/**
 * Return an array of 7 ISO date strings: Monday through Sunday of the current week.
 * @returns {string[]}
 */
function getWeekDates() {
  const monday = Utils.parseISO(PlanningState.weekStart);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

/* ============================================================================
   DATA ACCESS
   ============================================================================ */

/**
 * Get the meal value(s) for a specific date and meal type.
 * Returns an object { florian, naomi } with meal name strings (or "—").
 * @param {string} dateISO - ISO date string (YYYY-MM-DD)
 * @param {string} mealType - One of MEAL_TYPES
 * @returns {{ florian: string, naomi: string }}
 */
function getDataForCell(dateISO, mealType) {
  const day = PlanningState.planningData[dateISO];
  if (!day) return { florian: "—", naomi: "—" };
  const cell = day[mealType];
  if (!cell) return { florian: "—", naomi: "—" };
  return {
    florian: cell.florian || "—",
    naomi: cell.naomi || "—",
  };
}

/* ============================================================================
   DATA LOADING
   ============================================================================ */

/**
 * Fetch the "Planning" tab from Google Sheets and parse into PlanningState.planningData.
 * Expected sheet format (one row per user per date per meal):
 *   Date | Jour | Repas | Florian | Naomi
 *   2026-05-18 | Lun | Petit-déj | Granola | Granola
 *
 * Falls back to DEMO_PLANNING_DATA on any error.
 */
async function loadPlanningData() {
  if (!window.SheetsAPI) {
    console.warn("Planning: SheetsAPI not available — using demo data");
    PlanningState.planningData = DEMO_PLANNING_DATA;
    PlanningState.dataLoaded = true;
    return;
  }

  try {
    const rows = await window.SheetsAPI.readSheetTab("Planning");
    const objects = window.SheetsAPI.rowsToObjects(rows);

    if (!objects || objects.length === 0) {
      throw new Error("Planning tab is empty");
    }

    /** @type {Object} */
    const parsed = {};

    objects.forEach(row => {
      // Support multiple column name capitalizations from the sheet
      const date = (row["Date"] || row["date"] || "").trim();
      const mealType = (row["Repas"] || row["repas"] || "").trim();
      const florianMeal = (row["Florian"] || row["florian"] || "").trim() || "—";
      const naomiMeal = (row["Naomi"] || row["naomi"] || "").trim() || "—";

      if (!date || !mealType) return;

      if (!parsed[date]) parsed[date] = {};
      parsed[date][mealType] = { florian: florianMeal, naomi: naomiMeal };
    });

    PlanningState.planningData = parsed;
    PlanningState.dataLoaded = true;
    console.info("Planning: loaded", Object.keys(parsed).length, "days from Sheets");
  } catch (err) {
    console.warn("Planning: Could not load Sheets data, using demo data:", err.message);
    PlanningState.planningData = DEMO_PLANNING_DATA;
    PlanningState.dataLoaded = true;
  }
}

/* ============================================================================
   RENDERING
   ============================================================================ */

/**
 * Update the week-label element to show the date range of the current week.
 * Example: "Lun 18 mai — Dim 24 mai"
 */
function renderWeekLabel() {
  const labelEl = document.getElementById("week-label");
  if (!labelEl) return;

  const dates = getWeekDates();
  const firstDate = dates[0]; // Monday
  const lastDate = dates[6];  // Sunday

  const firstFormatted = Utils.formatDate(firstDate); // "Lun 18 mai"
  const lastFormatted = Utils.formatDate(lastDate);   // "Dim 24 mai"

  labelEl.textContent = `${firstFormatted} — ${lastFormatted}`;
}

/**
 * Determine the CSS class to apply to a meal cell based on the meal values.
 * @param {string} florianMeal
 * @param {string} naomiMeal
 * @returns {string} CSS class name
 */
function getCellClass(florianMeal, naomiMeal) {
  const fEmpty = !florianMeal || florianMeal === "—";
  const nEmpty = !naomiMeal || naomiMeal === "—";

  if (fEmpty && nEmpty) return "cell-empty";
  if (!fEmpty && !nEmpty) return "cell-both";
  if (!fEmpty) return "cell-florian";
  return "cell-naomi";
}

/**
 * Return a user-facing label for the meal cell.
 * - Both filled and identical → show the meal name once
 * - Both filled and different → show "Florian: X / Naomi: Y"
 * - One filled → show the meal name
 * - Empty → "—"
 * @param {string} florianMeal
 * @param {string} naomiMeal
 * @returns {string}
 */
function getCellLabel(florianMeal, naomiMeal) {
  const fEmpty = !florianMeal || florianMeal === "—";
  const nEmpty = !naomiMeal || naomiMeal === "—";

  if (fEmpty && nEmpty) return "—";
  if (!fEmpty && !nEmpty) {
    if (florianMeal === naomiMeal) return florianMeal;
    return `${florianMeal} / ${naomiMeal}`;
  }
  if (!fEmpty) return florianMeal;
  return naomiMeal;
}

/**
 * Build and render the complete weekly planning table into #planning-grid-container.
 */
function renderPlanningGrid() {
  const container = document.getElementById("planning-grid-container");
  if (!container) return;

  const dates = getWeekDates();
  const todayISO = Utils.getTodayISO();

  // Build legend
  const legendHTML = `
    <div class="planning-legend">
      <div class="legend-item"><span class="legend-dot florian"></span> Florian</div>
      <div class="legend-item"><span class="legend-dot naomi"></span> Naomi</div>
      <div class="legend-item"><span class="legend-dot both"></span> Les deux</div>
      <div class="legend-item"><span class="legend-dot empty"></span> Vide</div>
    </div>`;

  // Build table header
  let headerCells = '<th>Repas</th>';
  dates.forEach(dateISO => {
    const dayAbbr = Utils.getDayName(dateISO);  // "Lun", "Mar", …
    const dayNum = Utils.parseISO(dateISO).getDate();
    const isToday = dateISO === todayISO;
    const todayClass = isToday ? ' class="today-col"' : '';
    headerCells += `
      <th${todayClass}>
        <div class="day-header">
          <span class="day-name">${dayAbbr}</span>
          <span class="day-date">${dayNum}</span>
        </div>
      </th>`;
  });

  // Build table body rows
  let bodyRows = "";
  MEAL_TYPES.forEach(mealType => {
    let rowCells = `<td class="meal-type-label">${mealType}</td>`;

    dates.forEach(dateISO => {
      const isToday = dateISO === todayISO;
      const { florian: florianMeal, naomi: naomiMeal } = getDataForCell(dateISO, mealType);
      const cellClass = getCellClass(florianMeal, naomiMeal);
      const label = getCellLabel(florianMeal, naomiMeal);
      const todayAttr = isToday ? ' today-col' : '';

      rowCells += `
        <td class="${todayAttr.trim()}">
          <div class="meal-cell ${cellClass}">${label}</div>
        </td>`;
    });

    bodyRows += `<tr>${rowCells}</tr>`;
  });

  // Assemble and inject
  container.innerHTML = legendHTML + `
    <table class="planning-table" role="grid" aria-label="Planning repas de la semaine">
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>`;
}

/* ============================================================================
   WEEK NAVIGATION
   ============================================================================ */

/**
 * Navigate to the previous week and re-render.
 */
function previousWeek() {
  const monday = Utils.parseISO(PlanningState.weekStart);
  monday.setDate(monday.getDate() - 7);
  PlanningState.weekStart = monday.toISOString().split("T")[0];
  renderWeekLabel();
  renderPlanningGrid();
}

/**
 * Navigate to the next week and re-render.
 */
function nextWeek() {
  const monday = Utils.parseISO(PlanningState.weekStart);
  monday.setDate(monday.getDate() + 7);
  PlanningState.weekStart = monday.toISOString().split("T")[0];
  renderWeekLabel();
  renderPlanningGrid();
}

/* ============================================================================
   INITIALIZATION
   ============================================================================ */

/**
 * Main entry point: loads data, sets the current week, and renders the grid.
 */
async function initializePlanning() {
  // Apply user-specific styling and toggle button
  if (window.UserContext) {
    window.UserContext.applyUserStyling();
    window.UserContext.initializeUserToggle();
  }

  // Show week label immediately with current week
  setCurrentWeek(Utils.getTodayISO());
  renderWeekLabel();

  // Show loading placeholder
  const container = document.getElementById("planning-grid-container");
  if (container) {
    container.innerHTML = '<p class="planning-loading">Chargement du planning...</p>';
  }

  // Load data from Sheets (or fallback to demo)
  await loadPlanningData();

  // Render the grid with real data
  renderPlanningGrid();

  // Wire up navigation buttons
  const prevBtn = document.getElementById("prev-week-btn");
  const nextBtn = document.getElementById("next-week-btn");

  if (prevBtn) prevBtn.addEventListener("click", previousWeek);
  if (nextBtn) nextBtn.addEventListener("click", nextWeek);
}

/* ============================================================================
   EVENT LISTENERS
   ============================================================================ */

// Re-render grid when the active user changes (color-coding may differ)
document.addEventListener("userChanged", function () {
  if (PlanningState.dataLoaded) {
    renderPlanningGrid();
  }
});

// Boot on DOM ready
document.addEventListener("DOMContentLoaded", initializePlanning);
