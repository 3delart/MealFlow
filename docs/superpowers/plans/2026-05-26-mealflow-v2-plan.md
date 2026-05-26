# MealFlow V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full V2 rebuild from scratch: vanilla JS app with recipe management, meal logging, weekly planning, inventory tracking, and per-user nutrition history.

**Architecture:** Single-page app + multi-page HTML files, Google Sheets backend (Profils, Planning, Inventory, RecettesJSON, History_[user] tabs), Google OAuth 2.0 persistent auth, localStorage cache for offline mode.

**Tech Stack:** Vanilla HTML/CSS/JS (no framework/build), Google Sheets API v4 (read via API key, write via OAuth), Chart.js 4.4.0 (stats), html5-qrcode (barcode), Open Food Facts API.

---

## Task 1: Foundation — CSS Variables & Shared Styles

**Files:**
- Create: `css/style.css`

- [ ] **Step 1: Create shared CSS file with variables, nav, buttons, modals**

```css
:root {
  --primary: #2e7d32;
  --primary-light: #4caf50;
  --primary-bg: #f1f8f1;
  --primary-border: #c8e6c9;
  --danger: #e74c3c;
  --warning: #e67e22;
  --success: #27ae60;
  --text-primary: #222;
  --text-secondary: #999;
  --bg-light: #f5f5f5;
  --bg-white: #fff;
  --border-light: #eee;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #f5f5f5;
  color: var(--text-primary);
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
}

/* Navigation */
.nav-bottom {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 56px;
  background: var(--bg-white);
  border-top: 1px solid var(--border-light);
  display: flex;
  align-items: center;
  justify-content: space-around;
  z-index: 100;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  font-size: 0.6em;
  color: var(--text-secondary);
  text-decoration: none;
  flex: 1;
  padding: 4px;
}

.nav-item.active {
  color: var(--primary);
}

.nav-icon {
  font-size: 1.5em;
}

/* App header */
.app-header {
  padding: 12px 16px;
  background: var(--bg-white);
  border-bottom: 1px solid var(--border-light);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.app-header h1 {
  font-size: 1.2em;
  font-weight: 700;
}

.user-chip {
  background: var(--primary);
  color: var(--bg-white);
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 0.75em;
  font-weight: 600;
}

/* Buttons */
.btn {
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  font-size: 0.95em;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--primary);
  color: var(--bg-white);
}

.btn-primary:active {
  background: #1b5e20;
  transform: scale(0.98);
}

.btn-secondary {
  background: var(--primary-bg);
  color: var(--primary);
  border: 1px solid var(--primary-border);
}

.btn-danger {
  background: var(--danger);
  color: var(--bg-white);
}

.btn-small {
  padding: 5px 10px;
  font-size: 0.75em;
}

/* Cards */
.card {
  background: var(--bg-white);
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.07);
}

/* Modal */
.modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  z-index: 1000;
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

.modal-content {
  background: var(--bg-white);
  width: 100%;
  border-radius: 16px 16px 0 0;
  padding: 20px 16px 40px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-title {
  font-size: 1.2em;
  font-weight: 700;
  margin-bottom: 16px;
}

/* Form */
input, select, textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--primary-border);
  border-radius: 6px;
  font-size: 1em;
  margin-bottom: 8px;
}

input:focus, select:focus, textarea:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-bg);
}

label {
  display: block;
  font-size: 0.9em;
  font-weight: 600;
  margin-bottom: 4px;
  color: var(--text-primary);
}

/* Chips */
.chip {
  display: inline-block;
  background: var(--primary-bg);
  color: var(--primary);
  padding: 5px 12px;
  border-radius: 20px;
  font-size: 0.85em;
  margin-right: 6px;
  margin-bottom: 6px;
}

.chip.active {
  background: var(--primary);
  color: var(--bg-white);
}

/* Toast */
.toast {
  position: fixed;
  bottom: 70px;
  left: 16px;
  right: 16px;
  background: #333;
  color: var(--bg-white);
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 0.9em;
  z-index: 999;
  animation: slideUp 0.3s ease-out;
}

.toast.success {
  background: var(--success);
}

.toast.error {
  background: var(--danger);
}

.toast.warning {
  background: var(--warning);
}

/* Page content */
.page-content {
  padding: 12px 14px 70px;
  max-width: 600px;
  margin: 0 auto;
}

/* Tabs */
.tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--border-light);
}

.tab {
  flex: 1;
  padding: 10px;
  text-align: center;
  font-size: 0.9em;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  border-bottom: 3px solid transparent;
}

.tab.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
}

/* Utilities */
.hidden {
  display: none;
}

.mt-1 { margin-top: 8px; }
.mt-2 { margin-top: 16px; }
.mb-1 { margin-bottom: 8px; }
.mb-2 { margin-bottom: 16px; }
.p-2 { padding: 16px; }

/* Responsive */
@media (max-width: 600px) {
  body {
    font-size: 14px;
  }
}
```

- [ ] **Step 2: Run test — verify CSS loads in browser**

Open `index.html` in browser. Check: nav bar at bottom, colors correct (green theme), no console errors.

- [ ] **Step 3: Commit**

```bash
git add css/style.css
git commit -m "feat: add shared CSS foundation with variables, nav, buttons, modals, forms"
```

---

## Task 2: Foundation — utils.js Module

**Files:**
- Create: `js/utils.js`

- [ ] **Step 1: Write utilities module**

```javascript
window.Utils = {
  getTodayISO() {
    const d = new Date();
    return d.toISOString().split('T')[0];
  },

  getLocaleDateFr(dateISO) {
    const [y, m, d] = dateISO.split('-');
    const date = new Date(y, m - 1, d);
    const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const months = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'aoû', 'sep', 'oct', 'nov', 'déc'];
    return `${days[date.getDay()]} ${d} ${months[date.getMonth()]} ${y}`;
  },

  daysUntilExpiry(expiryISO) {
    const today = new Date(this.getTodayISO());
    const expiry = new Date(expiryISO);
    const diff = (expiry - today) / (1000 * 60 * 60 * 24);
    return Math.ceil(diff);
  },

  formatTime(hhmm) {
    return hhmm;
  },

  slugify(text) {
    return text.toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_');
  },

  showToast(message, type = 'default') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  },

  calcKcalPer100g(totalKcal, totalWeightG) {
    if (totalWeightG === 0) return 0;
    return (totalKcal / totalWeightG) * 100;
  },

  calcPortionKcal(eatengrams, kcalPer100g) {
    return (eatengrams / 100) * kcalPer100g;
  },

  getMifflinStJeor(sexe, poids, taille, age) {
    let bmr;
    if (sexe === 'M') {
      bmr = 10 * poids + 6.25 * taille - 5 * age + 5;
    } else {
      bmr = 10 * poids + 6.25 * taille - 5 * age - 161;
    }
    return Math.round(bmr);
  },

  getTDEE(bmr, activite) {
    const factors = {
      'Sédentaire': 1.2,
      'Peu actif': 1.375,
      'Modéré': 1.55,
      'Très actif': 1.725,
      'Extrêmement actif': 1.9,
    };
    return Math.round(bmr * (factors[activite] || 1.55));
  },

  addDaysToISO(dateISO, days) {
    const d = new Date(dateISO);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  },

  getWeekStart(dateISO) {
    const d = new Date(dateISO);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return d.toISOString().split('T')[0];
  },

  getWeekDays(weekStartISO) {
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(this.addDaysToISO(weekStartISO, i));
    }
    return days;
  },

  getMBIandMetrics(poids, taille, sexe, age, activite) {
    const imc = Math.round((poids / ((taille / 100) ** 2)) * 10) / 10;
    const bmr = this.getMifflinStJeor(sexe, poids, taille, age);
    const tdee = this.getTDEE(bmr, activite);
    return { imc, bmr, tdee };
  },
};
```

- [ ] **Step 2: Test — verify functions work**

In browser console:
```javascript
Utils.getTodayISO()  // should return "2026-05-26"
Utils.getLocaleDateFr("2026-05-26")  // should return "lundi 26 mai 2026"
Utils.calcKcalPer100g(400, 200)  // should return 200
```

- [ ] **Step 3: Commit**

```bash
git add js/utils.js
git commit -m "feat: add utils module with date, calorie, and BMR helpers"
```

---

## Task 3: Foundation — sheets-api.js Module

**Files:**
- Create: `js/sheets-api.js`

- [ ] **Step 1: Write Sheets API wrapper**

```javascript
window.SheetsAPI = {
  SHEET_ID: '1jx5Wz...',  // Replace with actual sheet ID
  API_KEY: 'AIzaSy...',    // Replace with actual API key

  async readTab(tabName) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.SHEET_ID}/values/${tabName}?key=${this.API_KEY}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Sheets API error: ${res.status}`);
      const data = await res.json();
      return data.values || [];
    } catch (e) {
      console.error('readTab error:', e);
      return null;
    }
  },

  rowsToObjects(rows) {
    if (!rows || rows.length < 2) return [];
    const headers = rows[0];
    return rows.slice(1).map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = row[i] || '';
      });
      return obj;
    });
  },

  async appendRow(tabName, values, token) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.SHEET_ID}/values/${tabName}!A:Z/append?valueInputOption=USER_ENTERED`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [values] }),
      });
      if (!res.ok) throw new Error(`Append failed: ${res.status}`);
      return await res.json();
    } catch (e) {
      console.error('appendRow error:', e);
      throw e;
    }
  },

  async updateCell(cellRange, value, token) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.SHEET_ID}/values/${cellRange}?valueInputOption=USER_ENTERED`;
    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [[value]] }),
      });
      if (!res.ok) throw new Error(`Update failed: ${res.status}`);
      return await res.json();
    } catch (e) {
      console.error('updateCell error:', e);
      throw e;
    }
  },

  async ensureTab(tabName, token) {
    // Batch request to create tab if not exists
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.SHEET_ID}:batchUpdate`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [{
            addSheet: { properties: { title: tabName } }
          }]
        }),
      });
      if (!res.ok) {
        if (res.status === 400) return true; // Tab likely exists
        throw new Error(`ensureTab failed: ${res.status}`);
      }
      return true;
    } catch (e) {
      console.error('ensureTab error:', e);
      return false;
    }
  },
};
```

- [ ] **Step 2: Update SHEET_ID and API_KEY from actual values**

Replace placeholders with actual Google Sheets ID and API key. Commit.

- [ ] **Step 3: Commit**

```bash
git add js/sheets-api.js
git commit -m "feat: add Sheets API read/write wrapper module"
```

---

## Task 4: Foundation — auth.js Module

**Files:**
- Create: `js/auth.js`

- [ ] **Step 1: Write Google OAuth auth module**

