# MealFlow — Complete Application Specification

## Overview

MealFlow is a meal planning and nutrition tracking app for multiple users living together. Each user has their own profile, meal history, and preferences. The app syncs all data to Google Sheets via OAuth2.

**Core concept:** Track what you eat → calculate nutrition → plan meals for the week → generate shopping lists → manage household inventory.

---

## Architecture

### Tech Stack
- **Frontend:** Vanilla HTML/CSS/JavaScript (no framework, no build step)
- **Backend:** Google Sheets API v4 (read via API key, write via OAuth2)
- **Auth:** Google Identity Services (GIS) OAuth2
- **Storage:** localStorage for offline cache, Google Sheets for sync
- **Charts:** Chart.js 4.4.0
- **Barcode:** html5-qrcode
- **Nutrition API:** Open Food Facts

### Design Principle
Single multi-page HTML app. Each page (`*.html`) imports shared JS modules. All data lives in one Google Sheet with tabs for each data type. User switching via OAuth2 email → profile lookup.

---

## Data Model

### Google Sheet Tabs

#### 1. **Profils** (Profile Management)
Stores one row per user profile.

| Column | Type | Example | Purpose |
|--------|------|---------|---------|
| Email | email | florian@example.com | OAuth2 identifier |
| Nom | string | Florian | Display name |
| Sexe | string | M/F | For BMR calculation |
| Age | number | 30 | For BMR calculation |
| Taille_cm | number | 175 | Height in cm (for BMR) |
| Poids_kg | number | 75 | Current weight in kg |
| Activite | string | Modéré | Activity level (Sédentaire/Peu actif/Modéré/Très actif/Extrêmement actif) |
| Calories_cible | number | 2200 | Daily calorie target |
| Regime | string | Omnivore | Diet type (Omnivore/Végétarien/Vegan/etc) |

**Calculated:** BMR (Basal Metabolic Rate), TDEE (Total Daily Energy Expenditure) using Mifflin-St Jeor formula.

---

#### 2. **RecettesJSON** (Recipe Storage)
Single cell (A1) contains JSON string of all recipes. Structure:

```json
{
  "recipes": {
    "recipe_id_1": {
      "id": "recipe_id_1",
      "name": "Pâtes Carbonara",
      "prep_minutes": 20,
      "portions": 2,
      "tags": ["rapide", "omnivore"],
      "ingredients": [
        {"name": "Pâtes", "quantity": 400, "unit": "g"},
        {"name": "Œufs", "quantity": 3, "unit": "pièce"},
        {"name": "Lardons", "quantity": 150, "unit": "g"}
      ],
      "steps": [
        "Cuire les pâtes",
        "Faire revenir les lardons",
        "Mélanger avec les œufs"
      ],
      "kcalPer100g": 180
    }
  }
}
```

**Calculated fields:**
- `kcalPer100g` = sum(ingredient_kcal) / total_weight_g * 100

---

#### 3. **Planning** (Weekly Meal Schedule)
One row per day, two columns per meal slot (midi/soir).

| Colonne | Type | Example | Purpose |
|---------|------|---------|---------|
| Date | ISO date | 2026-05-26 | Day of the week |
| Midi_Recette | string | recipe_id_1 | Recipe ID for lunch |
| Midi_Portions | number | 1 | Portions to cook |
| Soir_Recette | string | recipe_id_2 | Recipe ID for dinner |
| Soir_Portions | number | 1.5 | Portions to cook |

**Uses:** Generate shopping list, show today's recipe, plan week ahead.

---

#### 4. **Inventaire** (Household Inventory)
One row per item. All quantities tracked.

| Column | Type | Example | Purpose |
|--------|------|---------|---------|
| ID | string | inv_uuid_1 | Unique identifier |
| Produit | string | Tomates Cerises | Product name |
| Quantite | number | 250 | Current quantity in stock |
| Unite | string | g | Unit (g/ml/pièce/litre) |
| Date_Ajout | ISO date | 2026-05-20 | When added |
| Date_Peremption | ISO date | 2026-06-05 | Expiry date |
| Categorie | string | Fruits | Category for filtering |
| Prix | number | 2.50 | Cost in EUR |
| Kcal_per_100 | number | 18 | Calories per 100 units (from Open Food Facts API) |
| Consomme | boolean | false | Marked as consumed? (for tracking) |

