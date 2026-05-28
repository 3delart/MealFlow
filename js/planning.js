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

/**
 * Render 7×2 meal plan grid (7 days × 2 meals: Midi/Soir)
 * Shows recipe names or "+" for empty cells
 */
function renderMealPlan() {
  const container = document.getElementById("meal-plan");
  if (!container) return;

  // Display loading if meal plan is empty
  if (mealPlan.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #999;">
        <p>📋 Chargement...</p>
      </div>
    `;
    return;
  }

  // Build header row with MIDI/SOIR columns
  let html = `
    <div class="meal-plan-header">
      <div class="meal-header-day"></div>
      <div class="meal-header-cell">🌅 MIDI</div>
      <div class="meal-header-cell">🌙 SOIR</div>
    </div>
  `;

  // Create 7 rows (one per day)
  rollingWindow.forEach((day, index) => {
    const dayMeal = mealPlan.find(m => m.dateISO === day.dateISO);
    const midiRecipe = dayMeal ? (dayMeal.Midi || "") : "";
    const soirRecipe = dayMeal ? (dayMeal.Soir || "") : "";

    html += `
      <div class="meal-plan-row">
        <div class="meal-day-label">${day.dayOfWeek}<br>${day.dateStr}</div>
        <div class="meal-cell ${midiRecipe ? "recipe-name" : "meal-empty"}" onclick="openRecipePickerModal('${day.dateISO}', 'Midi')">
          ${midiRecipe || "+"}
        </div>
        <div class="meal-cell ${soirRecipe ? "recipe-name" : "meal-empty"}" onclick="openRecipePickerModal('${day.dateISO}', 'Soir')">
          ${soirRecipe || "+"}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

/**
 * Open recipe picker modal for a specific day and meal time
 * @param {string} dateISO - Date in ISO format (YYYY-MM-DD)
 * @param {string} mealTime - Meal time (Midi or Soir)
 */
function openRecipePickerModal(dateISO, mealTime) {
  // TODO: Implement recipe picker modal
  console.log(`Opening recipe picker for ${dateISO} ${mealTime}`);
  alert(`Recipe picker for ${dateISO} ${mealTime} - Coming soon`);
}

async function initializePlanning() {
  UserContext.applyUserStyling();
  UserContext.initializeUserToggle();
  await loadMealPlan();
}

document.addEventListener("DOMContentLoaded", initializePlanning);