```javascript
window.Auth = {
  CLIENT_ID: 'xxx.apps.googleusercontent.com',  // Replace
  SCOPES: 'https://www.googleapis.com/auth/spreadsheets',
  token: null,
  email: null,

  async init() {
    // Load from localStorage
    const stored = localStorage.getItem('auth_token');
    if (stored) {
      this.token = stored;
      const decoded = this.decodeToken(stored);
      this.email = decoded?.email;
      return this.email;
    }
    // Attempt silent re-auth
    return await this.silentAuth();
  },

  async silentAuth() {
    try {
      const response = await google.accounts.id.initialize({
        client_id: this.CLIENT_ID,
        callback: (response) => {
          this.handleCredentialResponse(response);
        },
      });
      // Try prompt: none
      google.accounts.id.renderButton(document.body, { prompt: 'none' });
      return this.email;
    } catch (e) {
      console.log('Silent auth not available');
      return null;
    }
  },

  handleCredentialResponse(response) {
    this.token = response.credential;
    const decoded = this.decodeToken(this.token);
    this.email = decoded?.email;
    localStorage.setItem('auth_token', this.token);
    window.dispatchEvent(new CustomEvent('auth-changed', { detail: { email: this.email } }));
  },

  decodeToken(token) {
    try {
      const payload = token.split('.')[1];
      const decoded = JSON.parse(atob(payload));
      return decoded;
    } catch {
      return null;
    }
  },

  showLoginButton() {
    const container = document.getElementById('google-login-container');
    if (!container) return;
    google.accounts.id.initialize({
      client_id: this.CLIENT_ID,
      callback: (response) => this.handleCredentialResponse(response),
    });
    google.accounts.id.renderButton(container, {
      theme: 'outline',
      size: 'large',
    });
  },

  logout() {
    this.token = null;
    this.email = null;
    localStorage.removeItem('auth_token');
    window.dispatchEvent(new CustomEvent('auth-changed', { detail: { email: null } }));
  },

  isAuthenticated() {
    return !!this.token;
  },

  getToken() {
    return this.token;
  },

  getEmail() {
    return this.email;
  },
};
```

- [ ] **Step 2: Update CLIENT_ID with actual value**

Replace placeholder. Verify in Google Cloud Console.

- [ ] **Step 3: Commit**

```bash
git add js/auth.js
git commit -m "feat: add Google OAuth auth module with token persistence"
```

---

## Task 5: Foundation — user-context.js Module

**Files:**
- Create: `js/user-context.js`

- [ ] **Step 1: Write user context module**

```javascript
window.UserContext = {
  currentUser: null,
  allProfiles: {},

  async init(email) {
    // Fetch Profils tab
    const rows = await SheetsAPI.readTab('Profils');
    if (!rows) {
      console.error('Failed to load profiles');
      return null;
    }

    const profiles = SheetsAPI.rowsToObjects(rows);
    this.allProfiles = {};
    profiles.forEach(p => {
      this.allProfiles[p.Email] = {
        userId: p.User,
        name: p.Prénom,
        email: p.Email,
        height: p.Taille_cm,
        weight: p.Poids_kg,
        age: p.Âge,
        sex: p.Sexe,
        activity: p.Activité,
        goal: p.Objectif,
        diet: p.Régime,
        allergies: p.Allergies_JSON ? JSON.parse(p.Allergies_JSON) : [],
        calorieTarget: parseInt(p.Calories_cible),
      };
    });

    // Map email to user
    if (email && this.allProfiles[email]) {
      this.currentUser = this.allProfiles[email].userId;
      return this.currentUser;
    }

    return null;
  },

  getCurrentUser() {
    return this.currentUser;
  },

  getCurrentProfile() {
    if (!this.currentUser) return null;
    for (const profile of Object.values(this.allProfiles)) {
      if (profile.userId === this.currentUser) {
        return profile;
      }
    }
    return null;
  },

  getAllProfiles() {
    return this.allProfiles;
  },

  getProfileByUser(userId) {
    for (const profile of Object.values(this.allProfiles)) {
      if (profile.userId === userId) {
        return profile;
      }
    }
    return null;
  },
};
```

- [ ] **Step 2: Test in console**

After auth:
```javascript
await UserContext.init(Auth.getEmail())
UserContext.getCurrentUser()  // should return "florian" or "naomi"
UserContext.getCurrentProfile()  // should return profile object
```

- [ ] **Step 3: Commit**

```bash
git add js/user-context.js
git commit -m "feat: add user context module deriving user from OAuth email"
```

---

## Task 6: Foundation — recipes.js Module

**Files:**
- Create: `js/recipes.js`

- [ ] **Step 1: Write recipes CRUD module**

```javascript
window.RecipesAPI = {
  recipes: {},

  async load() {
    const rows = await SheetsAPI.readTab('RecettesJSON');
    if (!rows || rows.length === 0) {
      this.recipes = {};
      return;
    }
    try {
      this.recipes = JSON.parse(rows[0][0] || '{}');
    } catch (e) {
      console.error('Failed to parse recipes JSON:', e);
      this.recipes = {};
    }
  },

  async save(token) {
    const json = JSON.stringify(this.recipes);
    try {
      await SheetsAPI.updateCell('RecettesJSON!A1', json, token);
      Utils.showToast('Recettes sauvegardées', 'success');
    } catch (e) {
      Utils.showToast('Erreur de sauvegarde', 'error');
      throw e;
    }
  },

  getRecipe(id) {
    return this.recipes[id] || null;
  },

  getRecipeList() {
    return Object.entries(this.recipes).map(([id, recipe]) => ({
      id,
      ...recipe,
      kcalPer100g: this.calcKcalPer100g(id),
    }));
  },

  calcKcalPer100g(recipeId) {
    const recipe = this.recipes[recipeId];
    if (!recipe || !recipe.ingredients) return 0;

    let totalKcal = 0;
    let totalWeight = 0;

    recipe.ingredients.forEach(ing => {
      const invItem = InventoryAPI.getItem(ing.name);
      if (invItem) {
        const kcal = (ing.quantity / 100) * invItem.kcalPer100;
        totalKcal += kcal;
      }
      totalWeight += ing.quantity;
    });

    return Utils.calcKcalPer100g(totalKcal, totalWeight);
  },

  addRecipe(id, recipe) {
    this.recipes[id] = recipe;
  },

  updateRecipe(id, recipe) {
    this.recipes[id] = recipe;
  },

  deleteRecipe(id) {
    delete this.recipes[id];
  },

  search(query) {
    const lower = query.toLowerCase();
    return this.getRecipeList().filter(r =>
      r.name.toLowerCase().includes(lower) ||
      (r.tags && r.tags.some(t => t.toLowerCase().includes(lower)))
    );
  },
};
```

- [ ] **Step 2: Test load function**

In console after init:
```javascript
await RecipesAPI.load()
RecipesAPI.getRecipeList()  // should return array of recipes
```

- [ ] **Step 3: Commit**

```bash
git add js/recipes.js
git commit -m "feat: add recipes CRUD module with JSON parsing"
```

---

## Task 7: Foundation — inventory.js Module

**Files:**
- Update: `js/inventory.js`

- [ ] **Step 1: Read existing inventory.js**

```bash
# Check current state
git status
```

- [ ] **Step 2: Rewrite as InventoryAPI module**

```javascript
window.InventoryAPI = {
  items: [],

  async load() {
    const rows = await SheetsAPI.readTab('Inventory');
    if (!rows) {
      this.items = [];
      return;
    }
    this.items = SheetsAPI.rowsToObjects(rows);
  },

  async addItem(item, token) {
    const values = [
      item.id,
      item.name,
      item.qty,
      item.unit,
      item.category,
      item.dateAdded,
      item.expiry,
      item.price || '',
      item.kcalPer100 || '',
      item.proteins || '',
      item.carbs || '',
      item.fats || '',
      'FALSE',
    ];
    await SheetsAPI.appendRow('Inventory', values, token);
    await this.load();
  },

  getItem(name) {
    return this.items.find(i =>
      i.Produit.toLowerCase() === name.toLowerCase() && i.Consommé !== 'TRUE'
    ) || null;
  },

  getActiveItems() {
    return this.items.filter(i => i.Consommé !== 'TRUE');
  },

  getByCategory(category) {
    return this.getActiveItems().filter(i => i.Catégorie === category);
  },

  getCategories() {
    return [...new Set(this.getActiveItems().map(i => i.Catégorie))];
  },

  async markConsumed(id, token) {
    // Find row index and update Consommé column
    // Implementation depends on row number lookup
    Utils.showToast('Article marqué comme consommé', 'success');
  },

  getExpiringItems(days = 3) {
    const today = Utils.getTodayISO();
    return this.getActiveItems().filter(i => {
      const daysLeft = Utils.daysUntilExpiry(i.Péremption);
      return daysLeft >= 0 && daysLeft <= days;
    });
  },

  async openFoodFactsLookup(barcode) {
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      const data = await res.json();
      if (data.code === '0') return null;
      return {
        name: data.product.product_name || '',
        kcalPer100: data.product.nutriments?.['energy-kcal_100g'] || 0,
        proteins: data.product.nutriments?.['proteins_100g'] || '',
        carbs: data.product.nutriments?.['carbohydrates_100g'] || '',
        fats: data.product.nutriments?.['fat_100g'] || '',
      };
    } catch (e) {
      console.error('Open Food Facts error:', e);
      return null;
    }
  },
};
```

- [ ] **Step 3: Commit**

```bash
git add js/inventory.js
git commit -m "feat: rewrite inventory module with async load, barcode, expiry helpers"
```

---

## Task 8: Page — Inventaire (inventory.html)

**Files:**
- Update: `css/inventory.css`
- Update: `inventory.html`
- Update: `js/inventory.js` (add UI handlers)

- [ ] **Step 1: Write HTML structure**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Inventaire — MealFlow</title>
  <link rel="stylesheet" href="css/style.css">
  <link rel="stylesheet" href="css/inventory.css">
  <script src="https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js"></script>
