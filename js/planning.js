// Module variables
let mealPlan = [];
let rollingWindow = [];
let currentModalContext = { dateISO: null, mealTime: null };

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
 * TASK 4 & 8: Open recipe picker modal for a specific day and meal time
 * Populates modal with available recipes from window.recipesData
 * Includes search/filter functionality
 * @param {string} dateISO - Date in ISO format (YYYY-MM-DD)
 * @param {string} mealTime - Meal time (Midi or Soir)
 */
function openRecipePickerModal(dateISO, mealTime) {
  // Store context for selectRecipe()
  currentModalContext = { dateISO, mealTime };

  // Update modal title
  const day = rollingWindow.find(d => d.dateISO === dateISO);
  const dayLabel = day ? `${day.dayOfWeek} ${day.dateStr}` : dateISO;
  document.getElementById("modal-title").textContent = `${mealTime} - ${dayLabel}`;

  // Populate recipe options
  const recipeOptionsContainer = document.getElementById("recipe-options");
  if (!window.recipesData || Object.keys(window.recipesData).length === 0) {
    recipeOptionsContainer.innerHTML = '<p style="text-align: center; color: var(--color-text-secondary);">Aucune recette disponible</p>';
  } else {
    renderRecipeOptions(Object.values(window.recipesData));
  }

  // Clear search input and show modal
  const searchInput = document.getElementById("recipe-search-input");
  searchInput.value = "";

  // TASK 8: Setup search/filter listener
  searchInput.addEventListener("input", filterRecipes);

  document.getElementById("recipe-picker-modal").style.display = "flex";
}

/**
 * TASK 8: Filter recipes by name as user types
 * Called on search input change
 */
function filterRecipes(event) {
  const query = event.target.value.toLowerCase().trim();

  if (!window.recipesData) return;

  // Filter recipes by name match
  const allRecipes = Object.values(window.recipesData);
  const filtered = allRecipes.filter(recipe =>
    recipe.name.toLowerCase().includes(query)
  );

  // Re-render with filtered results
  renderRecipeOptions(filtered);
}

/**
 * TASK 4: Close recipe picker modal
 */
function closeRecipePickerModal() {
  document.getElementById("recipe-picker-modal").style.display = "none";
  currentModalContext = { dateISO: null, mealTime: null };
}

/**
 * TASK 4: Render recipe options in the modal
 * @param {Object[]} recipes - Array of recipe objects to display
 */
function renderRecipeOptions(recipes) {
  const container = document.getElementById("recipe-options");

  if (recipes.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--color-text-secondary);">Aucune recette trouvée</p>';
    return;
  }

  container.innerHTML = recipes.map(recipe => `
    <div class="recipe-option" onclick="selectRecipe('${escapeHTML(recipe.name)}')">
      <div class="recipe-option-name">${escapeHTML(recipe.name)}</div>
      <div class="recipe-option-description">${escapeHTML(recipe.description || "")}</div>
    </div>
  `).join("");
}

/**
 * Helper function to escape HTML special characters
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHTML(str) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return str.replace(/[&<>"']/g, m => map[m]);
}

/**
 * TASK 5: Save selected recipe to meal plan
 * Updates mealPlan local state, closes modal, re-renders grid
 * Calls syncCoursesFromMealPlan() and savePlanningToSheets()
 * @param {string} recipeName - Name of the selected recipe
 */
function selectRecipe(recipeName) {
  const { dateISO, mealTime } = currentModalContext;

  if (!dateISO || !mealTime) {
    console.error("Invalid modal context");
    return;
  }

  // Find or create meal plan entry for this date
  let dayMeal = mealPlan.find(m => m.dateISO === dateISO);
  if (!dayMeal) {
    dayMeal = {
      dateISO: dateISO,
      Midi: "",
      Soir: ""
    };
    mealPlan.push(dayMeal);
  }

  // Update the meal
  dayMeal[mealTime] = recipeName;

  console.log(`Selected recipe: ${recipeName} for ${dateISO} ${mealTime}`);

  // Close modal and re-render
  closeRecipePickerModal();
  renderMealPlan();

  // Sync Courses list and persist to Sheets
  syncCoursesFromMealPlan();
  savePlanningToSheets();
}

/**
 * TASK 6: Sync Courses list from 7-day meal plan
 * Aggregates ingredients from all selected recipes
 * TODO: Update Courses tab when available
 */
function syncCoursesFromMealPlan() {
  const allIngredients = {};

  // Iterate through each day's meals
  mealPlan.forEach(dayMeal => {
    [dayMeal.Midi, dayMeal.Soir].forEach(recipeName => {
      if (!recipeName) return;

      // Find recipe in window.recipesData
      const recipe = Object.values(window.recipesData || {}).find(r => r.name === recipeName);
      if (!recipe || !recipe.ingredients) return;

      // Aggregate ingredients
      recipe.ingredients.forEach(ing => {
        const key = ing.name;
        if (!allIngredients[key]) {
          allIngredients[key] = {
            name: ing.name,
            totalQuantity: 0,
            unit: ing.unit || "g",
            calories_per_100: ing.calories_per_100 || 0
          };
        }
        allIngredients[key].totalQuantity += parseFloat(ing.quantity) || 0;
      });
    });
  });

  // Log aggregated ingredients (TODO: sync to Courses sheet/tab)
  console.log("Synced Courses list from meal plan:", Object.values(allIngredients));

  // Store in window for access by Courses page
  window.syncedCourses = Object.values(allIngredients);
}

/**
 * TASK 7: Persist meal plan changes to Planning sheet
 * Clears Planning tab and appends all 7 days' meals
 */
async function savePlanningToSheets() {
  if (!window.SheetsAPI) {
    console.warn("SheetsAPI not available, skipping Planning sync");
    return;
  }

  try {
    const token = window.getAccessToken ? window.getAccessToken() : null;
    if (!token) {
      console.warn("No OAuth token, skipping Planning sync");
      return;
    }

    // Clear existing Planning sheet data (keep header)
    await window.SheetsAPI.clearSheetRange("Planning!A2:C1000", token);

    // Append each day's meals
    for (const dayMeal of mealPlan) {
      const row = [
        dayMeal.dateISO,
        dayMeal.Midi || "",
        dayMeal.Soir || ""
      ];
      await window.SheetsAPI.appendRowWithToken("Planning", row, token);
    }

    console.log("Planning synced to Planning sheet");
  } catch (err) {
    console.error("Failed to sync planning to Sheets:", err);
  }
}

async function initializePlanning() {
  UserContext.applyUserStyling();
  UserContext.initializeUserToggle();
  await loadMealPlan();
  syncCoursesFromMealPlan();

  // Setup beforeunload to persist before leaving page
  window.addEventListener("beforeunload", savePlanningToSheets);
}

document.addEventListener("DOMContentLoaded", initializePlanning);