**Calculated:**
- Days until expiry
- Kcal for any quantity: qty * (kcal_per_100 / 100)

---

#### 5. **History_florian** / **History_naomi** (Per-User Meal Log)
One row per meal eaten. One tab per user.

| Column | Type | Example | Purpose |
|--------|------|---------|---------|
| Date | ISO date | 2026-05-26 | When eaten |
| Heure | time | 12:30 | Time eaten |
| Nom | string | Pâtes Carbonara | What was eaten |
| Quantite | number | 250 | Amount eaten |
| Unite | string | g | Unit |
| Kcal_total | number | 450 | Total calories (qty * kcal_per_100g / 100) |
| Type | string | recette/scanner/inventaire/manuel | Source |
| Recipe_ID | string | recipe_id_1 | If from recipe |

**Uses:** Daily journal, profile history tab, calorie tracking.

---

## Module Architecture

### Shared Modules (js/)

#### **auth.js** — OAuth2 Flow + Persistent Sessions
**Exports:** `window.Auth = { ... }`

**Methods:**
- `init()` → Promise<email> — Load token from localStorage → attempt silent re-auth via Google GIS → refresh if expired → return email or null if no valid token
- `showLoginButton()` — Render Google Sign-In button (shown only when not authenticated)
- `getToken()` → string — Return current valid OAuth2 access token
- `logout()` → void — Clear localStorage tokens, dispatch `auth-changed` event, reload page
- `isAuthenticated()` → boolean — Check if valid token exists

**Events:** Fires `auth-changed` event when auth state changes (login/logout/token refresh).

**Persistent Session Logic:**
1. **On page load:** `Auth.init()` runs automatically
2. **Token storage:** Access token + ID token stored in localStorage
3. **Token expiry:** GIS library handles refresh automatically; if refresh fails, prompt user to login again
4. **Cross-tab sync:** localStorage changes trigger `storage` event (other tabs detect logout)
5. **Silent re-auth:** Use GIS `prompt=none` to refresh without user interaction

**State:**
- `localStorage.googleAccessToken` — OAuth2 access token (expires in ~1 hour)
- `localStorage.googleIdToken` — ID token (longer-lived)
- `localStorage.googleTokenExpiry` — Expiry timestamp (optional, for client-side checking)
- `window.Auth._currentEmail` — In-memory cache of logged-in email

---

#### **sheets-api.js** — Google Sheets Read/Write
**Exports:** `window.SheetsAPI = { ... }`

**Config:**
- `SHEET_ID` — Google Sheet ID
- `API_KEY` — Read-only API key

**Methods:**
- `readTab(tabName)` → Promise<Array<Array>> — Read entire tab (read-only via API key)
- `rowsToObjects(rows)` → Array<Object> — Convert rows to objects using first row as headers
- `appendRow(tabName, values, token)` → Promise — Write row (requires OAuth token)
- `updateCell(tabName, range, value, token)` → Promise — Update single cell
- `ensureTab(tabName, token)` → Promise — Create tab if not exists

**Error handling:** Returns null on API errors, logs to console.

---

#### **user-context.js** — User Profile Lookup
**Exports:** `window.UserContext = { ... }`

**Methods:**
- `init(email)` → Promise — Load profile from Profils tab, store in memory
- `getCurrentUser()` → string — Return current user ID (florian/naomi)
- `getCurrentProfile()` → Object — Return current user's profile object
- `setCurrentUser(userId)` — Switch user, dispatch `userChanged` event
- `toggleUser()` — Switch between florian/naomi
- `initializeUserToggle()` — Render user toggle button in header
- `applyUserStyling()` — Set background color per user

**Internal state:**
- `localStorage.mealflow_user` — Currently selected user
- In-memory profile cache per email

---