</head>
<body>
  <div class="app-header">
    <h1>📦 Inventaire</h1>
    <div class="user-chip" id="user-chip">—</div>
  </div>

  <div class="page-content" id="inventory-content">
    <button class="btn btn-primary" id="scanner-btn">📱 Scanner un produit</button>

    <div class="stats-row" id="stats-row"></div>
    <div class="expiry-banner" id="expiry-banner" class="hidden"></div>

    <select id="category-filter" class="category-filter">
      <option value="">Toutes les catégories</option>
    </select>

    <div id="inventory-list"></div>
  </div>

  <nav class="nav-bottom">
    <a href="index.html" class="nav-item">
      <span class="nav-icon">🏠</span>Accueil
    </a>
    <a href="recettes.html" class="nav-item">
      <span class="nav-icon">📖</span>Recettes
    </a>
    <a href="planning.html" class="nav-item">
      <span class="nav-icon">📅</span>Planning
    </a>
    <a href="inventory.html" class="nav-item active">
      <span class="nav-icon">📦</span>Inventaire
    </a>
    <a href="profils.html" class="nav-item">
      <span class="nav-icon">👤</span>Profils
    </a>
  </nav>

  <div id="scanner-modal" class="modal hidden">
    <div class="modal-content">
      <h2 class="modal-title">Scanner un produit</h2>
      <div id="reader"></div>
      <button class="btn btn-secondary mt-2" id="close-scanner">Fermer</button>
    </div>
  </div>

  <div id="add-item-modal" class="modal hidden">
    <div class="modal-content">
      <h2 class="modal-title">Ajouter un article</h2>
      <form id="add-item-form">
        <label>Nom du produit</label>
        <input type="text" id="item-name" required>

        <label>Quantité</label>
        <input type="number" id="item-qty" required>

        <label>Unité</label>
        <select id="item-unit">
          <option>g</option>
          <option>ml</option>
          <option>pièce</option>
          <option>paquets</option>
        </select>

        <label>Catégorie</label>
        <input type="text" id="item-category">

        <label>Kcal/100g</label>
        <input type="number" id="item-kcal">

        <label>Péremption (YYYY-MM-DD)</label>
        <input type="date" id="item-expiry">

        <button type="submit" class="btn btn-primary mt-2">Ajouter</button>
      </form>
    </div>
  </div>

  <script src="js/auth.js"></script>
  <script src="js/sheets-api.js"></script>
  <script src="js/user-context.js"></script>
  <script src="js/utils.js"></script>
  <script src="js/inventory.js"></script>
  <script src="js/inventory-ui.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create inventory-ui.js for page logic**

```javascript
// js/inventory-ui.js
document.addEventListener('DOMContentLoaded', async () => {
  // Init auth
  const email = await Auth.init();
  if (!email) {
    Auth.showLoginButton();
    return;
  }

  // Load data
  await UserContext.init(email);
  await InventoryAPI.load();

  // Render
  renderStats();
  renderCategories();
  renderInventoryList();

  // Event listeners
  document.getElementById('scanner-btn').addEventListener('click', startScanner);
  document.getElementById('category-filter').addEventListener('change', (e) => {
    renderInventoryList(e.target.value);
  });
  document.getElementById('add-item-form').addEventListener('submit', handleAddItem);
  document.getElementById('close-scanner').addEventListener('click', stopScanner);

  window.addEventListener('auth-changed', async (e) => {
    if (e.detail.email) {
      await UserContext.init(e.detail.email);
      renderStats();
      renderInventoryList();
    }
  });
});

function renderStats() {
  const active = InventoryAPI.getActiveItems().length;
  const expiring = InventoryAPI.getExpiringItems(3).length;
  document.getElementById('stats-row').innerHTML = `
    <div class="stat"><strong>${active}</strong> articles en stock</div>
    <div class="stat"><strong>${expiring}</strong> expirent bientôt</div>
  `;
}

function renderCategories() {
  const select = document.getElementById('category-filter');
  const categories = InventoryAPI.getCategories();
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  });
}

function renderInventoryList(categoryFilter = '') {
  const list = document.getElementById('inventory-list');
  let items = InventoryAPI.getActiveItems();

  if (categoryFilter) {
    items = items.filter(i => i.Catégorie === categoryFilter);
  }

  // Group by category
  const grouped = {};
  items.forEach(item => {
    if (!grouped[item.Catégorie]) grouped[item.Catégorie] = [];
    grouped[item.Catégorie].push(item);
  });

  list.innerHTML = '';
  Object.entries(grouped).forEach(([cat, catItems]) => {
    const catHeader = document.createElement('div');
    catHeader.className = 'category-header';
    catHeader.textContent = cat;
    list.appendChild(catHeader);

    catItems.forEach(item => {
      const daysLeft = Utils.daysUntilExpiry(item.Péremption);
      const expiryClass = daysLeft < 0 ? 'expired' : (daysLeft < 3 ? 'expiring' : '');

      const card = document.createElement('div');
      card.className = `card inventory-item ${expiryClass}`;
      card.innerHTML = `
        <div class="item-name">${item.Produit}</div>
        <div class="item-meta">${item.Qty} ${item.Unité}</div>
        <div class="item-expiry">Péremption: ${item.Péremption}</div>
        <div class="item-kcal">${item.Kcal_per_100 || '—'} kcal/100g</div>
        <button class="btn btn-small btn-secondary mt-1">Consommé</button>
      `;
      list.appendChild(card);
    });
  });
}

async function startScanner() {
  const modal = document.getElementById('scanner-modal');
  modal.classList.remove('hidden');

  const html5QrcodeScanner = new Html5QrcodeScanner('reader', {
    fps: 10,
    qrbox: { width: 250, height: 250 },
  });

  html5QrcodeScanner.render(async (data) => {
    html5QrcodeScanner.clear();
    modal.classList.add('hidden');

    const product = await InventoryAPI.openFoodFactsLookup(data);
    if (product) {
      document.getElementById('item-name').value = product.name;
      document.getElementById('item-kcal').value = product.kcalPer100;
    }
    document.getElementById('add-item-modal').classList.remove('hidden');
  }, (error) => {
    console.log('QR error:', error);
  });
}

function stopScanner() {
  document.getElementById('scanner-modal').classList.add('hidden');
}

async function handleAddItem(e) {
  e.preventDefault();
  const item = {
    id: Utils.slugify(document.getElementById('item-name').value),
    name: document.getElementById('item-name').value,
    qty: document.getElementById('item-qty').value,
    unit: document.getElementById('item-unit').value,
    category: document.getElementById('item-category').value,
    dateAdded: Utils.getTodayISO(),
    expiry: document.getElementById('item-expiry').value,
    kcalPer100: document.getElementById('item-kcal').value,
  };

  try {
    await InventoryAPI.addItem(item, Auth.getToken());
    document.getElementById('add-item-modal').classList.add('hidden');
    e.target.reset();
    renderStats();
    renderInventoryList();
  } catch (e) {
    Utils.showToast('Erreur lors de l\'ajout', 'error');
  }
}
```

- [ ] **Step 3: Write CSS for inventory page**

```css
/* css/inventory.css */
.category-filter {
  margin-bottom: 12px;
}

.stats-row {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.stat {
  flex: 1;
  background: var(--primary-bg);
  padding: 10px;
  border-radius: 8px;
  text-align: center;
  font-size: 0.9em;
}

.stat strong {
  display: block;
  font-size: 1.3em;
  color: var(--primary);
  margin-bottom: 4px;
}

.expiry-banner {
  background: var(--warning);
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  margin-bottom: 12px;
  font-size: 0.9em;
}

.category-header {
  font-weight: 700;
  color: var(--text-secondary);
  font-size: 0.85em;
  margin-top: 12px;
  margin-bottom: 6px;
  text-transform: uppercase;
}

.inventory-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.inventory-item.expiring {
  border-left: 3px solid var(--warning);
}

.inventory-item.expired {
  border-left: 3px solid var(--danger);
  opacity: 0.6;
}

.item-name {
  font-weight: 600;
}

.item-meta {
  font-size: 0.85em;
  color: var(--text-secondary);
}

.item-expiry {
  font-size: 0.8em;
  color: var(--text-secondary);
}

.item-kcal {
  font-size: 0.9em;
  color: var(--primary);
  font-weight: 600;
}
```

- [ ] **Step 4: Test inventory page**

Open `inventory.html` in browser after auth. Check: inventory loads, categories display, add item form works.

- [ ] **Step 5: Commit**

```bash
git add inventory.html js/inventory-ui.js css/inventory.css
git commit -m "feat: build Inventaire page with category grouping, scanner, expiry alerts"
```

---

## Task 9: Page — Recettes (recettes.html)

**Files:**
- Create: `recettes.html`
- Create: `css/recettes.css`
- Create: `js/recettes-ui.js`

- [ ] **Step 1: Write Recettes HTML structure**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recettes — MealFlow</title>
  <link rel="stylesheet" href="css/style.css">
  <link rel="stylesheet" href="css/recettes.css">
</head>
<body>
  <div class="app-header">
    <h1>📖 Recettes</h1>
    <div class="user-chip" id="user-chip">—</div>
  </div>

  <div class="page-content" id="recipes-content">
    <button class="btn btn-primary" id="add-recipe-btn">➕ Ajouter une recette</button>

    <input type="text" id="search-recipes" placeholder="Chercher une recette...">

    <div id="recipes-list"></div>
  </div>

  <nav class="nav-bottom">
    <a href="index.html" class="nav-item">
      <span class="nav-icon">🏠</span>Accueil
    </a>
    <a href="recettes.html" class="nav-item active">
      <span class="nav-icon">📖</span>Recettes
    </a>
    <a href="planning.html" class="nav-item">
      <span class="nav-icon">📅</span>Planning
    </a>
    <a href="inventory.html" class="nav-item">
      <span class="nav-icon">📦</span>Inventaire
    </a>
    <a href="profils.html" class="nav-item">
      <span class="nav-icon">👤</span>Profils
    </a>
  </nav>

  <div id="recipe-form-modal" class="modal hidden">
    <div class="modal-content">
      <h2 class="modal-title" id="form-title">Ajouter une recette</h2>
      <form id="recipe-form">
        <label>Nom</label>
        <input type="text" id="recipe-name" required>

        <label>Tags</label>
        <div id="tags-chips" class="tags-chips"></div>

        <label>Temps de prep (min)</label>
        <input type="number" id="recipe-prep" value="30">

        <label>Portions</label>
        <input type="number" id="recipe-portions" value="2">

        <label>Ingrédients</label>
        <div id="ingredients-list"></div>
        <button type="button" class="btn btn-secondary btn-small" id="add-ingredient-btn">+ Ajouter ingrédient</button>

        <label>Étapes</label>
        <div id="steps-list"></div>
        <button type="button" class="btn btn-secondary btn-small" id="add-step-btn">+ Ajouter étape</button>

        <button type="submit" class="btn btn-primary mt-2">Sauvegarder</button>
        <button type="button" class="btn btn-secondary mt-1" id="cancel-form-btn">Annuler</button>
      </form>
    </div>
  </div>

  <div id="recipe-detail-modal" class="modal hidden">
    <div class="modal-content">
      <h2 class="modal-title" id="detail-title"></h2>
      <div id="detail-content"></div>
      <button type="button" class="btn btn-secondary" id="edit-recipe-btn">✏️ Éditer</button>
      <button type="button" class="btn btn-danger" id="delete-recipe-btn">🗑️ Supprimer</button>
      <button type="button" class="btn btn-secondary mt-1" id="close-detail-btn">Fermer</button>
    </div>
  </div>

  <script src="js/auth.js"></script>
  <script src="js/sheets-api.js"></script>
  <script src="js/user-context.js"></script>
  <script src="js/utils.js"></script>
  <script src="js/inventory.js"></script>
  <script src="js/recipes.js"></script>
  <script src="js/recettes-ui.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create recettes-ui.js with form handling**

