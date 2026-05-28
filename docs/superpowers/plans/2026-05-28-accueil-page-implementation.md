# Accueil Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Accueil (home) page with daily meal logging, calorie tracking, and consumption history.

**Architecture:** Single-page dashboard loading today's meals from Planning tab, daily goal from Profils, and consumptions from History_[user] tab. Calorie wheel shows percentage (consumed/goal×100) + remaining kcal. Two consumption modals: Manger (recipes with qty) and Consommer (any inventory item). Real-time log with delete capability.

**Tech Stack:** Vanilla JS, Google Sheets API (Planning, Profils, History_florian, History_naomi tabs), SheetsAPI wrapper

---

## File Structure

- **`index.html`** — Page structure (wheel, meals section, buttons, log table)
- **`js/accueil.js`** — Core logic (load data, render components, event handlers)
- **`js/accueil-ui.js`** — Modal forms (Manger qty input, Consommer product picker)
- **`css/accueil.css`** (if needed) — Calorie wheel styling

---

## Task 1: Setup State & Load Today's Data

**Files:**
- Modify: `index.html` (add container divs for wheel, meals, log)
- Create: `js/accueil.js` (module exports, state, load functions)

- [ ] **Step 1: Add HTML structure to index.html**

Add to `<main>`:
```html
<section class="accueil-wheel">
  <div id="calorie-wheel">
    <div class="wheel-percentage" id="wheel-percentage">0%</div>
    <div class="wheel-remaining" id="wheel-remaining">Goal not set</div>
  </div>
</section>

<section class="accueil-meals">
  <h2>🍽️ Repas du jour</h2>
  <div id="meals-container"></div>
  <button id="consume-btn" class="btn btn-primary">🍽️ Consommer</button>
</section>

<section class="accueil-log">
  <h3>📋 Consommations du jour</h3>
  <table id="consumption-log">
    <thead>
      <tr>
        <th>Heure</th>
        <th>Aliment</th>
        <th>Qty</th>
        <th>Kcal</th>
        <th>Action</th>
      </tr>
    </thead>
    <tbody id="log-body"></tbody>
  </table>
</section>
```

- [ ] **Step 2: Create accueil.js with state & load functions**