#### **utils.js** — Shared Helpers
**Exports:** `window.Utils = { ... }`

**Methods:**
- `getTodayISO()` → string — Return "YYYY-MM-DD"
- `getLocaleDateFr(dateISO)` → string — Return "lundi 26 mai 2026"
- `addDaysToISO(dateISO, days)` → string — Add days to date
- `getWeekStart(dateISO)` → string — Get Monday of week
- `getWeekDays(weekStartISO)` → Array<string> — Get all 7 days of week
- `daysUntilExpiry(expiryISO)` → number — Days until date
- `calcKcalPer100g(totalKcal, totalWeightG)` → number — Kcal/100g
- `calcPortionKcal(eatenGrams, kcalPer100g)` → number — Total kcal for portion
- `getMifflinStJeor(sexe, poids, taille, age)` → number — BMR calculation
- `getTDEE(bmr, activite)` → number — Daily calorie needs
- `getMBIandMetrics(poids, taille, sexe, age, activite)` → {imc, bmr, tdee}
- `showToast(message, type)` — Show notification (success/error/warning)
- `slugify(text)` → string — Convert to recipe_id format

---

#### **recipes.js** — Recipe CRUD
**Exports:** `window.RecipesAPI = { ... }`

**Methods:**
- `load()` → Promise — Read RecettesJSON!A1, parse JSON
- `getRecipeList()` → Array<Object> — All recipes
- `getRecipe(id)` → Object — Single recipe
- `addRecipe(id, recipe)` → void — Add to memory
- `updateRecipe(id, recipe)` → void — Update in memory
- `deleteRecipe(id)` → void — Remove from memory
- `search(query)` → Array<Object> — Filter by name/tags
- `calcKcalPer100g(recipeId)` → number — Kcal/100g for recipe
- `save(token)` → Promise — Write all recipes back to Sheets

**Internal state:**
- In-memory recipe map
- Depends on: `InventoryAPI` (for ingredient kcals)

---

#### **inventory.js** — Inventory CRUD
**Exports:** `window.InventoryAPI = { ... }`

**Methods:**
- `load()` → Promise — Read Inventaire tab
- `getAll()` → Array<Object> — All items
- `getActiveItems()` → Array<Object> — Not consumed
- `getExpiringSoon(days)` → Array<Object> — Expire within N days
- `addItem(item)` → Promise — Add to Sheets + memory
- `updateItem(id, updates)` → Promise — Update quantity/expiry/etc
- `markConsumed(id)` → Promise — Set consumed=true, add to History
- `deleteItem(id)` → Promise — Remove from Sheets
- `getCategoryStats()` → {category: count} — Items per category

**Internal state:**
- In-memory item cache (loaded from Inventaire tab)

---

### CSS Modules (css/)

#### **style.css** — Shared Styles
- CSS variables (colors, spacing, fonts)
- Navigation bar (fixed bottom)
- Button styles (primary/secondary/danger)
- Card, modal, form styles
- Responsive grid
- Toast notifications

#### **accueil.css**, **recettes.css**, **planning.css**, etc.
Page-specific styles built on top of `style.css`.

---

## Pages

### 1. **Accueil (index.html)** — Daily Meal Log (Per-User)
**Purpose:** Track meals eaten today (current user only), see progress toward calorie target.

**Per-user data:**
- Shows only meals logged by current user (from History_[user])
- When different user logs in, they see their own consumption, not the previous user's

**Sections:**
- **Header:** Greeting ("Bonjour Florian"), today's date, logged-in user's calorie target
- **Progress Circle:** SVG circle showing % of daily calories consumed (for current user)
- **Journal du jour:** List of meals eaten today by current user (reversed chronological)
  - Shows: emoji (type), name, time, quantity, kcal
- **Button "J'ai mangé":** Opens modal with 4 options:
  1. **Scanner:** Scan product barcode → lookup Open Food Facts → enter quantity
  2. **Recette:** Pick from recipes (shared) → enter quantity eaten
  3. **Inventaire:** Pick from inventory items (shared) → enter quantity eaten
  4. **Manuel:** Enter name + kcal manually