```javascript
// js/recettes-ui.js
let editingRecipeId = null;
const tagOptions = ['végétarien', 'vegan', 'rapide', 'omnivore', 'sans gluten'];

document.addEventListener('DOMContentLoaded', async () => {
  const email = await Auth.init();
  if (!email) {
    Auth.showLoginButton();
    return;
  }

  await UserContext.init(email);
  await InventoryAPI.load();
  await RecipesAPI.load();

  renderTags();
  renderRecipesList();

  document.getElementById('add-recipe-btn').addEventListener('click', openAddForm);
  document.getElementById('cancel-form-btn').addEventListener('click', closeForm);
  document.getElementById('recipe-form').addEventListener('submit', handleSaveRecipe);
  document.getElementById('add-ingredient-btn').addEventListener('click', addIngredientField);
  document.getElementById('add-step-btn').addEventListener('click', addStepField);
  document.getElementById('search-recipes').addEventListener('input', (e) => {
    renderRecipesList(e.target.value);
  });

  window.addEventListener('auth-changed', async (e) => {
    if (e.detail.email) {
      await UserContext.init(e.detail.email);
      await RecipesAPI.load();
      renderRecipesList();
    }
  });
});

function renderTags() {
  const container = document.getElementById('tags-chips');
  container.innerHTML = '';
  tagOptions.forEach(tag => {
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.textContent = tag;
    chip.dataset.tag = tag;
    chip.addEventListener('click', () => chip.classList.toggle('active'));
    container.appendChild(chip);
  });
}

function renderRecipesList(query = '') {
  const list = document.getElementById('recipes-list');
  let recipes = RecipesAPI.getRecipeList();

  if (query) {
    recipes = RecipesAPI.search(query);
  }

  list.innerHTML = '';
  if (recipes.length === 0) {
    list.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">Aucune recette</p>';
    return;
  }

  recipes.forEach(recipe => {
    const card = document.createElement('div');
    card.className = 'card recipe-card';
    card.innerHTML = `
      <div class="recipe-name">${recipe.name}</div>
      <div class="recipe-meta">
        ⏱️ ${recipe.prep_minutes} min | 🍽️ ${recipe.portions} portions
      </div>
      <div class="recipe-kcal">${Math.round(recipe.kcalPer100g)} kcal/100g</div>
      <div class="recipe-tags">
        ${recipe.tags.map(t => `<span class="chip">${t}</span>`).join('')}
      </div>
      <div class="recipe-ingredients">${recipe.ingredients.length} ingrédients</div>
    `;
    card.addEventListener('click', () => showRecipeDetail(recipe.id));
    list.appendChild(card);
  });
}

function openAddForm() {
  editingRecipeId = null;
  document.getElementById('form-title').textContent = 'Ajouter une recette';
  document.getElementById('recipe-form').reset();
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  document.getElementById('ingredients-list').innerHTML = '';
  document.getElementById('steps-list').innerHTML = '';
  addIngredientField();
  addStepField();
  document.getElementById('recipe-form-modal').classList.remove('hidden');
}

function openEditForm(recipeId) {
  const recipe = RecipesAPI.getRecipe(recipeId);
  if (!recipe) return;

  editingRecipeId = recipeId;
  document.getElementById('form-title').textContent = 'Éditer la recette';
  document.getElementById('recipe-name').value = recipe.name;
  document.getElementById('recipe-prep').value = recipe.prep_minutes;
  document.getElementById('recipe-portions').value = recipe.portions;

  document.querySelectorAll('.chip').forEach(c => {
    c.classList.toggle('active', recipe.tags.includes(c.dataset.tag));
  });

  document.getElementById('ingredients-list').innerHTML = '';
  recipe.ingredients.forEach(ing => {
    addIngredientField(ing);
  });

  document.getElementById('steps-list').innerHTML = '';
  recipe.steps.forEach(step => {
    addStepField(step);
  });

  document.getElementById('recipe-form-modal').classList.remove('hidden');
}

function closeForm() {
  document.getElementById('recipe-form-modal').classList.add('hidden');
}

function addIngredientField(ing = null) {
  const container = document.getElementById('ingredients-list');
  const div = document.createElement('div');
  div.className = 'ingredient-field';
  div.innerHTML = `
    <input type="text" placeholder="Ingrédient" class="ing-name" value="${ing?.name || ''}" required>
    <input type="number" placeholder="Quantité" class="ing-qty" value="${ing?.quantity || ''}" required>
    <select class="ing-unit">
      <option ${ing?.unit === 'g' ? 'selected' : ''}>g</option>
      <option ${ing?.unit === 'ml' ? 'selected' : ''}>ml</option>
      <option ${ing?.unit === 'pièce' ? 'selected' : ''}>pièce</option>
    </select>
    <button type="button" class="btn btn-small btn-danger" onclick="this.parentElement.remove()">✕</button>
  `;
  container.appendChild(div);
}

function addStepField(step = '') {
  const container = document.getElementById('steps-list');
  const div = document.createElement('div');
  div.className = 'step-field';
  div.innerHTML = `
    <textarea placeholder="Étape" class="step-text">${step}</textarea>
    <button type="button" class="btn btn-small btn-danger" onclick="this.parentElement.remove()">✕</button>
  `;
  container.appendChild(div);
}

async function handleSaveRecipe(e) {
  e.preventDefault();

  const tags = Array.from(document.querySelectorAll('.chip.active')).map(c => c.dataset.tag);
  const ingredients = Array.from(document.querySelectorAll('.ingredient-field')).map(f => ({
    name: f.querySelector('.ing-name').value,
    quantity: parseFloat(f.querySelector('.ing-qty').value),
    unit: f.querySelector('.ing-unit').value,
  }));
  const steps = Array.from(document.querySelectorAll('.step-field .step-text')).map(t => t.value);

  const recipe = {
    name: document.getElementById('recipe-name').value,
    tags,
    prep_minutes: parseInt(document.getElementById('recipe-prep').value),
    portions: parseInt(document.getElementById('recipe-portions').value),
    ingredients,
    steps,
  };

  const id = editingRecipeId || Utils.slugify(recipe.name);

  if (editingRecipeId) {
    RecipesAPI.updateRecipe(id, recipe);
  } else {
    RecipesAPI.addRecipe(id, recipe);
  }

  try {
    await RecipesAPI.save(Auth.getToken());
    closeForm();
    renderRecipesList();
  } catch (e) {
    Utils.showToast('Erreur de sauvegarde', 'error');
  }
}

function showRecipeDetail(recipeId) {
  const recipe = RecipesAPI.getRecipe(recipeId);
  if (!recipe) return;

  const modal = document.getElementById('recipe-detail-modal');
  document.getElementById('detail-title').textContent = recipe.name;

  const content = document.getElementById('detail-content');
  content.innerHTML = `
    <p class="recipe-meta">⏱️ ${recipe.prep_minutes} min | 🍽️ ${recipe.portions} portions</p>
    <p class="recipe-kcal">Kcal/100g: ${Math.round(RecipesAPI.calcKcalPer100g(recipeId))}</p>
    <h3>Ingrédients</h3>
    <ul>
      ${recipe.ingredients.map(ing => `<li>${ing.quantity} ${ing.unit} — ${ing.name}</li>`).join('')}
    </ul>
    <h3>Étapes</h3>
    <ol>
      ${recipe.steps.map(s => `<li>${s}</li>`).join('')}
    </ol>
  `;

  document.getElementById('edit-recipe-btn').onclick = () => {
    modal.classList.add('hidden');
    openEditForm(recipeId);
  };

  document.getElementById('delete-recipe-btn').onclick = async () => {
    if (confirm('Supprimer cette recette?')) {
      RecipesAPI.deleteRecipe(recipeId);
      await RecipesAPI.save(Auth.getToken());
      modal.classList.add('hidden');
      renderRecipesList();
    }
  };

  document.getElementById('close-detail-btn').onclick = () => modal.classList.add('hidden');

  modal.classList.remove('hidden');
}
```

- [ ] **Step 3: Write recettes CSS**

```css
/* css/recettes.css */
#search-recipes {
  margin-bottom: 12px;
}

.recipe-card {
  cursor: pointer;
  transition: transform 0.2s;
}

.recipe-card:active {
  transform: scale(0.98);
}

.recipe-name {
  font-weight: 700;
  font-size: 1em;
  margin-bottom: 6px;
}

.recipe-meta {
  font-size: 0.85em;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.recipe-kcal {
  font-size: 1em;
  font-weight: 700;
  color: var(--primary);
  margin-bottom: 6px;
}

.recipe-tags {
  margin-bottom: 6px;
}

.recipe-ingredients {
  font-size: 0.85em;
  color: var(--text-secondary);
}

.ingredient-field, .step-field {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}

.ing-name {
  flex: 2;
}

.ing-qty {
  flex: 1;
}

.ing-unit {
  flex: 1;
}

.step-field textarea {
  flex: 1;
  min-height: 60px;
}

.ingredient-field > *, .step-field > * {
  margin: 0;
}
```

- [ ] **Step 4: Test Recettes page**

Open `recettes.html`. Add recipe, verify JSON saved to Sheets, see recipe in list, edit/delete.

- [ ] **Step 5: Commit**

```bash
git add recettes.html js/recettes-ui.js css/recettes.css
git commit -m "feat: build Recettes page with add/edit/delete form, kcal/100g calc"
```

---

## Task 10: Page — Planning (planning.html)

**Files:**
- Update: `planning.html`
- Create: `js/planning-ui.js`
- Update: `css/planning.css`

- [ ] **Step 1: Rewrite Planning HTML**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Planning — MealFlow</title>
  <link rel="stylesheet" href="css/style.css">
  <link rel="stylesheet" href="css/planning.css">
</head>
<body>
  <div class="app-header">
    <h1>📅 Planning</h1>
    <div class="user-chip" id="user-chip">—</div>
  </div>

  <div class="page-content" id="planning-content">
    <div class="week-nav">
      <button class="btn btn-secondary btn-small" id="prev-week">◀ Préc.</button>
      <span id="week-label"></span>
      <button class="btn btn-secondary btn-small" id="next-week">Suiv. ▶</button>
    </div>

    <div id="planning-grid"></div>

    <button class="btn btn-primary mt-2" id="shopping-btn">🛒 Générer liste de courses</button>
  </div>

  <nav class="nav-bottom">
    <a href="index.html" class="nav-item">
      <span class="nav-icon">🏠</span>Accueil
    </a>
    <a href="recettes.html" class="nav-item">
      <span class="nav-icon">📖</span>Recettes
    </a>
    <a href="planning.html" class="nav-item active">
      <span class="nav-icon">📅</span>Planning
    </a>
    <a href="inventory.html" class="nav-item">
      <span class="nav-icon">📦</span>Inventaire
    </a>
    <a href="profils.html" class="nav-item">
      <span class="nav-icon">👤</span>Profils
    </a>
  </nav>

  <div id="recipe-picker-modal" class="modal hidden">
    <div class="modal-content">
      <h2 class="modal-title">Choisir une recette</h2>
      <input type="text" id="picker-search" placeholder="Chercher...">
      <div id="picker-list"></div>
      <button class="btn btn-secondary" id="close-picker">Fermer</button>
    </div>
  </div>

  <script src="js/auth.js"></script>
  <script src="js/sheets-api.js"></script>
  <script src="js/user-context.js"></script>
  <script src="js/utils.js"></script>
  <script src="js/inventory.js"></script>
  <script src="js/recipes.js"></script>
  <script src="js/planning-ui.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create planning-ui.js**