```javascript
// State
let todaysMeals = [];
let dailyGoal = 0;
let todaysConsumptions = [];
let currentUser = null;

/**
 * Get current logged-in user (Florian or Naomi)
 * Assumes UserContext provides user name
 */
function getCurrentUser() {
  return currentUser = (window.userContext?.name || "florian").toLowerCase();
}

/**
 * Load today's meals from Planning tab (date = today)
 */
async function loadTodaysMeals() {
  try {
    const rows = await SheetsAPI.readSheetTab("Planning");
    const objects = SheetsAPI.rowsToObjects(rows);
    const todayISO = Utils.getTodayISO.call({ date: new Date() });

    const planRow = objects.find(row => row.Date === todayISO);
    if (!planRow) {
      console.log("No meals planned for today");
      todaysMeals = [];
      return;
    }

    todaysMeals = [
      { type: "Midi", name: planRow.Midi || "", kcal_per_100: null },
      { type: "Soir", name: planRow.Soir || "", kcal_per_100: null }
    ];

    // Fetch kcal_per_100 from recipes if meal exists
    for (const meal of todaysMeals) {
      if (meal.name) {
        const recipe = Object.values(window.recipesData || {})
          .find(r => r.name === meal.name);
        meal.kcal_per_100 = recipe?.kcal_per_100 || 0;
      }
    }

    console.log("Loaded today's meals:", todaysMeals);
  } catch (error) {
    console.error("Failed to load meals:", error);
    todaysMeals = [];
  }
}

/**
 * Load daily goal from Profils tab for current user
 */
async function loadDailyGoal() {
  try {
    const rows = await SheetsAPI.readSheetTab("Profils");
    const objects = SheetsAPI.rowsToObjects(rows);

    const userRow = objects.find(row => 
      row.Nom?.toLowerCase() === currentUser
    );

    dailyGoal = userRow?.DailyGoal_kcal ? parseInt(userRow.DailyGoal_kcal) : 2000;
    console.log(`Daily goal for ${currentUser}: ${dailyGoal} kcal`);
  } catch (error) {
    console.warn("Failed to load daily goal, using default 2000:", error);
    dailyGoal = 2000;
  }
}

/**
 * Load today's consumptions from History_[user] tab (date = today)
 */
async function loadTodaysConsumptions() {
  try {
    const historyTab = `History_${currentUser}`;
    const rows = await SheetsAPI.readSheetTab(historyTab);
    const objects = SheetsAPI.rowsToObjects(rows);
    const todayISO = Utils.getTodayISO.call({ date: new Date() });

    todaysConsumptions = objects
      .filter(row => row.Date === todayISO)
      .map(row => ({
        time: row.Heure || "",
        name: row.Nom || "",
        qty: parseInt(row.Quantité) || 0,
        unit: row.Unité || "g",
        kcal_total: parseFloat(row.Kcal_total) || 0,
        type: row.Type || "snack",
        _sheetRow: row._sheetRow  // for delete
      }));

    console.log("Loaded today's consumptions:", todaysConsumptions);
  } catch (error) {
    console.warn("Failed to load consumptions, using empty:", error);
    todaysConsumptions = [];
  }
}

/**
 * Initialize page: load all data, render components
 */
async function initializeAccueil() {
  getCurrentUser();
  await loadRecipes();  // Ensure recipes loaded for kcal lookup
  await loadInventory();  // Ensure inventory loaded for Consommer
  await loadDailyGoal();
  await loadTodaysMeals();
  await loadTodaysConsumptions();
  
  renderWheel();
  renderMeals();
  renderConsumptionLog();
  setupEventHandlers();
  
  console.log("Accueil page initialized");
}

document.addEventListener("DOMContentLoaded", initializeAccueil);
```

- [ ] **Step 3: Test page loads without errors**

Open index.html in browser. Console should show:
```
Recipes loaded from Recettes: X recipes
Inventory loaded from Sheets: X items
Daily goal for florian: 2000 kcal
Loaded today's meals: [...]
Loaded today's consumptions: [...]
Accueil page initialized
```

- [ ] **Step 4: Commit**

```bash
git add index.html js/accueil.js
git commit -m "feat: setup Accueil page state and data loading"
```

---

## Task 2: Implement Calorie Wheel

**Files:**
- Modify: `js/accueil.js` (add renderWheel function)
- Modify: `css/accueil.css` (add wheel styles)

- [ ] **Step 1: Add renderWheel function to accueil.js**

```javascript
/**
 * Render calorie wheel with percentage and remaining
 */
function renderWheel() {
  const consumed = todaysConsumptions.reduce((sum, c) => sum + c.kcal_total, 0);
  const percentage = dailyGoal > 0 ? Math.round((consumed / dailyGoal) * 100) : 0;
  const remaining = Math.max(0, dailyGoal - consumed);

  const percentageEl = document.getElementById("wheel-percentage");
  const remainingEl = document.getElementById("wheel-remaining");

  percentageEl.textContent = `${percentage}%`;
  remainingEl.textContent = `Remaining: ${remaining} kcal`;

  // Update wheel color based on consumption
  const wheelContainer = document.querySelector(".accueil-wheel");
  if (percentage >= 100) {
    wheelContainer.style.borderColor = "red";
  } else if (percentage >= 80) {
    wheelContainer.style.borderColor = "orange";
  } else {
    wheelContainer.style.borderColor = "green";
  }
}
```

- [ ] **Step 2: Add CSS for wheel (accueil.css)**