**Data flow:**
1. Load current user's profile from Profils (via Auth.init() email)
2. Load History_[user] tab where user = current user, filter by today's date
3. Calculate total kcal consumed (current user only)
4. Render progress circle, journal
5. On "J'ai mangé" submit:
   - Calculate kcal (qty * kcal_per_100 / 100)
   - Append row to History_[currentUser] (not shared)
   - Refresh display

**Modules used:** Auth, SheetsAPI, Utils, InventoryAPI, RecipesAPI

---

### 2. **Recettes (recettes.html)** — Recipe Management
**Purpose:** Create/edit/delete recipes, store ingredients and steps.

**Sections:**
- **Search bar:** Filter recipes by name/tags
- **Recipe List:** Cards showing name, prep time, portions, kcal/100g, tags
- **Add Recipe Button:** Opens modal form
  - Name, prep time (min), portions
  - Ingredients (name, qty, unit) — dynamic add/remove
  - Steps (text) — dynamic add/remove
  - Tags (chips: végétarien, vegan, rapide, etc)
- **Recipe Detail Modal:** Shows full recipe when clicked
  - Edit button → reopen form with values
  - Delete button → confirm, remove

**Data flow:**
1. Load recipes from RecettesJSON!A1
2. Render recipe list
3. On add/edit/delete:
   - Update memory
   - Calculate kcal/100g from ingredients (lookup Inventaire for each ingredient)
   - Save JSON back to RecettesJSON!A1

**Special logic:**
- Ingredient name lookup: search Inventaire for matching product, use its kcal_per_100
- If ingredient not in inventory, prompt user to add or skip kcal calc

**Modules used:** Auth, UserContext, RecipesAPI, InventoryAPI, Utils

---

### 3. **Planning (planning.html)** — Weekly Meal Plan (7-Day Rolling Window)
**Purpose:** Choose recipes for next 7 days; shopping list auto-updates in real-time.

**7-Day Rolling Window:**
- Always display next 7 days in vertical layout
- If today is Wednesday 26 May → show Wed 26 to Tue 1 June
- Each day the window shifts (e.g., next day: Thu 27 to Wed 2 June)
- Shopping list only includes items for these 7 days (day 8+ ignored)

**Sections:**
- **Planning Grid:** 7 rows (one per day), 2 columns (Midi/Soir)
  - Row header: day name + date (e.g., "MERCREDI 26 MAI")
  - Each cell shows recipe name (or empty with "+")
  - Tap cell → open recipe picker modal
- **No "Générer liste de courses" button** (auto-updates instead)
- **Link to "Recette du jour":** Shows today's scheduled recipe (if any)

**Data flow:**
1. Calculate 7-day window (today through today+6)
2. Load Planning tab, filter to window dates
3. Render grid
4. On recipe select:
   - Update Planning tab (cell write)
   - Recalculate Courses list (only next 7 days)
   - Update Courses tab in real-time
   - Courses page auto-refreshes
   - Show toast confirmation

**Modules used:** Auth, SheetsAPI, RecipesAPI, InventoryAPI, Utils

---

### 4. **Recette du jour (recette_du_jour.html)** — Today's Recipe
**Purpose:** Display today's scheduled recipe (from Planning).

**Sections:**
- **Recipe Header:** Name, prep time, portions
- **Ingredients:** List with quantities
- **Steps:** Numbered preparation steps
- **Message if no recipe:** "Aucune recette prévue pour aujourd'hui"

**Data flow:**
1. Load Planning tab
2. Find today's date row
3. Get Midi + Soir recipes (if both exist, show both or picker)
4. Load recipe from RecipesAPI
5. Render

**Special case:** If user viewing at noon, show Midi. If evening, show Soir. Or show both?
*Spec unclear — recommend showing both with meal type label.*

**Modules used:** Auth, UserContext, Utils, SheetsAPI, RecipesAPI

---

### 5. **Inventaire (inventory.html)** — Inventory Management (Shared)
**Purpose:** Track household food items, quantities, expiry dates, and nutrition info. Shared by all users.