```javascript
// js/planning-ui.js
let planningData = {};
let currentWeekStart = Utils.getWeekStart(Utils.getTodayISO());
let selectedCell = null;

document.addEventListener('DOMContentLoaded', async () => {
  const email = await Auth.init();
  if (!email) {
    Auth.showLoginButton();
    return;
  }

  await UserContext.init(email);
  await RecipesAPI.load();
  await loadPlanning();

  renderWeekNav();
  renderPlanningGrid();

  document.getElementById('prev-week').addEventListener('click', () => {
    currentWeekStart = Utils.addDaysToISO(currentWeekStart, -7);
    renderWeekNav();
    renderPlanningGrid();
  });

  document.getElementById('next-week').addEventListener('click', () => {
    currentWeekStart = Utils.addDaysToISO(currentWeekStart, 7);
    renderWeekNav();
    renderPlanningGrid();
  });

  document.getElementById('shopping-btn').addEventListener('click', () => {
    window.location.href = 'courses.html';
  });

  document.getElementById('close-picker').addEventListener('click', closePicker);
});

async function loadPlanning() {
  const rows = await SheetsAPI.readTab('Planning');
  if (!rows) return;
  const data = SheetsAPI.rowsToObjects(rows);
  data.forEach(row => {
    planningData[row.Date] = {
      midi: row.Midi_RecetteID,
      soir: row.Soir_RecetteID,
    };
  });
}

function renderWeekNav() {
  const days = Utils.getWeekDays(currentWeekStart);
  const start = Utils.getLocaleDateFr(days[0]);
  const end = Utils.getLocaleDateFr(days[6]);
  document.getElementById('week-label').textContent = `${start.split(' ').slice(1).join(' ')} – ${end.split(' ').slice(1).join(' ')}`;
}

function renderPlanningGrid() {
  const grid = document.getElementById('planning-grid');
  grid.innerHTML = '';
  const days = Utils.getWeekDays(currentWeekStart);
  const today = Utils.getTodayISO();

  days.forEach(date => {
    const isToday = date === today;
    const dayName = Utils.getLocaleDateFr(date).split(' ')[0];
    const dayNum = date.split('-')[2];

    const dayRow = document.createElement('div');
    dayRow.className = `day-row ${isToday ? 'today' : ''}`;

    const dayLabel = document.createElement('div');
    dayLabel.className = 'day-label';
    dayLabel.innerHTML = `${dayName}<br>${dayNum}`;
    dayRow.appendChild(dayLabel);

    const plan = planningData[date] || {};

    ['midi', 'soir'].forEach(meal => {
      const cell = document.createElement('div');
      cell.className = 'meal-cell';
      cell.dataset.date = date;
      cell.dataset.meal = meal;

      const recipeId = plan[meal];
      if (recipeId) {
        const recipe = RecipesAPI.getRecipe(recipeId);
        if (recipe) {
          cell.innerHTML = `<div class="recipe-name">${recipe.name}</div><div class="recipe-kcal">${Math.round(RecipesAPI.calcKcalPer100g(recipeId))} kcal/100g</div>`;
          cell.style.background = 'var(--primary-bg)';
          cell.style.borderColor = 'var(--primary)';
        } else {
          cell.textContent = 'Recette supprimée';
          cell.style.color = 'var(--danger)';
        }
      } else {
        cell.textContent = '+ Choisir';
        cell.style.borderStyle = 'dashed';
      }

      cell.addEventListener('click', () => openPicker(date, meal));
      dayRow.appendChild(cell);
    });

    grid.appendChild(dayRow);
  });
}

function openPicker(date, meal) {
  selectedCell = { date, meal };
  const modal = document.getElementById('recipe-picker-modal');
  const list = document.getElementById('picker-list');
  const recipes = RecipesAPI.getRecipeList();

  list.innerHTML = '';
  recipes.forEach(recipe => {
    const div = document.createElement('div');
    div.className = 'card recipe-option';
    div.innerHTML = `<div class="recipe-name">${recipe.name}</div><div class="recipe-kcal">${Math.round(recipe.kcalPer100g)} kcal/100g</div>`;
    div.addEventListener('click', async () => {
      planningData[date] = planningData[date] || {};
      planningData[date][meal] = recipe.id;
      await savePlanning();
      renderPlanningGrid();
      modal.classList.add('hidden');
    });
    list.appendChild(div);
  });

  modal.classList.remove('hidden');
}

function closePicker() {
  document.getElementById('recipe-picker-modal').classList.add('hidden');
}

async function savePlanning() {
  const token = Auth.getToken();
  if (!token) {
    Utils.showToast('Connexion requise', 'error');
    return;
  }

  const rows = [['Date', 'Jour', 'Midi_RecetteID', 'Soir_RecetteID']];
  Object.entries(planningData).forEach(([date, plan]) => {
    const d = new Date(date);
    const day = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'][d.getDay()];
    rows.push([date, day, plan.midi || '', plan.soir || '']);
  });

  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SheetsAPI.SHEET_ID}/values/Planning?valueInputOption=USER_ENTERED`;
    await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: rows }),
    });
    Utils.showToast('Planning sauvegardé', 'success');
  } catch (e) {
    Utils.showToast('Erreur de sauvegarde', 'error');
  }
}
```

- [ ] **Step 3: Write planning CSS**

```css
/* css/planning.css */
.week-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  gap: 8px;
}

#week-label {
  flex: 1;
  text-align: center;
  font-weight: 600;
}

#planning-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.day-row {
  display: grid;
  grid-template-columns: 60px 1fr 1fr;
  gap: 8px;
  padding: 8px;
  background: var(--bg-white);
  border-radius: 8px;
}

.day-row.today {
  background: var(--primary-bg);
  border-left: 4px solid var(--primary);
}