```css
.accueil-wheel {
  text-align: center;
  padding: 40px;
  border: 8px solid green;
  border-radius: 50%;
  width: 200px;
  height: 200px;
  margin: 40px auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  transition: border-color 0.3s;
}

#wheel-percentage {
  font-size: 48px;
  font-weight: bold;
  margin-bottom: 10px;
}

#wheel-remaining {
  font-size: 14px;
  color: #666;
}
```

- [ ] **Step 3: Test wheel updates**

Open browser console and run:
```javascript
todaysConsumptions = [{kcal_total: 500}];
renderWheel();
```

Wheel should show "25%" and "Remaining: 1500 kcal" (assuming 2000 goal).

- [ ] **Step 4: Commit**

```bash
git add js/accueil.js css/accueil.css
git commit -m "feat: implement calorie wheel with percentage"
```

---

## Task 3: Render Today's Meals

**Files:**
- Modify: `js/accueil.js` (add renderMeals function)

- [ ] **Step 1: Add renderMeals function**

```javascript
/**
 * Render today's meals with Manger buttons
 */
function renderMeals() {
  const container = document.getElementById("meals-container");
  if (!container) return;

  if (todaysMeals.length === 0 || !todaysMeals.some(m => m.name)) {
    container.innerHTML = '<p style="color:#999;">Aucun repas prévu</p>';
    return;
  }

  container.innerHTML = todaysMeals.map((meal, index) => {
    const emoji = meal.type === "Midi" ? "🍽️" : "🌙";
    const label = meal.type === "Midi" ? "MIDI" : "SOIR";
    
    return `
      <div class="meal-item">
        <span>${emoji} ${label} — ${meal.name || "(empty)"}</span>
        ${meal.name ? `<button class="btn btn-sm" onclick="openMangerModal(${index})">Manger</button>` : ""}
      </div>
    `;
  }).join("");
}
```

- [ ] **Step 2: Add CSS for meals**

Add to accueil.css:
```css
.meal-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-bottom: 8px;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}
```

- [ ] **Step 3: Test rendering**

Open browser. Should show meals or empty state.

- [ ] **Step 4: Commit**

```bash
git add js/accueil.js css/accueil.css
git commit -m "feat: render today's planned meals"
```

---

## Task 4: Implement Manger Modal

**Files:**
- Create: `js/accueil-ui.js` (modal logic)
- Modify: `index.html` (add modal HTML)
- Modify: `js/accueil.js` (call modal function)

- [ ] **Step 1: Add modal HTML to index.html**

Before closing `</main>`:
```html
<!-- Manger Modal -->
<div id="manger-modal" class="modal" style="display: none;">
  <div class="modal-content">
    <h2 id="manger-title">Manger</h2>
    <div>
      <label>Quantité (g):</label>
      <input type="number" id="manger-qty" min="0" step="10" placeholder="150">
    </div>
    <div style="margin-top: 10px;">
      <p id="manger-kcal-preview">Calories: 0 kcal</p>
    </div>
    <div style="margin-top: 16px; display: flex; gap: 8px;">
      <button class="btn btn-secondary" onclick="closeMangerModal()">Annuler</button>
      <button class="btn btn-primary" onclick="submitManger()">Manger</button>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Create accueil-ui.js with modal functions**

```javascript
let selectedMealIndex = null;

/**
 * Open Manger modal for a specific meal
 */
function openMangerModal(index) {
  selectedMealIndex = index;
  const meal = todaysMeals[index];
  
  const titleEl = document.getElementById("manger-title");
  titleEl.textContent = `Manger — ${meal.name}`;

  const qtyInput = document.getElementById("manger-qty");
  qtyInput.value = "";
  qtyInput.addEventListener("input", updateMangerPreview);

  const modal = document.getElementById("manger-modal");
  modal.style.display = "flex";
}

/**
 * Close Manger modal
 */
function closeMangerModal() {
  const modal = document.getElementById("manger-modal");
  modal.style.display = "none";
  selectedMealIndex = null;
}