**Shared data:**
- All users can add/edit/delete items
- Any user logging in sees the same inventory
- Intentional: household stock is common knowledge

**Sections:**
- **Scanner Section:** Tap "Scanner un Produit" → barcode scanner
  - Lookup Open Food Facts API
  - Fill form with product name + kcal/100g
- **Add Item Form:**
  - Product name, quantity, unit (g/ml/pièce/litre)
  - Category (dropdown: Fruits, Légumes, Viandes, Produits Laitiers, etc)
  - Expiry date
  - Price (EUR)
  - kcal/100g (auto-filled from API, editable)
- **Category Filter:** Dropdown to show only one category, or "All"
- **Inventory List:** Grouped by category
  - Per item: name, quantity, unit
  - Expiry date with days remaining (red if < 3 days, grey if expired)
  - kcal/100g
  - Button "Consommer" → log to History_[currentUser] + update inventory qty
  - Button "Éditer" → opens edit modal (qty, expiry, price, category)
  - Button "Supprimer" → remove item

**Data flow:**
1. Load Inventaire tab (shared)
2. Group/filter by category
3. Render inventory list
4. On scanner: call Open Food Facts API → extract name + kcal/100g
5. On add: append row to Inventaire + update memory
6. On consume: 
   - Create History_[currentUser] entry (product name, qty eaten, kcal)
   - Update Inventaire row (decrement quantity)
7. On edit: update Inventaire row (qty/expiry/price/category)
8. On delete: remove row from Inventaire

**Modules used:** SheetsAPI, InventoryAPI, Utils, open-food-facts API

---

### 6. **Profils (profils.html)** — User Profile & History (Multi-User)
**Purpose:** View/manage profiles for both users, separate meal histories and stats per user.

**Architecture:**
- Each user (Florian, Naomi) has separate OAuth2 login
- App displays current logged-in user + link to other user's profile
- Each user views their own History_[user] tab only

**Sections:**

1. **Current User Profile Tab:**
   - Display: Name, height, weight, IMC, BMR, TDEE, calorie target, diet
   - Edit button → form to update taille/poids/calories (only current user can edit)
   - Save recalculates BMR/TDEE

2. **Current User History Tab:**
   - List of days with total kcal consumed (from History_[currentUser])
   - Format: "Lundi 26 mai 2026 : 1346 kcal" → button to expand
   - Expand shows: meals eaten that day with time, qty, kcal
   - Detail modal shows each meal

3. **Current User Stats Tab:**
   - Summary cards: avg kcal/day, weight change (last 30 days)
   - Chart: last 30 days kcal consumption (Chart.js line chart)
   - Chart: last 30 days weight (Chart.js line chart)
   - Button to log weight: input weight → append to profile log

4. **Other User Profile (Tab or Toggle):**
   - View-only other user's profile, history, stats
   - Same layout as current user sections
   - Cannot edit other user's data
   - Shows their History_[otherUser] data

**Data flow:**
1. Load current user's profile from Profils tab (via email from Auth.init())
2. Load History_[currentUser], group by date
3. For each day, sum kcal
4. Render current user sections
5. Load other user's profile from Profils tab
6. Load History_[otherUser], render in separate section

**Modules used:** Auth, SheetsAPI, Utils, Chart.js

---

### 7. **Courses (courses.html)** — Shopping List (Auto-Updated)
**Purpose:** Display auto-generated shopping list from next 7 days of Planning.

**Read-only list:**
- Grouped by category (Fruits, Légumes, Viandes, etc)
- Item: name, needed quantity, unit, price estimate
- Checkbox to mark bought (local only, not synced to Sheets)
- **No manual editing** (list auto-calculated from Planning + Inventaire)
- **No "regenerate" button** (updates in real-time when Planning changes)

**Auto-calculation logic:**
1. Calculate 7-day window (today through today+6)
2. Load Planning tab for these dates
3. For each recipe scheduled in window:
   - Load recipe from RecipesAPI
   - Get ingredients list
