# Home Page Meal Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor home page (index.html) to display today's 5 meals from Planning tab with interactive "J'ai mangé" buttons, calorie tracking, and barcode scan integration for snacking.

**Architecture:** Replace the multi-user objectives section with a daily meal plan display. Load today's 5 meals (petit-déj, collation_matin, déjeuner, collation_après-midi, diner) from Planning tab. Track calories consumed via localStorage. Integrate barcode scanning for snacks ("Grignottage" mode). Preserve greeting, progress circle, and date display.

**Tech Stack:** HTML/CSS/JS, Google Sheets API (Planning & Profils tabs), localStorage (meals consumed), html5-qrcode (barcode scanning), Open Food Facts API (snack nutrition lookup).

---

## Task 1: Refactor HTML Structure

**Files:**
- Modify: `index.html`

Replace the "objectives" section with a "meals" section. Keep greeting + progress circle intact.

- [ ] **Step 1: Read index.html**

Current state has a `<div class="objectives-section">` from lines 34-39. We'll replace it.

- [ ] **Step 2: Replace objectives section with meals section**

Replace:
```html
    <div class="objectives-section">
      <h3>TODAY'S OBJECTIVES</h3>
      <div id="objectives-content">
        <p class="loading-text">Chargement des objectifs...</p>
      </div>
    </div>
```

With:
```html
    <div class="meals-section">
      <div class="grignottage-banner">
        <button id="grignottage-btn" class="btn btn-primary-outline" onclick="initializeGrignottage()">
          🍪 Grignottage — Scanner
        </button>
      </div>

      <div class="meals-list" id="meals-container">
        <p class="loading-text">Chargement repas du jour...</p>
      </div>

      <div id="scanner-modal" class="modal hidden">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Scanner aliment</h3>
            <button class="modal-close" onclick="closeGrignottageModal()">✕</button>
          </div>
          <div id="scanner-container" style="width: 100%; height: 300px;">
            <!-- html5-qrcode scanner inits here -->
          </div>
          <div class="scanner-result" id="scanner-result" style="display:none;">
            <p>Aliment trouvé: <strong id="result-name">—</strong></p>
            <p>Calories: <input type="number" id="result-kcal" placeholder="0" min="0" /> kcal</p>
            <button class="btn btn-primary" onclick="addGrignottage()">Ajouter</button>
            <button class="btn btn-secondary" onclick="restartScanner()">Rescanner</button>
          </div>
        </div>
      </div>
    </div>
```

- [ ] **Step 3: Keep search section, but make it optional**

The search section (lines 41-44) can stay as-is for now. It will search within today's meals.

- [ ] **Step 4: Verify nav at bottom is unchanged**

Lines 47-68 (nav-bottom) stay the same.

- [ ] **Step 5: Add google-auth script for OAuth token access**

Add before closing `</head>`:
```html
  <script src="https://accounts.google.com/gsi/client" async defer></script>
```

This allows calling the OAuth token if the user is authenticated (for future Sheets writes).

---

## Task 2: Create Meals CSS Styling

**Files:**
- Modify: `css/accueil.css`

Add styles for meals section, meal cards, buttons, and scanner modal.

- [ ] **Step 1: Add meals-section base styles**

Append to accueil.css:

```css
/* ============================================================================
   MEALS SECTION (replaces objectives section)
   ============================================================================ */

.meals-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.grignottage-banner {
  margin-bottom: var(--spacing-sm);
}

#grignottage-btn {
  width: 100%;
  padding: var(--spacing-md);
  font-size: var(--font-size-base);
  background-color: transparent;
  border: 2px solid var(--color-primary);
  color: var(--color-primary);
  border-radius: var(--border-radius-lg);
  cursor: pointer;
  transition: all var(--transition-fast);
}

#grignottage-btn:hover {
  background-color: var(--color-primary);
  color: white;
}

#grignottage-btn:active {
  opacity: 0.8;
}

.meals-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.meal-card {
  background-color: var(--color-surface);
  border-radius: var(--border-radius-md);
  padding: var(--spacing-md);
  box-shadow: var(--shadow-sm);
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: transform var(--transition-fast), box-shadow var(--transition-fast);
}

.meal-card:active {
  transform: scale(0.98);
}

.meal-card.eaten {
  opacity: 0.6;
  background-color: #f0f0f0;
}

.meal-info {
  flex: 1;
}

.meal-time-icon {
  font-size: 20px;
  margin-right: var(--spacing-sm);
}

.meal-name {
  font-weight: var(--font-weight-bold);
  font-size: var(--font-size-base);
  color: var(--color-text);
  margin: 0;
  margin-top: 2px;
}

.meal-kcal {
  font-size: var(--font-size-small);
  color: var(--color-text-light);
  margin: 2px 0 0 0;
}

.meal-actions {
  display: flex;
  gap: var(--spacing-xs);
  align-items: center;
}

.btn-meal {
  padding: 6px 12px;
  font-size: 11px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-weight: var(--font-weight-bold);
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.btn-recette {
  background-color: var(--color-bg);
  color: var(--color-primary);
  border: 1px solid var(--color-primary);
}

.btn-recette:hover {
  background-color: var(--color-primary);
  color: white;
}

.btn-mange {
  background-color: var(--color-primary);
  color: white;
}

.btn-mange:hover {
  opacity: 0.9;
}

.btn-mange.checked {
  background-color: #4caf50;
}

.meal-card.eaten .btn-mange {
  background-color: #4caf50;
}

.meal-card.eaten .btn-mange::before {
  content: "✓ ";
}

/* ============================================================================
   SCANNER MODAL
   ============================================================================ */

.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  z-index: 1000;
}

.modal.hidden {
  display: none;
}

.modal-content {
  background-color: white;
  width: 100%;
  border-radius: var(--border-radius-lg) var(--border-radius-lg) 0 0;
  padding: var(--spacing-lg);
  max-height: 80vh;
  overflow-y: auto;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
}

.modal-header h3 {
  margin: 0;
  font-size: var(--font-size-large);
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--color-text-light);
}

.scanner-result {
  margin-top: var(--spacing-lg);
  padding: var(--spacing-md);
  background-color: var(--color-bg);
  border-radius: var(--border-radius-md);
}

.scanner-result p {
  margin: var(--spacing-sm) 0;
  font-size: var(--font-size-base);
}

.scanner-result input[type="number"] {
  width: 100px;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid var(--color-border);
  font-size: var(--font-size-base);
}
```

- [ ] **Step 2: Verify CSS doesn't conflict with existing styles**

Check that `.meals-section` doesn't clash with `.objectives-section` (it replaces it anyway).

---

## Task 3: Refactor accueil.js — Load Meals

**Files:**
- Modify: `js/accueil.js`

Replace `renderObjectives()` with `renderMeals()`. Update data loading to fetch meals and consumed calories.

- [ ] **Step 1: Update AccueilState to track meals and consumed**

Replace the state initialization (lines 12-17):

```javascript
const AccueilState = {
  profiles: { florian: null, naomi: null },
  todayMeals: [
    // Structure: { mealType, name, estimatedKcal, eaten, actualKcal, timestamp }
  ],
  caloriesConsumed: 0,    // Will be populated from localStorage + Grignottage
  grignottageCalories: 0, // Calories from scanned snacks today
  lastDateChecked: null,  // ISO date string to detect midnight rollover
};
```

- [ ] **Step 2: Add meal time constants**

After date helpers (around line 42), add:

```javascript
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
```

- [ ] **Step 3: Replace renderObjectives() with renderMeals()**

Delete `renderObjectives()` function entirely (lines 136-212).

Add new function after `renderProgressCircle()`:

```javascript
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
                <p class="meal-name">${meal.label}</p>
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
  alert(`Recette: ${meal.name}\n(Détails à venir)`);
}

/**
 * Updates the progress circle + caption after calories change.
 */
function updateProgressDisplay() {
  const user = window.UserContext ? window.UserContext.getCurrentUser() : "florian";
  const profile = AccueilState.profiles[user];
  const target = profile && profile.objectifKcal ? Number(profile.objectifKcal) : 0;
  const pct = target > 0 ? (AccueilState.caloriesConsumed / target) * 100 : 0;
  renderProgressCircle(pct);
}

/**
 * Saves meals state (eaten status) to localStorage.
 */
function saveMealsState() {
  const today = getTodayISO();
  const stateToSave = AccueilState.todayMeals.map(m => ({
    mealType: m.mealType,
    eaten: m.eaten,
    actualKcal: m.actualKcal,
  }));
  localStorage.setItem(`mealflow:meals:${today}`, JSON.stringify(stateToSave));
  localStorage.setItem(`mealflow:consumed:${today}`, String(AccueilState.caloriesConsumed));
}

/**
 * Loads meals state (eaten status) from localStorage.
 */
function loadMealsState() {
  const today = getTodayISO();
  const savedState = localStorage.getItem(`mealflow:meals:${today}`);
  const savedConsumed = localStorage.getItem(`mealflow:consumed:${today}`);

  if (savedState) {
    const stateArray = JSON.parse(savedState);
    stateArray.forEach(saved => {
      const meal = AccueilState.todayMeals.find(m => m.mealType === saved.mealType);
      if (meal) {
        meal.eaten = saved.eaten;
        meal.actualKcal = saved.actualKcal || meal.estimatedKcal;
      }
    });
  }

  if (savedConsumed) {
    AccueilState.caloriesConsumed = Number(savedConsumed);
  }
}
```

- [ ] **Step 4: Update loadPlanningData() to populate todayMeals array**

Replace the `loadPlanningData()` function (lines 249-266) with:

```javascript
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
      const columnName = mealDef.type.split("_").map((w, i) => 
        i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w
      ).join("-");
      // Try different column name variations
      const mealName = todayRow["Petit-déj"] !== undefined && mealDef.type === "petit_dejeuner" ? todayRow["Petit-déj"] :
                       todayRow["Collation_matin"] !== undefined && mealDef.type === "collation_matin" ? todayRow["Collation_matin"] :
                       todayRow["Déjeuner"] !== undefined && mealDef.type === "dejeuner" ? todayRow["Déjeuner"] :
                       todayRow["Collation_après-midi"] !== undefined && mealDef.type === "collation_apres_midi" ? todayRow["Collation_après-midi"] :
                       todayRow["Diner"] !== undefined && mealDef.type === "diner" ? todayRow["Diner"] :
                       "";

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
```

- [ ] **Step 5: Update initAccueil() to call renderMeals and load state**

Modify the `initAccueil()` function (lines 350-388). Change the rendering sequence:

```javascript
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
```

- [ ] **Step 6: Update userChanged event listener**

Replace the existing `userChanged` event listener (lines 395-404) with:

```javascript
document.addEventListener("userChanged", function () {
  renderGreeting();
  updateProgressDisplay();
  // Meals stay the same (they're per-day, not per-user)
});
```

- [ ] **Step 7: Update search to filter meals**

Modify `initializeSearch()` (lines 287-323) to search within meal names:

```javascript
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
```

---

## Task 4: Add Grignottage Scanner Integration

**Files:**
- Modify: `js/accueil.js`

Add barcode scanning for snacks + calorie lookup via Open Food Facts API.

- [ ] **Step 1: Add Grignottage state variables**

Add at the top of accueil.js after AccueilState definition:

```javascript
/**
 * Grignottage scanner state
 */
let grignottageScanner = null;
let grignottageCurrentBarcode = null;
```

- [ ] **Step 2: Add html5-qrcode script tag to index.html**

In index.html, before the closing `</head>`, add:

```html
  <script src="https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.4/esm/html5-qrcode.min.js"></script>
```

- [ ] **Step 3: Implement initializeGrignottageButton() function**

Add to accueil.js:

