// Module variables
let mealPlan = [];
let rollingWindow = [];
let currentModalContext = { dateISO: null, mealTime: null };
let weekOffset = 0;
const MAX_WEEK_OFFSET = 4;
let allPlanData = {};

/**
 * Calculate rolling window of 7 days
 * Offset: 0 = current week, -1 = previous week, +1 = next week, etc.
 * @param {number} offset - Week offset (default: 0 for current week)
 * @returns {Array} Array of 7 day objects
 */
function calculateRollingWindow(offset = 0) {
  const days = [];
  const frenchDays = ['DIMANCHE', 'LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI'];

  for (let i = 0; i < 7; i++) {
    const daysFromToday = offset * 7 + i;
    const dateISO = Utils.getDateISO(daysFromToday);
    const date = new Date();
    date.setDate(date.getDate() + daysFromToday);

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
 * Populates allPlanData with all dates from sheet
 */
/**
 * Parse recipe value (single string or JSON array) into array of recipes
 */
function parseRecipeValue(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(r => r) : [value];
  } catch (e) {
    return value ? [value] : [];
  }
}

async function loadMealPlan() {
  try {
    // Load Planning tab from Sheets
    const rows = await SheetsAPI.readSheetTab("Planning");
    const objects = SheetsAPI.rowsToObjects(rows);

    // Populate allPlanData with all dates from sheet
    allPlanData = {};
    if (objects.length > 0) {
      objects.forEach(row => {
        if (row.Date) {
          allPlanData[row.Date] = {
            Midi: parseRecipeValue(row.Midi),
            Soir: parseRecipeValue(row.Soir)
          };
        }
      });
      console.log(`Planning: loaded ${Object.keys(allPlanData).length} dates from Sheets`);
    } else {
      console.log("Planning: empty sheet");
    }
  } catch (error) {
    console.error("Error reading planning:", error);
    allPlanData = {};
  }

  buildMealPlanForCurrentWindow();
  renderMealPlan();
}

/**
 * Build meal plan array from allPlanData for current week window
 * Uses weekOffset to determine which week to display
 */
function buildMealPlanForCurrentWindow() {
  rollingWindow = calculateRollingWindow(weekOffset);
  mealPlan = rollingWindow.map(day => ({
    ...day,
    Midi: allPlanData[day.dateISO]?.Midi || null,
    Soir: allPlanData[day.dateISO]?.Soir || null
  }));
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
    const midiArray = dayMeal?.Midi || [];
    const soirArray = dayMeal?.Soir || [];
    const midiRecipes = Array.isArray(midiArray) ? midiArray : (midiArray ? [midiArray] : []);
    const soirRecipes = Array.isArray(soirArray) ? soirArray : (soirArray ? [soirArray] : []);

    // Generate chips HTML for recipes
    const renderChips = (recipes, dateISO, mealTime) => {
      if (recipes.length === 0) return '+';
      return recipes.map(recipe => `
        <span class="recipe-chip" onclick="event.stopPropagation()">${recipe}
          <button class="chip-delete" onclick="removeRecipe('${dateISO}', '${mealTime}', '${recipe.replace(/'/g, "\\'")}')">×</button>
        </span>
      `).join('');
    };

    const midiDisplay = renderChips(midiRecipes, day.dateISO, 'Midi');
    const soirDisplay = renderChips(soirRecipes, day.dateISO, 'Soir');

    html += `
      <div class="meal-plan-row">
        <div class="meal-day-label">${day.dayOfWeek}<br>${day.dateStr}</div>
        <div class="meal-cell ${midiRecipes.length > 0 ? "recipe-name" : "meal-empty"}" onclick="openRecipePickerModal('${day.dateISO}', 'Midi')">
          ${midiDisplay}
        </div>
        <div class="meal-cell ${soirRecipes.length > 0 ? "recipe-name" : "meal-empty"}" onclick="openRecipePickerModal('${day.dateISO}', 'Soir')">
          ${soirDisplay}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

/**
 * Remove recipe from meal slot
 */
function removeRecipe(dateISO, mealTime, recipeName) {
  if (!allPlanData[dateISO]) return;
  const recipeArray = allPlanData[dateISO][mealTime];
  if (!Array.isArray(recipeArray)) return;
  allPlanData[dateISO][mealTime] = recipeArray.filter(r => r !== recipeName);
  buildMealPlanForCurrentWindow();
  renderMealPlan();
  syncCoursesFromMealPlan();
  savePlanningToSheets();
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
 * TASK 8: Search/Filter recipes by name as user types
 * Filters recipes from window.recipesData by name match
 * Called on search input 'input' event in openRecipePickerModal()
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
 * Updates allPlanData, rebuilds current window, re-renders grid
 * Calls syncCoursesFromMealPlan() and savePlanningToSheets()
 * @param {string} recipeName - Name of the selected recipe
 */
function selectRecipe(recipeName) {
  const { dateISO, mealTime } = currentModalContext;

  if (!dateISO || !mealTime) {
    console.error("Invalid modal context");
    return;
  }

  // Create or update entry in allPlanData
  if (!allPlanData[dateISO]) {
    allPlanData[dateISO] = { Midi: [], Soir: [] };
  }

  // Handle "None" replacement or append to array
  const recipeValue = allPlanData[dateISO][mealTime];

  // If slot is empty or contains "None", replace it
  if (!recipeValue || recipeValue === "None" || (Array.isArray(recipeValue) && recipeValue.length === 0)) {
    allPlanData[dateISO][mealTime] = [recipeName];
  } else {
    // Otherwise append to array (multi-recipe support)
    if (!Array.isArray(recipeValue)) {
      allPlanData[dateISO][mealTime] = recipeValue ? [recipeValue] : [];
    }
    if (!allPlanData[dateISO][mealTime].includes(recipeName)) {
      allPlanData[dateISO][mealTime].push(recipeName);
    }
  }

  console.log(`Selected recipe: ${recipeName} for ${dateISO} ${mealTime}`);

  // Close modal and rebuild meal plan from allPlanData
  closeRecipePickerModal();
  buildMealPlanForCurrentWindow();
  renderMealPlan();

  // Sync Courses list and persist to Sheets
  syncCoursesFromMealPlan();
  savePlanningToSheets();
}

/**
 * Build courses rows from meal plan + inventory (with deduction)
 * Returns array of rows for Courses!A2:G sheet
 */
function buildCoursesRows(mealPlanArg, inventoryObjects) {
  const map = {};

  // 1. Aggregate ingredients from recipes
  mealPlanArg.forEach(day => {
    ['Midi', 'Soir'].forEach(slot => {
      const recipeValue = day[slot];
      if (!recipeValue) return;
      const recipeNames = Array.isArray(recipeValue) ? recipeValue : (recipeValue ? [recipeValue] : []);
      recipeNames.forEach(recipeName => {
        const recipe = Object.values(window.recipesData || {}).find(r => r.name === recipeName);
        if (!recipe?.ingredients) return;
        recipe.ingredients.forEach(ing => {
          const key = ing.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();
          if (!map[key]) map[key] = { name: ing.name, qty: 0, unit: ing.unit || 'g', days: [] };
          map[key].qty += parseFloat(ing.quantity) || 0;
          if (!map[key].days.includes(day.dateISO)) map[key].days.push(day.dateISO);
        });
      });
    });
  });

  // 2. Enrich from inventory + deduct stock
  Object.values(map).forEach(ing => {
    const ingKey = ing.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();
    const match = inventoryObjects.find(item => {
      const k = (item.Produit||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();
      return k === ingKey || k.includes(ingKey) || ingKey.includes(k);
    });
    if (match) {
      ing.category = match.Catégorie || 'Autres';
      ing.price = parseFloat(match.Prix) || 0;
      const stock = parseFloat(match.Qty) || 0;
      const unitMatch = ing.unit === match.Unité ||
        (ing.unit === 'piece' && match.Unité === 'pièce') ||
        (ing.unit === 'pièce' && match.Unité === 'piece');
      if (unitMatch) ing.qty = Math.max(0, ing.qty - stock);
    } else {
      ing.category = 'Autres';
      ing.price = 0;
    }
  });

  // 3. Sort and return rows
  return Object.values(map)
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    .map(ing => [ing.name, ing.category, ing.qty.toFixed(1), ing.unit, ing.price.toFixed(2), ing.days.join(','), '']);
}

/**
 * Generate and write Courses sheet from current mealPlan
 */
async function generateAndWriteCourses(token, existingAcheté = {}) {
  if (!window.SheetsAPI || !token) return;

  try {
    const invRows = await window.SheetsAPI.readSheetTab('Inventory');
    const inventory = window.SheetsAPI.rowsToObjects(invRows);

    let rows = buildCoursesRows(mealPlan, inventory);

    rows = rows.map(row => {
      const key = row[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();
      row[6] = existingAcheté[key] || '';
      return row;
    });

    await window.SheetsAPI.batchUpdateRange('Courses!A2:G1000', rows, token);
    console.log(`Courses synced: ${rows.length} rows`);
  } catch (err) {
    console.warn('Courses sync failed:', err);
  }
}

/**
 * TASK 6: Sync Courses list from 7-day meal plan
 * Aggregates ingredients from all selected recipes into window.syncedCourses
 * Called from selectRecipe() and initializePlanning()
 */
function syncCoursesFromMealPlan() {
  const allIngredients = {};

  // Iterate through each day's meals
  mealPlan.forEach(dayMeal => {
    ['Midi', 'Soir'].forEach(slot => {
      const recipeValue = dayMeal[slot];
      if (!recipeValue) return;
      const recipeNames = Array.isArray(recipeValue) ? recipeValue : (recipeValue ? [recipeValue] : []);
      recipeNames.forEach(recipeName => {
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
  });

  console.log("Synced Courses list from meal plan:", Object.values(allIngredients));

  // Store in window for access by Courses page
  window.syncedCourses = Object.values(allIngredients);
}

/**
 * TASK 7: Persist all meal plan changes to Planning sheet
 * Cleans old data (>30 days), writes entire allPlanData to Planning!A2:C1000
 * Called on beforeunload and after selectRecipe()
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

    // Clean up old entries (>30 days in past)
    const RETENTION_DAYS = 30;
    const cutoff = Utils.getDateISO(-RETENTION_DAYS);
    Object.keys(allPlanData).forEach(date => {
      if (date < cutoff) {
        delete allPlanData[date];
      }
    });

    // Sort all dates and build values array (serialize recipe arrays as JSON)
    const values = Object.entries(allPlanData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, meals]) => {
        const midiVal = meals.Midi;
        const soirVal = meals.Soir;
        return [
          date,
          Array.isArray(midiVal) && midiVal.length > 0 ? JSON.stringify(midiVal) : (midiVal ? midiVal : ""),
          Array.isArray(soirVal) && soirVal.length > 0 ? JSON.stringify(soirVal) : (soirVal ? soirVal : "")
        ];
      });

    await window.SheetsAPI.batchUpdateRange("Planning!A2:C1000", values, token);
    console.log(`Planning synced: ${values.length} rows to sheet`);

    // Fire-and-forget Courses sync
    ;(async () => {
      try {
        const oldCourses = await window.SheetsAPI.readSheetTab('Courses');
        const existingAcheté = {};
        window.SheetsAPI.rowsToObjects(oldCourses).forEach(row => {
          if (row.Produit && row.Acheté === '1') {
            const key = row.Produit.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();
            existingAcheté[key] = '1';
          }
        });
        await generateAndWriteCourses(token, existingAcheté);
      } catch(e) { console.warn('Courses sync failed:', e); }
    })();
  } catch (err) {
    console.error("Failed to sync planning to Sheets:", err);
  }
}

/**
 * Navigate to previous week (-1 offset)
 */
function navigateToPreviousWeek() {
  if (weekOffset > -MAX_WEEK_OFFSET) {
    weekOffset--;
    buildMealPlanForCurrentWindow();
    renderMealPlan();
    updateWeekNavUI();
  }
}

/**
 * Navigate to next week (+1 offset)
 */
function navigateToNextWeek() {
  if (weekOffset < MAX_WEEK_OFFSET) {
    weekOffset++;
    buildMealPlanForCurrentWindow();
    renderMealPlan();
    updateWeekNavUI();
  }
}

/**
 * Update week navigation UI: label and button disabled states
 */
function updateWeekNavUI() {
  if (rollingWindow.length < 7) return;

  const first = rollingWindow[0];
  const last = rollingWindow[6];

  const label = document.getElementById('week-label');
  if (label) {
    label.textContent = `${first.dateStr} – ${last.dateStr}`;
  }

  const prevBtn = document.getElementById('prev-week-btn');
  const nextBtn = document.getElementById('next-week-btn');

  if (prevBtn) prevBtn.disabled = weekOffset <= -MAX_WEEK_OFFSET;
  if (nextBtn) nextBtn.disabled = weekOffset >= MAX_WEEK_OFFSET;
}

async function initializePlanning() {
  UserContext.applyUserStyling();
  UserContext.initializeUserToggle();
  await loadRecipes();  // Load recipes for modal
  await loadMealPlan();
  if (window.loadConversionFactors) await window.loadConversionFactors();  // Load unit conversions
  syncCoursesFromMealPlan();
  updateWeekNavUI();

  // Initialize Courses sheet on first load
  const token = window.getAccessToken ? window.getAccessToken() : null;
  if (token) {
    try {
      const oldCourses = await window.SheetsAPI.readSheetTab('Courses');
      const existingAcheté = {};
      window.SheetsAPI.rowsToObjects(oldCourses).forEach(row => {
        if (row.Produit && row.Acheté === '1') {
          const key = row.Produit.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();
          existingAcheté[key] = '1';
        }
      });
      await generateAndWriteCourses(token, existingAcheté);
    } catch(e) { console.warn('Initial Courses sync failed:', e); }
  }

  // Setup beforeunload to persist before leaving page
  window.addEventListener("beforeunload", savePlanningToSheets);
}

document.addEventListener("DOMContentLoaded", initializePlanning);