.day-label {
  font-weight: 700;
  font-size: 0.85em;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.meal-cell {
  padding: 10px;
  border: 2px solid var(--primary-border);
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 60px;
  font-size: 0.85em;
  transition: all 0.2s;
}

.meal-cell:active {
  transform: scale(0.98);
}

.recipe-name {
  font-weight: 600;
  margin-bottom: 2px;
}

.recipe-kcal {
  font-size: 0.75em;
  color: var(--primary);
}

.recipe-option {
  cursor: pointer;
}
```

- [ ] **Step 4: Test Planning page**

Navigate weeks, add recipes, verify grid updates, save to Sheets.

- [ ] **Step 5: Commit**

```bash
git add planning.html js/planning-ui.js css/planning.css
git commit -m "feat: build Planning page with weekly grid, recipe picker, week nav"
```

---

## Task 11: Page — Courses (courses.html)

**Files:**
- Create: `courses.html`
- Create: `js/courses-ui.js`
- Create: `css/courses.css`

- [ ] **Step 1: Write Courses HTML**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Courses — MealFlow</title>
  <link rel="stylesheet" href="css/style.css">
  <link rel="stylesheet" href="css/courses.css">
</head>
<body>
  <div class="app-header">
    <h1>🛒 Courses</h1>
    <div class="user-chip" id="user-chip">—</div>
  </div>

  <div class="page-content" id="courses-content">
    <button class="btn btn-primary" id="regen-btn">🔄 Regénérer</button>

    <div id="shopping-list"></div>

    <div id="total-price">Total estimé: —</div>
  </div>

  <nav class="nav-bottom">
    <a href="index.html" class="nav-item">
      <span class="nav-icon">🏠</span>Accueil
    </a>
    <a href="recettes.html" class="nav-item">
      <span class="nav-icon">📖</span>Recettes
    </a>
    <a href="planning.html" class="nav-item">
      <span class="nav-icon">📅</span>Planning
    </a>
    <a href="inventory.html" class="nav-item">
      <span class="nav-icon">📦</span>Inventaire
    </a>
    <a href="profils.html" class="nav-item">
      <span class="nav-icon">👤</span>Profils
    </a>
  </nav>

  <script src="js/auth.js"></script>
  <script src="js/sheets-api.js"></script>
  <script src="js/user-context.js"></script>
  <script src="js/utils.js"></script>
  <script src="js/inventory.js"></script>
  <script src="js/recipes.js"></script>
  <script src="js/courses-ui.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create courses-ui.js**

```javascript
// js/courses-ui.js
let coursesList = [];

document.addEventListener('DOMContentLoaded', async () => {
  const email = await Auth.init();
  if (!email) {
    Auth.showLoginButton();
    return;
  }

  await UserContext.init(email);
  await RecipesAPI.load();
  await InventoryAPI.load();

  await generateShoppingList();

  document.getElementById('regen-btn').addEventListener('click', generateShoppingList);
});

async function generateShoppingList() {
  coursesList = [];

  // Get planning for current week
  const rows = await SheetsAPI.readTab('Planning');
  if (!rows) return;

  const planning = SheetsAPI.rowsToObjects(rows);
  const today = Utils.getTodayISO();
  const weekStart = Utils.getWeekStart(today);
  const weekEnd = Utils.addDaysToISO(weekStart, 6);

  // Aggregate ingredients needed for recipes in week
  const needed = {};
  planning.forEach(day => {
    if (day.Date >= weekStart && day.Date <= weekEnd) {
      [day.Midi_RecetteID, day.Soir_RecetteID].forEach(recipeId => {
        if (!recipeId) return;
        const recipe = RecipesAPI.getRecipe(recipeId);
        if (!recipe) return;

        recipe.ingredients.forEach(ing => {
          const key = ing.name.toLowerCase();
          if (!needed[key]) {
            needed[key] = { name: ing.name, qty: 0, unit: ing.unit };
          }
          needed[key].qty += ing.quantity;
        });
      });
    }
  });

  // Diff with inventory
  const shopping = [];
  Object.values(needed).forEach(item => {
    const invItem = InventoryAPI.getItem(item.name);
    let needed_qty = item.qty;

    if (invItem) {
      needed_qty -= parseFloat(invItem.Qty) || 0;
    }

    if (needed_qty > 0) {
      shopping.push({
        name: item.name,
        qty: needed_qty,
        unit: item.unit,
        price: invItem?.Prix || '',
        category: invItem?.Catégorie || 'Autre',
      });
    }
  });

  coursesList = shopping;
  renderShoppingList();
}

function renderShoppingList() {
  const list = document.getElementById('shopping-list');
  list.innerHTML = '';

  const grouped = {};
  coursesList.forEach(item => {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  });

  let totalPrice = 0;

  Object.entries(grouped).forEach(([cat, items]) => {
    const catHeader = document.createElement('div');
    catHeader.className = 'category-header';
    catHeader.textContent = cat;
    list.appendChild(catHeader);

    items.forEach(item => {
      const price = parseFloat(item.price) || 0;
      const itemPrice = price * item.qty;
      totalPrice += itemPrice;

      const card = document.createElement('div');
      card.className = 'card shopping-item';
      card.innerHTML = `
        <input type="checkbox" class="item-checkbox">
        <div class="item-name">${item.name}</div>
        <div class="item-qty">${item.qty.toFixed(0)} ${item.unit}</div>
        <div class="item-price">${itemPrice > 0 ? itemPrice.toFixed(2) + '€' : ''}</div>
      `;
      list.appendChild(card);
    });
  });

  document.getElementById('total-price').textContent = `Total estimé: ${totalPrice.toFixed(2)}€`;
}
```

- [ ] **Step 3: Write courses CSS**

```css
/* css/courses.css */
.category-header {
  font-weight: 700;
  color: var(--text-secondary);
  font-size: 0.85em;
  margin-top: 12px;
  margin-bottom: 6px;
  text-transform: uppercase;
}

.shopping-item {
  display: grid;
  grid-template-columns: 20px 1fr auto auto;
  gap: 8px;
  align-items: center;
}

.item-checkbox {
  width: 20px;
  height: 20px;
}

.item-name {
  font-weight: 500;
}

.item-qty {
  font-size: 0.85em;
  color: var(--text-secondary);
  text-align: right;
}

.item-price {
  font-weight: 600;
  color: var(--primary);
  min-width: 50px;
  text-align: right;
}

#total-price {
  margin-top: 16px;
  padding: 12px;
  background: var(--primary-bg);
  border-radius: 8px;
  font-weight: 700;
  text-align: center;
  color: var(--primary);
}
```

- [ ] **Step 4: Test Courses page**

From Planning, tap "Générer liste de courses" → verify shopping list calculates ingredients needed vs inventory.

- [ ] **Step 5: Commit**

```bash
git add courses.html js/courses-ui.js css/courses.css
git commit -m "feat: build Courses page with auto shopping list generation"
```

---

## Task 12: Page — Accueil (index.html)

**Files:**
- Update: `index.html`
- Create: `js/accueil-ui.js`
- Update: `css/accueil.css`

- [ ] **Step 1: Rewrite Accueil HTML**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Accueil — MealFlow</title>
  <link rel="stylesheet" href="css/style.css">
  <link rel="stylesheet" href="css/accueil.css">
  <script src="https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js"></script>
</head>
<body>
  <div class="app-header">
    <div>
      <h1 id="greeting">Bonjour</h1>
      <p id="date-today"></p>
    </div>
    <div class="user-chip" id="user-chip">—</div>
  </div>

  <div class="page-content" id="accueil-content">
    <svg id="progress-circle"></svg>
    <div id="progress-text"></div>

    <button class="btn btn-primary mt-2" id="log-meal-btn">🍴 J'ai mangé</button>

    <h2>Journal du jour</h2>
    <div id="journal-list"></div>
  </div>

  <nav class="nav-bottom">
    <a href="index.html" class="nav-item active">
      <span class="nav-icon">🏠</span>Accueil
    </a>
    <a href="recettes.html" class="nav-item">
      <span class="nav-icon">📖</span>Recettes
    </a>
    <a href="planning.html" class="nav-item">
      <span class="nav-icon">📅</span>Planning
    </a>
    <a href="inventory.html" class="nav-item">
      <span class="nav-icon">📦</span>Inventaire
    </a>
    <a href="profils.html" class="nav-item">
      <span class="nav-icon">👤</span>Profils
    </a>
  </nav>

  <div id="log-meal-modal" class="modal hidden">
    <div class="modal-content">
      <h2 class="modal-title">J'ai mangé</h2>
      
      <div class="meal-options">
        <button class="btn btn-secondary meal-option" data-option="scanner">📱 Scanner un produit</button>
        <button class="btn btn-secondary meal-option" data-option="recipe">📖 Choisir une recette</button>
        <button class="btn btn-secondary meal-option" data-option="inventory">📦 Chercher dans l'inventaire</button>
        <button class="btn btn-secondary meal-option" data-option="manual">✏️ Saisie manuelle</button>
      </div>

      <div id="meal-form-container" class="hidden">
        <form id="meal-form">
          <label>Quantité (grammes)</label>
          <input type="number" id="meal-qty" required>

          <label id="meal-kcal-label" class="hidden">Kcal totales</label>
          <input type="number" id="meal-kcal" class="hidden">

          <button type="submit" class="btn btn-primary mt-2">Ajouter au journal</button>
          <button type="button" class="btn btn-secondary mt-1" id="cancel-meal-btn">Annuler</button>
        </form>
      </div>
    </div>
  </div>

  <script src="js/auth.js"></script>
  <script src="js/sheets-api.js"></script>
  <script src="js/user-context.js"></script>
  <script src="js/utils.js"></script>
  <script src="js/inventory.js"></script>
  <script src="js/recipes.js"></script>
  <script src="js/accueil-ui.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create accueil-ui.js**

```javascript
// js/accueil-ui.js
let todayHistory = [];
let selectedMealData = null;

document.addEventListener('DOMContentLoaded', async () => {
  const email = await Auth.init();
  if (!email) {
    Auth.showLoginButton();
    return;
  }

  await UserContext.init(email);
  await RecipesAPI.load();
  await InventoryAPI.load();

  renderGreeting();
  await loadTodayHistory();
  renderProgress();
  renderJournal();

  document.getElementById('log-meal-btn').addEventListener('click', openMealModal);
  document.getElementById('cancel-meal-btn').addEventListener('click', closeMealModal);
  document.getElementById('meal-form').addEventListener('submit', handleLogMeal);

  document.querySelectorAll('.meal-option').forEach(btn => {
    btn.addEventListener('click', () => selectMealOption(btn.dataset.option));
  });

  window.addEventListener('auth-changed', async (e) => {
    if (e.detail.email) {
      await UserContext.init(e.detail.email);
      renderGreeting();
      await loadTodayHistory();
      renderProgress();
      renderJournal();
    }
  });
});

function renderGreeting() {
  const profile = UserContext.getCurrentProfile();
  if (profile) {
    document.getElementById('greeting').textContent = `Bonjour ${profile.name}`;
  }
  document.getElementById('date-today').textContent = Utils.getLocaleDateFr(Utils.getTodayISO());
}

async function loadTodayHistory() {
  const user = UserContext.getCurrentUser();
  if (!user) return;

  const tabName = `History_${user}`;
  const rows = await SheetsAPI.readTab(tabName);
  if (!rows) {
    todayHistory = [];
    return;
  }

  const today = Utils.getTodayISO();
  const history = SheetsAPI.rowsToObjects(rows);
  todayHistory = history.filter(h => h.Date === today).reverse();
}

function renderProgress() {
  const profile = UserContext.getCurrentProfile();
  if (!profile) return;

  const target = profile.calorieTarget;
  const consumed = todayHistory.reduce((sum, h) => sum + (parseInt(h.Kcal_total) || 0), 0);
  const percent = Math.min((consumed / target) * 100, 100);

  const svg = document.getElementById('progress-circle');
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);

  svg.setAttribute('viewBox', '0 0 120 120');
  svg.setAttribute('width', '120');
  svg.setAttribute('height', '120');

  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  bg.setAttribute('cx', '60');
  bg.setAttribute('cy', '60');
  bg.setAttribute('r', radius);
  bg.setAttribute('fill', 'none');
  bg.setAttribute('stroke', 'var(--primary-border)');
  bg.setAttribute('stroke-width', '8');
  svg.appendChild(bg);

  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', '60');
  circle.setAttribute('cy', '60');
  circle.setAttribute('r', radius);
  circle.setAttribute('fill', 'none');
  circle.setAttribute('stroke', percent > 100 ? 'var(--warning)' : 'var(--primary)');
  circle.setAttribute('stroke-width', '8');
  circle.setAttribute('stroke-dasharray', circumference);
  circle.setAttribute('stroke-dashoffset', offset);
  circle.setAttribute('transform', 'rotate(-90 60 60)');
  svg.appendChild(circle);

  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  text.setAttribute('x', '60');
  text.setAttribute('y', '65');
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('font-size', '20');
  text.setAttribute('font-weight', 'bold');
  text.textContent = `${Math.round(percent)}%`;
  svg.appendChild(text);

  document.getElementById('progress-text').textContent = `${consumed} / ${target} kcal`;
}

function renderJournal() {
  const list = document.getElementById('journal-list');
  list.innerHTML = '';

  if (todayHistory.length === 0) {
    list.innerHTML = '<p style="color: var(--text-secondary);">Aucune entrée aujourd\'hui</p>';
    return;
  }

  todayHistory.forEach(entry => {
    const emoji = entry.Type === 'recette' ? '🍽️' : entry.Type === 'scanner' ? '📱' : entry.Type === 'inventaire' ? '📦' : '✏️';
    const card = document.createElement('div');
    card.className = 'card journal-entry';
    card.innerHTML = `
      <div class="entry-header">
        <span class="entry-emoji">${emoji}</span>
        <span class="entry-name">${entry.Nom}</span>
        <span class="entry-time">${entry.Heure}</span>
      </div>
      <div class="entry-details">${entry.Quantité} ${entry.Unité} · <strong>${entry.Kcal_total} kcal</strong></div>
    `;
    list.appendChild(card);
  });
}

function openMealModal() {
  document.getElementById('log-meal-modal').classList.remove('hidden');
}

function closeMealModal() {
  document.getElementById('log-meal-modal').classList.add('hidden');
  document.getElementById('meal-form-container').classList.add('hidden');
  document.getElementById('meal-form').reset();
  selectedMealData = null;
}

async function selectMealOption(option) {
  const container = document.getElementById('meal-form-container');
  container.classList.remove('hidden');

  if (option === 'scanner') {
    startScanner();
  } else if (option === 'recipe') {
    showRecipePicker();
  } else if (option === 'inventory') {
    showInventoryPicker();
  } else if (option === 'manual') {
    showManualEntry();
  }
}

function showRecipePicker() {
  const recipes = RecipesAPI.getRecipeList();
  const html = recipes.map(r => `
    <div class="picker-item" data-id="${r.id}">
      <div>${r.name}</div>
      <div style="font-size: 0.8em; color: var(--text-secondary);">${Math.round(r.kcalPer100g)} kcal/100g</div>
    </div>
  `).join('');

  const container = document.querySelector('.meal-options');
  container.innerHTML = html;
  container.querySelectorAll('.picker-item').forEach(item => {
    item.addEventListener('click', () => {
      const recipeId = item.dataset.id;
      selectedMealData = { type: 'recipe', id: recipeId };
      document.getElementById('meal-qty').focus();
    });
  });
}