```javascript
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
  startScanner();
}

/**
 * Closes the scanner modal.
 */
function closeGrignottageModal() {
  const modal = document.getElementById("scanner-modal");
  if (modal) {
    modal.classList.add("hidden");
  }
  stopScanner();
}

/**
 * Starts the html5-qrcode scanner.
 */
function startScanner() {
  const scannerContainer = document.getElementById("scanner-container");
  if (!scannerContainer) return;

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
    grignottageScanner.stop().then(() => {
      grignottageScanner = null;
    }).catch((err) => {
      console.error("Error stopping scanner:", err);
    });
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

  resultDiv.style.display = "block";

  try {
    // Fetch from Open Food Facts API
    const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
    const data = await response.json();

    if (data.product) {
      const product = data.product;
      const name = product.product_name || product.generic_name || barcode;
      const kcal = product.nutriments?.["energy-kcal"] || product.nutriments?.["energy-kcal_100g"] || 0;

      nameEl.textContent = name;
      kcalEl.value = Math.round(kcal);
      kcalEl.focus();
    } else {
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
  document.getElementById("scanner-result").style.display = "none";
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

  if (kcal === 0) {
    alert("Entrer les calories");
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

/**
 * Initializes the Grignottage button click handler.
 */
function initializeGrignottageButton() {
  const btn = document.getElementById("grignottage-btn");
  if (btn) {
    btn.addEventListener("click", openGrignottageModal);
  }
}
```

- [ ] **Step 4: Call initializeGrignottageButton in initAccueil()**

Ensure it's called at the end of `initAccueil()` (already noted in Task 3, Step 5).

---

## Task 5: Clear Old Objectives CSS & Clean Up

**Files:**
- Modify: `css/accueil.css`

Remove old objectives-related CSS since we're replacing that section.

- [ ] **Step 1: Remove objectives-section CSS**

Delete these CSS rules from accueil.css (lines 127-275):
- `.objectives-section`
- `.objectives-section h3`
- `.objective-card*`
- `.today-meals*`
- `.meal-chip*`
- `.no-meals-text`

Don't delete the search-section styles — they're still used.

- [ ] **Step 2: Verify all new styles are present**

Make sure all `.meals-section`, `.meal-card`, `.btn-meal`, `.modal`, and `.scanner-*` styles from Task 2 are present.

---

## Task 6: Test & Commit

**Files:**
- None new, but validate all changes work together.

- [ ] **Step 1: Test in browser — load index.html**

1. Open `http://localhost:8000` (or however you serve)
2. Verify greeting + progress circle still show
3. Verify meals section loads with 5 meals for today (if Planning tab has today's data)
4. Click "Grignottage" button — modal should open
5. Click "Mangé" button for a meal — it should mark eaten + update progress circle
6. Close modal if open

- [ ] **Step 2: Test with empty Planning tab**

If Planning tab is empty, meals section should show "Aucun repas planifié pour aujourd'hui".

- [ ] **Step 3: Test barcode scanner (Grignottage)**

1. Click "Grignottage" button
2. Scanner modal opens
3. Point at a real barcode or use a barcode test image
4. If valid barcode, show product name + calories
5. Click "Ajouter" — calories should be added to consumed total
6. Progress circle should update

- [ ] **Step 4: Test localStorage persistence**

1. Mark a meal as "Mangé"
2. Refresh the page
3. That meal should still be marked as eaten
4. Calorie progress should persist

- [ ] **Step 5: Test userChanged event**

If you have a user toggle, switch users — progress should update, greeting should change.

- [ ] **Step 6: Commit all changes**

```bash
git add index.html css/accueil.css js/accueil.js
git commit -m "feat: refactor home page to display daily meals with calorie tracking and barcode scan integration"
git push origin main
```

---

## Notes

- **Estimated calories:** Each meal has a default estimated calorie value (petit-déj 400, déjeuner 700, etc.). Users can override via "J'ai mangé" dialog in a future enhancement.
- **Recipe links:** "📖" button is a placeholder. Can be enhanced to link to Sheets Recipes tab later.
- **Multi-user tracking:** Currently, meals state is per-day (not per-user). Consumed calories are summed once. If multi-user per-meal tracking is needed, enhance in future task.
- **localStorage keys:** Format is `mealflow:meals:{YYYY-MM-DD}` and `mealflow:consumed:{YYYY-MM-DD}`. Clears at midnight.
- **Grignottage modal:** Full-screen bottom-sheet animation. Can be customized for desktop later.
- **Open Food Facts API:** Free, public API. No auth required. Fallback: user manually enters calories if product not found.