/**
 * Update calorie preview as user types qty
 */
function updateMangerPreview() {
  if (selectedMealIndex === null) return;
  
  const meal = todaysMeals[selectedMealIndex];
  const qty = parseFloat(document.getElementById("manger-qty").value) || 0;
  const kcal = qty * (meal.kcal_per_100 / 100);
  
  document.getElementById("manger-kcal-preview").textContent = 
    `Calories: ${Math.round(kcal)} kcal`;
}

/**
 * Submit Manger: log consumption and save to Sheets
 */
async function submitManger() {
  if (selectedMealIndex === null) return;

  const meal = todaysMeals[selectedMealIndex];
  const qty = parseFloat(document.getElementById("manger-qty").value);

  if (!qty || qty <= 0) {
    alert("Entrez une quantité");
    return;
  }

  const kcal = Math.round(qty * (meal.kcal_per_100 / 100));
  const now = new Date();
  const time = now.getHours().toString().padStart(2, "0") + ":" + 
               now.getMinutes().toString().padStart(2, "0");
  const date = Utils.getTodayISO.call({ date: now });

  // Add to local state
  todaysConsumptions.push({
    time, name: meal.name, qty, unit: "g", kcal_total: kcal, type: "meal"
  });

  // Save to Sheets
  try {
    const token = window.getAccessToken?.();
    if (token) {
      const historyTab = `History_${currentUser}`;
      const row = [date, time, meal.name, qty, "g", kcal, "meal"];
      await SheetsAPI.appendRowWithToken(historyTab, row, token);
    }
  } catch (error) {
    console.error("Failed to save consumption:", error);
  }

  // Update UI
  renderWheel();
  renderConsumptionLog();
  closeMangerModal();
}
```

- [ ] **Step 3: Add modal CSS to accueil.css**

```css
.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.5);
  display: none;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 8px;
  padding: 20px;
  max-width: 400px;
  width: 90%;
}

.modal-content h2 {
  margin-top: 0;
}

.modal-content label {
  display: block;
  margin-bottom: 4px;
  font-weight: bold;
}

.modal-content input {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}
```

- [ ] **Step 4: Add script loading to index.html**

Add before closing `</body>`:
```html
<script src="js/accueil-ui.js"></script>
```

- [ ] **Step 5: Test Manger modal**

Click [Manger] button. Modal should open. Type qty, preview should update.

- [ ] **Step 6: Commit**

```bash
git add index.html js/accueil.js js/accueil-ui.js css/accueil.css
git commit -m "feat: implement Manger modal for recipes"
```

---

## Task 5: Implement Consommer Modal

**Files:**
- Modify: `index.html` (add Consommer modal HTML)
- Modify: `js/accueil-ui.js` (add Consommer modal functions)
- Modify: `js/accueil.js` (update setupEventHandlers to attach Consommer button)

- [ ] **Step 1: Add Consommer modal HTML to index.html**

Before closing `</main>`:
```html
<!-- Consommer Modal -->
<div id="consommer-modal" class="modal" style="display: none;">
  <div class="modal-content">
    <h2>🛒 Consommer un aliment</h2>
    <div>
      <label>Aliment:</label>
      <select id="consommer-product" onchange="updateConsommerPreview()">
        <option value="">-- Choisir --</option>
      </select>
    </div>
    <div style="margin-top: 10px;">
      <label>Quantité (g):</label>
      <input type="number" id="consommer-qty" min="0" step="10" 
             placeholder="100" onchange="updateConsommerPreview()">
    </div>
    <div style="margin-top: 10px;">
      <p id="consommer-kcal-preview">Calories: 0 kcal</p>
    </div>
    <div style="margin-top: 16px; display: flex; gap: 8px;">
      <button class="btn btn-secondary" onclick="closeConsommerModal()">Annuler</button>
      <button class="btn btn-primary" onclick="submitConsommer()">Consommer</button>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Add Consommer functions to accueil-ui.js**