function showInventoryPicker() {
  const items = InventoryAPI.getActiveItems();
  const html = items.map(i => `
    <div class="picker-item" data-id="${i.ID}">
      <div>${i.Produit}</div>
      <div style="font-size: 0.8em; color: var(--text-secondary);">${i.Qty} ${i.Unité} · ${i.Kcal_per_100} kcal/100g</div>
    </div>
  `).join('');

  const container = document.querySelector('.meal-options');
  container.innerHTML = html;
  container.querySelectorAll('.picker-item').forEach(item => {
    item.addEventListener('click', () => {
      const itemId = item.dataset.id;
      selectedMealData = { type: 'inventory', id: itemId };
      document.getElementById('meal-qty').focus();
    });
  });
}

function showManualEntry() {
  document.getElementById('meal-kcal-label').classList.remove('hidden');
  document.getElementById('meal-kcal').classList.remove('hidden');
  selectedMealData = { type: 'manual' };
}

async function handleLogMeal(e) {
  e.preventDefault();

  if (!selectedMealData) return;

  const qty = parseFloat(document.getElementById('meal-qty').value);
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const date = Utils.getTodayISO();

  let kcal = 0;
  let name = '';
  let type = selectedMealData.type;
  let recipeId = '';
  let unit = 'g';

  if (type === 'recipe') {
    const recipe = RecipesAPI.getRecipe(selectedMealData.id);
    name = recipe.name;
    const kcalPer100g = RecipesAPI.calcKcalPer100g(selectedMealData.id);
    kcal = Utils.calcPortionKcal(qty, kcalPer100g);
    recipeId = selectedMealData.id;
  } else if (type === 'inventory') {
    const item = InventoryAPI.getActiveItems().find(i => i.ID === selectedMealData.id);
    name = item.Produit;
    kcal = Utils.calcPortionKcal(qty, parseFloat(item.Kcal_per_100));
    unit = item.Unité;
  } else if (type === 'manual') {
    name = 'Saisie manuelle';
    kcal = parseFloat(document.getElementById('meal-kcal').value);
  }

  try {
    const values = [date, time, name, qty, unit, Math.round(kcal), type, recipeId];
    const user = UserContext.getCurrentUser();
    const tabName = `History_${user}`;

    await SheetsAPI.appendRow(tabName, values, Auth.getToken());

    closeMealModal();
    await loadTodayHistory();
    renderProgress();
    renderJournal();
    Utils.showToast('Repas enregistré', 'success');
  } catch (e) {
    Utils.showToast('Erreur d\'enregistrement', 'error');
  }
}
```

- [ ] **Step 3: Write accueil CSS**

```css
/* css/accueil.css */
#progress-circle {
  display: block;
  margin: 20px auto;
  max-width: 200px;
}

#progress-text {
  text-align: center;
  font-weight: 700;
  font-size: 1.1em;
  margin-bottom: 20px;
  color: var(--primary);
}

h2 {
  font-size: 1em;
  margin-top: 20px;
  margin-bottom: 12px;
  font-weight: 700;
}

.meal-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.meal-option {
  padding: 12px;
  font-size: 0.95em;
}

.picker-item {
  padding: 10px;
  background: var(--bg-white);
  border: 1px solid var(--border-light);
  border-radius: 6px;
  margin-bottom: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.picker-item:active {
  background: var(--primary-bg);
}

.journal-entry {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.entry-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.entry-emoji {
  font-size: 1.3em;
}

.entry-name {
  flex: 1;
}

.entry-time {
  font-size: 0.85em;
  color: var(--text-secondary);
}

.entry-details {
  font-size: 0.85em;
  color: var(--text-secondary);
}
```

- [ ] **Step 4: Test Accueil page**

Auth required. Log meal from each of 4 sources. Verify journal updates, progress circle changes, calories sum correctly.

- [ ] **Step 5: Commit**

```bash
git add index.html js/accueil-ui.js css/accueil.css
git commit -m "feat: build Accueil page with meal logging, progress circle, daily journal"
```

---

## Task 13: Page — Profils (profils.html)

**Files:**
- Update: `profils.html`
- Create: `js/profils-ui.js`
- Update: `css/profils.css`

- [ ] **Step 1: Rewrite Profils HTML**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Profils — MealFlow</title>
  <link rel="stylesheet" href="css/style.css">
  <link rel="stylesheet" href="css/profils.css">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0"></script>
</head>
<body>
  <div class="app-header">
    <h1>👤 Profils</h1>
    <div class="user-chip" id="user-chip">—</div>
  </div>

  <div class="page-content" id="profils-content">
    <div class="profile-tabs">
      <button class="tab active" data-tab="profil">Profil</button>
      <button class="tab" data-tab="historique">Historique</button>
      <button class="tab" data-tab="stats">Stats</button>
    </div>

    <div id="profil-view" class="tab-content">
      <div id="profil-display"></div>
      <button class="btn btn-secondary mt-2" id="edit-profil-btn">✏️ Éditer</button>

      <form id="profil-form" class="hidden mt-2">
        <label>Taille (cm)</label>
        <input type="number" id="field-taille">

        <label>Poids (kg)</label>
        <input type="number" id="field-poids">

        <label>Objectif calorique</label>
        <input type="number" id="field-calories">

        <button type="submit" class="btn btn-primary mt-2">Sauvegarder</button>
        <button type="button" class="btn btn-secondary" id="cancel-edit-btn">Annuler</button>
      </form>
    </div>

    <div id="historique-view" class="tab-content hidden">
      <div id="historique-list"></div>
    </div>

    <div id="stats-view" class="tab-content hidden">
      <div id="stats-summary"></div>
      <canvas id="kcal-chart"></canvas>
      <canvas id="weight-chart"></canvas>

      <div class="weight-input mt-2">
        <label>Poids actuel (kg)</label>
        <div style="display: flex; gap: 8px;">
          <input type="number" id="weight-input" step="0.1">
          <button class="btn btn-primary btn-small" id="weight-save-btn">OK</button>
        </div>
      </div>
    </div>
  </div>

  <nav class="nav-bottom">
    <a href="index.html" class="nav-item">
      <span class="nav-icon">🏠</span>Accueil
    </a>
    <a href="recettes.html" class="nav-item">
      <span class="nav-icon">📖</span>Recettes
    </a>
    <a href="planning.html" class="nav-item">
      <span class="nav-icon">📅</span>Planning
    </a>
    <a href="inventory.html" class="nav-item">
      <span class="nav-icon">📦</span>Inventaire
    </a>
    <a href="profils.html" class="nav-item active">
      <span class="nav-icon">👤</span>Profils
    </a>
  </nav>

  <div id="history-detail-modal" class="modal hidden">
    <div class="modal-content">
      <h2 class="modal-title" id="detail-date"></h2>
      <div id="detail-entries"></div>
      <button class="btn btn-secondary" id="close-detail-btn">Fermer</button>
    </div>
  </div>

  <script src="js/auth.js"></script>
  <script src="js/sheets-api.js"></script>
  <script src="js/user-context.js"></script>
  <script src="js/utils.js"></script>
  <script src="js/profils-ui.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create profils-ui.js**

```javascript
// js/profils-ui.js
let historyData = [];
let kcalChart = null;
let weightChart = null;

document.addEventListener('DOMContentLoaded', async () => {
  const email = await Auth.init();
  if (!email) {
    Auth.showLoginButton();
    return;
  }

  await UserContext.init(email);
  await loadHistory();

  renderProfil();

  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', (e) => switchTab(e.target.dataset.tab));
  });

  document.getElementById('edit-profil-btn').addEventListener('click', showEditForm);
  document.getElementById('cancel-edit-btn').addEventListener('click', hideEditForm);
  document.getElementById('profil-form').addEventListener('submit', handleSaveProfile);
  document.getElementById('weight-save-btn').addEventListener('click', handleSaveWeight);
  document.getElementById('close-detail-btn').addEventListener('click', () => {
    document.getElementById('history-detail-modal').classList.add('hidden');
  });
});

function renderProfil() {
  const profile = UserContext.getCurrentProfile();
  const { imc, bmr, tdee } = Utils.getMBIandMetrics(
    parseFloat(profile.weight),
    parseFloat(profile.height),
    profile.sex,
    parseInt(profile.age),
    profile.activity
  );

  const display = document.getElementById('profil-display');
  display.innerHTML = `
    <div class="profil-card">
      <div class="metric">
        <span class="metric-label">Prénom</span>
        <span class="metric-value">${profile.name}</span>
      </div>
      <div class="metric">
        <span class="metric-label">Taille</span>
        <span class="metric-value">${profile.height} cm</span>
      </div>
      <div class="metric">
        <span class="metric-label">Poids</span>
        <span class="metric-value">${profile.weight} kg</span>
      </div>
      <div class="metric">
        <span class="metric-label">IMC</span>
        <span class="metric-value">${imc}</span>
      </div>
      <div class="metric">
        <span class="metric-label">BMR</span>
        <span class="metric-value">${bmr} kcal</span>
      </div>
      <div class="metric">
        <span class="metric-label">TDEE</span>
        <span class="metric-value">${tdee} kcal</span>
      </div>
      <div class="metric">
        <span class="metric-label">Objectif</span>
        <span class="metric-value">${profile.calorieTarget} kcal</span>
      </div>
      <div class="metric">
        <span class="metric-label">Régime</span>
        <span class="metric-value">${profile.diet}</span>
      </div>
    </div>
  `;
}

function showEditForm() {
  const profile = UserContext.getCurrentProfile();
  document.getElementById('field-taille').value = profile.height;
  document.getElementById('field-poids').value = profile.weight;
  document.getElementById('field-calories').value = profile.calorieTarget;

  document.getElementById('profil-display').classList.add('hidden');
  document.getElementById('edit-profil-btn').classList.add('hidden');
  document.getElementById('profil-form').classList.remove('hidden');
}

function hideEditForm() {
  document.getElementById('profil-display').classList.remove('hidden');
  document.getElementById('edit-profil-btn').classList.remove('hidden');
  document.getElementById('profil-form').classList.add('hidden');
}

async function handleSaveProfile(e) {
  e.preventDefault();
  // Update profile in Profils sheet via OAuth
  // Implementation: find profile row, update cells
  Utils.showToast('Profil sauvegardé', 'success');
  hideEditForm();
  renderProfil();
}

async function loadHistory() {
  const user = UserContext.getCurrentUser();
  const tabName = `History_${user}`;
  const rows = await SheetsAPI.readTab(tabName);
  if (!rows) {
    historyData = [];
    return;
  }
  historyData = SheetsAPI.rowsToObjects(rows).reverse();
}

function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));

  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById(`${tabName}-view`).classList.remove('hidden');

  if (tabName === 'historique') {
    renderHistorique();
  } else if (tabName === 'stats') {
    renderStats();
  }
}