4. For each ingredient:
   - Check Inventaire for current quantity
   - Needed = (recipe qty * portions) - (inventory qty)
   - If needed > 0, add to list
5. Group by category, aggregate quantities
6. Render list

**Real-time updates:**
- When user selects recipe in Planning → Courses tab updates automatically
- Courses page refreshes (via listener on Sheets changes or localStorage event)
- Recipes scheduled beyond day+7 are NOT included

**Modules used:** SheetsAPI, RecipesAPI, InventoryAPI, Utils

---

## Navigation

Bottom fixed navbar on all pages (except modals):
- 🏠 Accueil (home, meal log)
- 📖 Recettes (recipes)
- 📅 Planning (weekly plan)
- 📦 Inventaire (inventory)
- 👤 Profils (profile + history)

Additional links within pages:
- Planning → "Recette du jour" link
- Accueil modal → "Chercher dans l'inventaire"
- Courses accessible from Planning or navbar

---

## Multi-User Architecture

**Two separate users = Two separate OAuth2 logins**

Each user (Florian, Naomi) logs in with their own Google account. Only one user logged in per browser tab at a time.

**Per-user data (isolated by user):**
- `History_florian` — Florian's meal log only
- `History_naomi` — Naomi's meal log only
- Each user's profile in Profils tab (identified by email)
- Accueil page shows only logged-in user's consumption

**Shared data (read/write by any logged-in user):**
| Data | Purpose | Who can write? |
|------|---------|---|
| RecettesJSON | All recipes | Any user |
| Planning | Weekly meal schedule | Any user |
| Inventaire | Household inventory | Any user |
| Courses | Shopping list (derived) | Auto-calculated, read-only |

**Switch users:**
- Logout current user → tokens cleared → page reloads → login button shown
- Other user logs in with their Google account
- App loads their profile, History_[user], all shared data

**Page behavior:**

| Page | Per-user or shared? | Notes |
|------|-------------------|-------|
| Accueil | Per-user | Shows only logged-in user's meals today |
| Recettes | Shared | All users can add/edit/delete recipes |
| Planning | Shared | One meal plan for whole household |
| Recette du jour | Shared | Shows today's recipe for all users |
| Inventaire | Shared | Household inventory, any user can manage |
| Courses | Shared | Shopping list for whole household (auto-calculated) |
| Profils | Both | Current user profile + history; can view other user's profile + history |

**No in-app user switching:**
- No toggle button within app
- No session merging
- Each user has isolated OAuth2 token

---

## App Initialization (Persistent Authentication)

**Every page (index.html, recettes.html, etc.) runs the same initialization sequence on load:**

```javascript
// 1. Load shared modules (in order)
// <script src="js/google-auth.js"></script>
// <script src="js/sheets-api.js"></script>
// <script src="js/user-context.js"></script>
// etc.

// 2. Main app init (in page-specific script)
(async () => {
  // Try to restore session from localStorage
  const email = await Auth.init();
  
  if (!email) {
    // No token or token refresh failed → show login button
    Auth.showLoginButton();
    return;
  }
  
  // Token exists and valid → load data
  await UserContext.init(email);
  
  // Load read-only data (via API key)
  await RecipesAPI.load();
  await InventoryAPI.load();
  
  // Page now has all data + user profile + auth token ready
  // Page-specific code renders UI
})();
```

**Persistent Session Details:**
- **First visit:** User logs in via Google OAuth → tokens stored in localStorage
- **Second visit:** Page load → `Auth.init()` loads token from localStorage → attempts silent re-auth → if successful, user is logged back in without seeing login button
- **Token expiry (1 hour):** GIS library automatically refreshes token in background
- **Long session pause (>24 hours):** ID token expires → user must log in again (show login button)
- **Logout:** User taps logout → tokens cleared from localStorage → page reloads → login button shown

---

## User Flows

### Flow 1: Setup (First Time)
1. User opens app
2. Auth.init() checks token, none exists
3. Shows login button
4. User clicks → Google OAuth dialog → authenticates
5. App looks up user email in Profils tab
6. If not found → redirect to profile creation form (or show placeholder)
7. User creates profile (name, height, weight, age, sex, activity, diet, calorie target)
8. App appends row to Profils + redirects to Accueil
9. Profile loads, app is ready