```javascript
let selectedProduct = null;

/**
 * Open Consommer modal
 */
function openConsommerModal() {
  const selectEl = document.getElementById("consommer-product");
  selectEl.innerHTML = '<option value="">-- Choisir --</option>';

  // Populate with inventory items
  const items = Object.values(window.inventoryData || {});
  items.forEach(item => {
    const option = document.createElement("option");
    option.value = item.Produit;
    option.textContent = item.Produit;
    option.dataset.kcal = item.calories_per_100 || 0;
    selectEl.appendChild(option);
  });

  const modal = document.getElementById("consommer-modal");
  modal.style.display = "flex";
}

/**
 * Close Consommer modal
 */
function closeConsommerModal() {
  const modal = document.getElementById("consommer-modal");
  modal.style.display = "none";
  selectedProduct = null;
}

/**
 * Update calorie preview for Consommer
 */
function updateConsommerPreview() {
  const selectEl = document.getElementById("consommer-product");
  const option = selectEl.options[selectEl.selectedIndex];
  const kcal_per_100 = parseFloat(option.dataset.kcal) || 0;
  const qty = parseFloat(document.getElementById("consommer-qty").value) || 0;
  const kcal = qty * (kcal_per_100 / 100);

  selectedProduct = {
    name: option.value,
    kcal_per_100
  };

  document.getElementById("consommer-kcal-preview").textContent = 
    `Calories: ${Math.round(kcal)} kcal`;
}

/**
 * Submit Consommer: log any inventory item
 */
async function submitConsommer() {
  const selectEl = document.getElementById("consommer-product");
  const qty = parseFloat(document.getElementById("consommer-qty").value);

  if (!selectEl.value || !qty || qty <= 0) {
    alert("Sélectionnez un aliment et entrez une quantité");
    return;
  }

  const kcal = Math.round(qty * (selectedProduct.kcal_per_100 / 100));
  const now = new Date();
  const time = now.getHours().toString().padStart(2, "0") + ":" + 
               now.getMinutes().toString().padStart(2, "0");
  const date = Utils.getTodayISO.call({ date: now });

  // Add to local state
  todaysConsumptions.push({
    time, name: selectedProduct.name, qty, unit: "g", kcal_total: kcal, type: "snack"
  });

  // Save to Sheets
  try {
    const token = window.getAccessToken?.();
    if (token) {
      const historyTab = `History_${currentUser}`;
      const row = [date, time, selectedProduct.name, qty, "g", kcal, "snack"];
      await SheetsAPI.appendRowWithToken(historyTab, row, token);
    }
  } catch (error) {
    console.error("Failed to save consumption:", error);
  }

  // Update UI
  renderWheel();
  renderConsumptionLog();
  closeConsommerModal();
}
```

- [ ] **Step 3: Update accueil.js to attach Consommer button**