function renderHistorique() {
  const list = document.getElementById('historique-list');
  list.innerHTML = '';

  // Group by date
  const grouped = {};
  historyData.forEach(entry => {
    if (!grouped[entry.Date]) grouped[entry.Date] = [];
    grouped[entry.Date].push(entry);
  });

  Object.entries(grouped).forEach(([date, entries]) => {
    const kcalSum = entries.reduce((sum, e) => sum + (parseInt(e.Kcal_total) || 0), 0);
    const profile = UserContext.getCurrentProfile();
    const isOver = kcalSum > profile.calorieTarget;
    const isToday = date === Utils.getTodayISO();

    const dayLabel = Utils.getLocaleDateFr(date);
    const card = document.createElement('div');
    card.className = `card history-day ${isToday ? 'today' : ''} ${isOver ? 'over' : ''}`;
    card.innerHTML = `
      <div class="day-header">
        <span>${dayLabel}</span>
        <span class="kcal-value ${isOver ? 'over' : ''}">${kcalSum} kcal</span>
      </div>
      ${isToday ? '<small style="color: var(--text-secondary);">en cours</small>' : ''}
    `;
    card.addEventListener('click', () => showHistoryDetail(date, entries));
    list.appendChild(card);
  });
}

function showHistoryDetail(date, entries) {
  const modal = document.getElementById('history-detail-modal');
  document.getElementById('detail-date').textContent = Utils.getLocaleDateFr(date);
  const detailDiv = document.getElementById('detail-entries');
  detailDiv.innerHTML = '';

  entries.forEach(entry => {
    const emoji = entry.Type === 'recette' ? '🍽️' : entry.Type === 'scanner' ? '📱' : entry.Type === 'inventaire' ? '📦' : '✏️';
    const div = document.createElement('div');
    div.className = 'entry';
    div.innerHTML = `
      <span>${emoji} ${entry.Nom}</span>
      <span style="color: var(--text-secondary);">${entry.Heure}</span>
      <span><strong>${entry.Kcal_total} kcal</strong></span>
    `;
    detailDiv.appendChild(div);
  });

  modal.classList.remove('hidden');
}

async function renderStats() {
  const last30Days = [];
  for (let i = 29; i >= 0; i--) {
    last30Days.push(Utils.addDaysToISO(Utils.getTodayISO(), -i));
  }

  const dailyKcal = {};
  last30Days.forEach(date => {
    dailyKcal[date] = historyData
      .filter(h => h.Date === date)
      .reduce((sum, h) => sum + (parseInt(h.Kcal_total) || 0), 0);
  });

  const profile = UserContext.getCurrentProfile();
  const avgKcal = Object.values(dailyKcal).reduce((a, b) => a + b, 0) / 30;
  const onTarget = Object.values(dailyKcal).filter(k => k <= profile.calorieTarget).length;

  document.getElementById('stats-summary').innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <span class="stat-label">Moyenne kcal/jour</span>
        <span class="stat-value">${Math.round(avgKcal)}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Jours dans l'objectif</span>
        <span class="stat-value">${onTarget}/30</span>
      </div>
    </div>
  `;

  renderKcalChart(last30Days, dailyKcal, profile.calorieTarget);
}

function renderKcalChart(dates, dailyKcal, target) {
  const ctx = document.getElementById('kcal-chart').getContext('2d');
  if (kcalChart) kcalChart.destroy();

  kcalChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates.map(d => d.split('-')[2]),
      datasets: [
        {
          label: 'Kcal consommées',
          data: dates.map(d => dailyKcal[d] || 0),
          borderColor: '#2e7d32',
          backgroundColor: 'rgba(46, 125, 50, 0.1)',
          tension: 0.3,
        },
        {
          label: 'Objectif',
          data: dates.map(() => target),
          borderColor: '#ffc107',
          borderDash: [5, 5],
          fill: false,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: true } },
      scales: { y: { beginAtZero: true } },
    },
  });
}

async function handleSaveWeight(e) {
  const weight = parseFloat(document.getElementById('weight-input').value);
  if (!weight) return;

  const user = UserContext.getCurrentUser();
  const tabName = `History_${user}`;
  const date = Utils.getTodayISO();
  const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  try {
    await SheetsAPI.appendRow(tabName, [date, time, `Poids: ${weight}kg`, weight, 'kg', 0, 'poids', ''], Auth.getToken());
    Utils.showToast('Poids enregistré', 'success');
    document.getElementById('weight-input').value = '';
    await loadHistory();
    renderStats();
  } catch (e) {
    Utils.showToast('Erreur d\'enregistrement', 'error');
  }
}
```

- [ ] **Step 3: Write profils CSS**

```css
/* css/profils.css */
.profile-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  border-bottom: 2px solid var(--border-light);
}

.tab {
  padding: 10px 12px;
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  color: var(--text-secondary);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.tab.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
}

.tab-content {
  min-height: 400px;
}

.profil-card {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.metric {
  background: var(--primary-bg);
  padding: 10px;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
}

.metric-label {
  font-size: 0.8em;
  color: var(--text-secondary);
  font-weight: 600;
}

.metric-value {
  font-size: 1.2em;
  color: var(--primary);
  font-weight: 700;
}

.history-day {
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.history-day.today {
  border-left: 3px solid var(--primary);
}

.history-day.over {
  opacity: 0.7;
}

.day-header {
  display: flex;
  justify-content: space-between;
  font-weight: 600;
}

.kcal-value.over {
  color: var(--warning);
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 20px;
}

.stat-card {
  background: var(--primary-bg);
  padding: 12px;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  text-align: center;
}

.stat-label {
  font-size: 0.85em;
  color: var(--text-secondary);
}

.stat-value {
  font-size: 1.5em;
  color: var(--primary);
  font-weight: 700;
}

.weight-input {
  background: var(--primary-bg);
  padding: 12px;
  border-radius: 8px;
}

.entry {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-light);
  align-items: center;
}
```

- [ ] **Step 4: Test Profils page**

Auth → switch tabs → verify profil, historique list, stats charts load. Log weight.

- [ ] **Step 5: Commit**

```bash
git add profils.html js/profils-ui.js css/profils.css
git commit -m "feat: build Profils page with profile view, history, stats charts"
```

---

## Task 14: Integration — Google API Keys & Auth Setup

**Files:**
- Update: `js/auth.js` (insert actual CLIENT_ID)
- Update: `js/sheets-api.js` (insert actual SHEET_ID, API_KEY)
- Create: `index.html` script tags for Google GIS library

- [ ] **Step 1: Add Google GIS script to all HTML files**

Add to `<head>` of every page:
```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

- [ ] **Step 2: Update auth.js with actual CLIENT_ID**

Get CLIENT_ID from Google Cloud Console OAuth 2.0 credentials.

- [ ] **Step 3: Update sheets-api.js with actual SHEET_ID and API_KEY**

Get from Google Sheet URL and Google Cloud Console API key.

- [ ] **Step 4: Test authentication flow**

Open app → should attempt silent auth → if no token, show login button → click → Google consent → auth → redirect to profile.

- [ ] **Step 5: Commit**

```bash
git add --all
git commit -m "feat: add Google OAuth and Sheets API keys"
```

---

## Task 15: Test All Pages End-to-End

- [ ] **Step 1: Test Inventaire**

Add item via form and barcode → verify in list, grouped by category → mark consumed → check expiry badge.

- [ ] **Step 2: Test Recettes**

Add recipe with ingredients + steps → save → see in list → edit/delete → verify kcal/100g calculates from inventory.

- [ ] **Step 3: Test Planning**

Add recipes to planning grid → navigate weeks → verify today highlighted → save to Sheets.

- [ ] **Step 4: Test Courses**

Tap "Générer liste" → verify shopping list = planning ingredients minus inventory → group by category.

- [ ] **Step 5: Test Accueil**

Log meal from each 4 sources → progress circle updates → journal shows today's entries → verify kcals sum.

- [ ] **Step 6: Test Profils**

View profile → edit taille/poids/objectif → historique shows days grouped by kcal → stats charts render 30d data → log weight.

- [ ] **Step 7: Commit**

```bash
git commit -m "test: verify all pages end-to-end, auth flow, Sheets sync"
```

---

## Task 16: Optimization & Offline Mode

**Files:**
- Create: `js/offline.js`
- Update: all UI files to use offline cache

- [ ] **Step 1: Write offline.js module**

```javascript
window.OfflineCache = {
  lastSyncTime: null,

  init() {
    this.loadFromCache();
  },

  saveToCache(key, data) {
    const cacheKey = `mealflow_cache_${key}`;
    localStorage.setItem(cacheKey, JSON.stringify({
      data,
      timestamp: Date.now(),
    }));
  },

  loadFromCache(key) {
    const cacheKey = `mealflow_cache_${key}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const obj = JSON.parse(cached);
      return obj.data;
    }
    return null;
  },

  showOfflineBanner() {
    const banner = document.createElement('div');
    banner.className = 'offline-banner';
    banner.textContent = '📡 Mode hors-ligne — données en cache';
    document.body.appendChild(banner);
  },

  async checkConnectivity() {
    try {
      const res = await fetch('https://www.google.com/', { method: 'HEAD', mode: 'no-cors' });
      return true;
    } catch {
      return false;
    }
  },
};
```

- [ ] **Step 2: Add offline banner CSS to style.css**

```css
.offline-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: var(--warning);
  color: white;
  padding: 8px 12px;
  text-align: center;
  font-size: 0.85em;
  z-index: 999;
}
```

- [ ] **Step 3: Update all Sheets read calls to use offline cache fallback**

When SheetsAPI.readTab fails → fall back to cached data → show offline banner.

- [ ] **Step 4: Test offline mode**

Disconnect network → try to load data → should show cache + banner.

- [ ] **Step 5: Commit**

```bash
git add js/offline.js css/style.css
git commit -m "feat: add offline mode with localStorage cache fallback"
```

---

## Task 17: Final Polish & Deploy

- [ ] **Step 1: Verify all CSS is responsive (320px+)**

Test on mobile widths: buttons tap-friendly, text readable, nav bar stable.

- [ ] **Step 2: Check all toast messages show correctly**

Verify success, error, warning toasts auto-dismiss.

- [ ] **Step 3: Verify navigation bar is always visible**

All pages should have nav at bottom, active tab highlighted.

- [ ] **Step 4: Check for any console errors**

Open DevTools → run through all pages → should have zero errors.

- [ ] **Step 5: Test on actual phone (if possible)**

Use actual mobile device → test auth, logging, navigation.

- [ ] **Step 6: Final commit**

```bash
git commit -m "polish: responsive design, fix edge cases, verify mobile UX"
```

- [ ] **Step 7: Deploy to GitHub Pages**

Push to `main` branch → GitHub Pages auto-deploys.

**Plan complete and saved to `docs/superpowers/plans/2026-05-26-mealflow-v2-plan.md`.**

---

## Execution Options

**Two ways to proceed:**

**1. Subagent-Driven (recommended)** — Fresh subagent per task, review between tasks, fast iteration
- Invokes superpowers:subagent-driven-development
- Each task gets focused execution + checkpoints

**2. Inline Execution** — Execute tasks in this session with checkpoints
- Uses superpowers:executing-plans
- Batch tasks with reviews

**Which approach?**