### Flow 2: Log a Meal
1. User on Accueil
2. Taps "J'ai mangé"
3. Modal opens with 4 options
4. User chooses "Recette" → sees recipe list
5. Selects "Pâtes Carbonara" → enters quantity (250g)
6. App calculates: recipe kcal/100g = 180 → 250g = 450 kcal
7. User submits
8. App appends to History_[user]: [date, time, "Pâtes Carbonara", 250, "g", 450, "recette", recipe_id_1]
9. Accueil refreshes: journal updates, progress circle updates

### Flow 3: Plan Next 7 Days (Auto-updating Shopping List)
1. User on Planning
2. Sees next 7 days (Wed 26 May - Tue 1 June in vertical layout)
3. Taps Wednesday Midi cell → recipe picker modal
4. Selects "Pâtes Carbonara" (2 portions)
5. Planning tab updates: Wed Midi_Recette = recipe_id_1, Midi_Portions = 2
6. Toast shows: "Recipe added to shopping list"
7. Courses tab updates automatically:
   - Calculates ingredients for Pâtes: 400g pâtes, 3 œufs, 150g lardons
   - Checks Inventaire: 100g pâtes in stock → need 300g
   - Checks Inventaire: 0 eggs → need 3
   - Checks Inventaire: 200g lardons in stock → need -50g (don't buy)
8. Courses page shows updated list (if user views it)
9. User can continue planning other days (list updates for each recipe)
10. **Recipes scheduled after next 7 days are ignored** (not added to shopping list)

### Flow 4: Buy Groceries & Add to Inventory
1. User goes shopping, buys items from list
2. Back home, opens Inventaire
3. Taps "Scanner un Produit" → scans eggs barcode
4. API returns "Œufs" + "kcal/100g = 155"
5. User enters qty (6 pièces), expiry (2026-06-15)
6. Inventaire updates: adds "Œufs | 6 | pièce | 2026-06-15 | kcal/100g 155"

### Flow 5: Track History (Next Day)
1. User on Profils, Historique tab
2. Sees: "Lundi 26 mai 2026 : 1346 kcal"
3. Taps day → modal opens with all meals eaten
4. Shows: Pâtes 250g 450kcal, Salade 150g 45kcal, Eau 0kcal, etc

---

## Version History

### V1 (Current Broken Version)
**Issues:**
- Function name mismatches (readSheetTab vs readTab)
- Module structure doesn't match usage (Auth module missing)
- Grignottage-centric (snacking focus, not meal planning)
- UserContext doesn't have getCurrentProfile()
- Pages broken (profils.js, accueil.js, planning.js call non-existent functions)

### V2 (Planned)
**Complete rewrite from scratch:**
- All modules follow consistent interface contract
- Foundation modules (auth, sheets-api, user-context, utils, recipes, inventory) built first
- Each module has clear methods, exports to window.ModuleName
- Pages built on top of modules
- No circular dependencies
- LocalStorage caching for offline mode
- Complete error handling

---

## Next Steps

1. **Fresh repo & folder:** Clone/init new directory
2. **Git setup:** Fresh git history, initial commit
3. **Task 1-7:** Build foundation modules in order
   - Each task: implement + commit + test
4. **Task 8-12:** Build pages in order
5. **Task 13:** Profile setup flow
6. **Integration:** Auth keys, Sheets ID, test end-to-end
7. **Polish:** Error handling, edge cases, mobile UX

---

## Decision Points (To Clarify Tomorrow)

1. **Recette du jour:** Show both Midi+Soir recipes, or context-aware?
2. **Inventory delete:** Soft delete (mark consumed) or hard delete (remove row)?
3. **Shopping list:** Allow manual editing, or auto-generated only?
4. **Weight tracking:** Weekly? Daily? Manual or sync from scale?
5. **Offline mode:** Required or nice-to-have?