Add to setupEventHandlers (create this function if it doesn't exist):

```javascript
/**
 * Attach event listeners
 */
function setupEventHandlers() {
  const consumeBtn = document.getElementById("consume-btn");
  if (consumeBtn) {
    consumeBtn.addEventListener("click", openConsommerModal);
  }
}
```

And call it from initializeAccueil (already done in Task 1).

- [ ] **Step 4: Test Consommer modal**

Click [Consommer] button. Modal should open with product dropdown populated.

- [ ] **Step 5: Commit**

```bash
git add index.html js/accueil-ui.js js/accueil.js
git commit -m "feat: implement Consommer modal for any inventory item"
```

---

## Task 6: Render Consumption Log

**Files:**
- Modify: `js/accueil.js` (add renderConsumptionLog function)

- [ ] **Step 1: Add renderConsumptionLog function**

```javascript
/**
 * Render today's consumption log with delete buttons
 */
function renderConsumptionLog() {
  const tbody = document.getElementById("log-body");
  if (!tbody) return;

  if (todaysConsumptions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;">Aucune consommation aujourd\'hui</td></tr>';
    return;
  }

  tbody.innerHTML = todaysConsumptions.map((consumption, index) => `
    <tr>
      <td>${consumption.time}</td>
      <td>${consumption.name}</td>
      <td>${consumption.qty}${consumption.unit}</td>
      <td>${consumption.kcal_total}</td>
      <td><button class="btn-delete" onclick="deleteConsumption(${index})">✕</button></td>
    </tr>
  `).join("");
}
```

- [ ] **Step 2: Add delete function to accueil.js**

```javascript
/**
 * Delete a consumption from today's log
 */
async function deleteConsumption(index) {
  if (!confirm("Supprimer cette consommation?")) return;

  const consumption = todaysConsumptions[index];
  todaysConsumptions.splice(index, 1);

  // TODO: Delete from History_[user] sheet (requires finding the row)
  // For now, only update local state
  console.log("Consumption deleted from local state (Sheets update pending)");

  renderWheel();
  renderConsumptionLog();
}
```

- [ ] **Step 3: Add CSS for log table**

Add to accueil.css:
```css
#consumption-log {
  width: 100%;
  border-collapse: collapse;
  margin-top: 16px;
}

#consumption-log th, #consumption-log td {
  border: 1px solid #ddd;
  padding: 8px;
  text-align: left;
}

#consumption-log th {
  background: #f5f5f5;
  font-weight: bold;
}

.btn-delete {
  background: #ff6b6b;
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
}

.btn-delete:hover {
  background: #ff5252;
}
```

- [ ] **Step 4: Test log rendering**

Add a consumption and log should update. Delete should remove from log.

- [ ] **Step 5: Commit**

```bash
git add js/accueil.js css/accueil.css
git commit -m "feat: render consumption log with delete"
```

---

## Task 7: Add CSS Links & Test End-to-End

**Files:**
- Modify: `index.html` (add CSS link)

- [ ] **Step 1: Link accueil.css to index.html**

In `<head>`:
```html
<link rel="stylesheet" href="css/accueil.css">
```

- [ ] **Step 2: Ensure all scripts loaded in index.html**

At end of `<body>`:
```html
<script src="js/user-context.js"></script>
<script src="js/google-auth.js"></script>
<script src="js/sheets-api.js"></script>
<script src="js/utils.js"></script>
<script src="js/inventory.js"></script>
<script src="js/recettes-utils.js"></script>
<script src="js/recettes.js"></script>
<script src="js/accueil.js"></script>
<script src="js/accueil-ui.js"></script>
```

- [ ] **Step 3: Test end-to-end workflow**

1. Load index.html
2. Wheel shows 0%, remaining = goal
3. Meals display (if planned for today)
4. Click [Manger] → modal opens → enter qty → preview updates → click submit
5. Wheel updates, consumption appears in log
6. Click [Consommer] → modal opens → select product → enter qty → submit
7. Wheel updates again, new consumption in log
8. Reload page → consumptions persist

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "chore: link CSS and scripts to Accueil page"
```

---

## Verification Checklist

- [ ] Calorie wheel shows percentage (0-100%) and remaining kcal
- [ ] Today's meals load from Planning tab (Midi/Soir only)
- [ ] Daily goal loads from Profils tab
- [ ] Manger modal calculates kcal correctly (qty × kcal_per_100 ÷ 100)
- [ ] Consommer modal shows all inventory items
- [ ] Consumptions saved to History_[user] tab
- [ ] Log displays all consumptions with delete buttons
- [ ] Wheel updates in real-time after each consumption
- [ ] Delete removes from log (and ideally from Sheets)
- [ ] Reload persists consumptions from Sheets
- [ ] Separate History_florian / History_naomi (per user)

---

**Status:** Ready for implementation.
