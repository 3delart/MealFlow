let mealPlan = [];

async function loadMealPlan() {
  try {
    const rows = await SheetsAPI.readSheetTab("Planning");
    const objects = SheetsAPI.rowsToObjects(rows);

    if (objects.length > 0) {
      mealPlan = objects;
      console.log(`Planning: loaded ${mealPlan.length} days from Sheets`);
    } else {
      console.log("Planning: empty, using fallback");
      mealPlan = [];
    }
  } catch (error) {
    console.error("Error reading planning:", error);
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
