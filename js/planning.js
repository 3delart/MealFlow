// Module variables
let mealPlan = [];
let rollingWindow = [];

/**
 * Calculate rolling window of 7 days (today through today+6)
 * Each day includes: date (Date object), dateStr (formatted), dayOfWeek (French), dateISO
 * @returns {Array} Array of 7 day objects
 */
function calculateRollingWindow() {
  const today = new Date();
  const days = [];
  const frenchDays = ['DIMANCHE', 'LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI'];

  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);

    const dateISO = Utils.getTodayISO().split('-').reduce((acc, val, idx) => {
      if (idx === 0) return val;
      return acc;
    }) + '-' +
    String(date.getMonth() + 1).padStart(2, '0') + '-' +
    String(date.getDate()).padStart(2, '0');

    // Recalculate proper ISO for this date
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const properlISO = `${year}-${month}-${day}`;

    days.push({
      date: date,
      dateStr: Utils.formatDate(properlISO),
      dayOfWeek: frenchDays[date.getDay()],
      dateISO: properlISO
    });
  }

  return days;
}

/**
 * Load meal plan from Planning sheet
 * Filters to 7-day rolling window and populates Midi/Soir for each day
 */
async function loadMealPlan() {
  try {
    // Calculate rolling window
    rollingWindow = calculateRollingWindow();

    // Load Planning tab from Sheets
    const rows = await SheetsAPI.readSheetTab("Planning");
    const objects = SheetsAPI.rowsToObjects(rows);

    if (objects.length > 0) {
      // Filter rows to 7-day window by dateISO
      const windowDates = rollingWindow.map(d => d.dateISO);
      mealPlan = objects.filter(row => windowDates.includes(row.dateISO));
      console.log(`Planning: loaded ${mealPlan.length} days from Sheets`);
    } else {
      console.log("Planning: empty, using fallback");
      mealPlan = [];
    }
  } catch (error) {
    console.error("Error reading planning:", error);
    // Offline fallback
    mealPlan = [];
  }

  renderMealPlan();
}

function renderMealPlan() {
  const container = document.getElementById("meal-plan");
  if (!container) return;

  if (mealPlan.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #999;">
        <p>📋 Pas de planning. Clique "Régénérer semaine"</p>
      </div>
    `;
    return;
  }

  container.innerHTML = mealPlan
    .map(
      (day) => `
    <div class="meal-day">
      <h3>${day.Jour} - ${day.Date}</h3>
      <div class="meals-grid">
        <div class="meal"><strong>🌅</strong> ${day["Petit-déj"] || "-"}</div>
        <div class="meal"><strong>🥤</strong> ${day["Collation_matin"] || "-"}</div>
        <div class="meal"><strong>🍽️</strong> ${day["Déjeuner"] || "-"}</div>
        <div class="meal"><strong>🥪</strong> ${day["Collation_après-midi"] || "-"}</div>
        <div class="meal"><strong>🌙</strong> ${day["Diner"] || "-"}</div>
      </div>
    </div>
  `
    )
    .join("");
}

async function initializePlanning() {
  UserContext.applyUserStyling();
  UserContext.initializeUserToggle();
  await loadMealPlan();
}

document.addEventListener("DOMContentLoaded", initializePlanning);
