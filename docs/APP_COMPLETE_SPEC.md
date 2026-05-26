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

#### **auth.js** — OAuth2 Flow
**Exports:** `window.Auth = { ... }`

**Methods:**
- `init()` → Promise<email> — Check token, silent re-auth, return email or null
- `showLoginButton()` — Render Google Sign-In button
- `getToken()` — Return current OAuth2 access token
- `logout()` — Clear token, reload

**Events:** Fires `auth-changed` event when auth state changes.

**State:**
- `localStorage.googleAccessToken` — OAuth2 access token
- `localStorage.googleIdToken` — ID token

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

### 1. **Accueil (index.html)** — Daily Meal Log
**Purpose:** Track meals eaten today, see progress toward calorie target.

**Sections:**
- **Header:** Greeting ("Bonjour Florian"), today's date, calorie target
- **Progress Circle:** SVG circle showing % of daily calories consumed
- **Journal du jour:** List of meals eaten today (reversed chronological)
  - Shows: emoji (type), name, time, quantity, kcal
- **Button "J'ai mangé":** Opens modal with 4 options:
  1. **Scanner:** Scan product barcode → lookup Open Food Facts → enter quantity
  2. **Recette:** Pick from recipes → enter quantity
  3. **Inventaire:** Pick from inventory items → enter quantity
  4. **Manuel:** Enter name + kcal manually

**Data flow:**
1. Load profile from Profils (get calorie target)
2. Load History_[user] tab, filter by today
3. Calculate total kcal consumed
4. Render progress circle, journal
5. On "J'ai mangé" submit:
   - Calculate kcal (qty * kcal_per_100 / 100)
   - Append row to History_[user]
   - Refresh display

**Modules used:** Auth, UserContext, Utils, SheetsAPI, InventoryAPI, RecipesAPI

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

### 3. **Planning (planning.html)** — Weekly Meal Plan
**Purpose:** Choose recipes for each day's lunch and dinner.

**Sections:**
- **Week Navigator:** Previous/next week buttons, week date range
- **Planning Grid:** 7 rows (Mon-Sun), 2 columns (Midi/Soir)
  - Each cell shows recipe name (or empty)
  - Tap cell → open recipe picker modal
  - Save button writes to Planning tab
- **Button "Générer liste de courses":** Calculates shopping list (Courses page)
- **Link to "Recette du jour":** Shows today's scheduled recipe (if any)

**Data flow:**
1. Load Planning tab for the week
2. Render grid
3. On recipe select:
   - Update Planning tab
   - Re-render
4. On "Générer liste":
   - Read this week's recipes
   - For each recipe, get ingredients
   - For each ingredient, check Inventaire qty
   - Calculate needed qty = (recipe qty * portions) - (inventory qty)
   - Redirect to Courses page with list

**Modules used:** Auth, UserContext, Utils, SheetsAPI, RecipesAPI, InventoryAPI

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

### 5. **Inventaire (inventory.html)** — Inventory Management
**Purpose:** Track food items, their quantities, expiry dates, and nutrition info.

**Sections:**
- **Scanner Section:** Tap "Scanner un Produit" → barcode scanner
  - Lookup Open Food Facts API
  - Fill form with product name + kcal/100g
- **Add Item Form:**
  - Product name, quantity, unit (g/ml/pièce/litre)
  - Category (dropdown)
  - Expiry date
  - Price (EUR)
  - kcal/100g (auto-filled from API, editable)
- **Category Filter:** Dropdown to show only one category
- **Inventory List:** Cards per item
  - Name, quantity, unit
  - Expiry date with days remaining (red if < 3 days)
  - kcal/100g
  - Button "Consommer" → log to History_[user]
  - Button "Supprimer"
  - Button "Éditer" → opens edit modal

**Data flow:**
1. Load Inventaire tab
2. Render list, grouped/filtered by category
3. On scanner: call Open Food Facts API → parse JSON → extract name + kcal
4. On add: append row to Inventaire + update memory
5. On consume: create History entry with product name, qty eaten, kcal
6. On delete: mark consumed=true (soft delete) or remove row
7. On edit: update Sheets + memory

**Modules used:** Auth, UserContext, SheetsAPI, InventoryAPI, Utils, open-food-facts API

---

### 6. **Profils (profils.html)** — User Profile & History
**Purpose:** Manage profile, view meal history, track weight and statistics.

**Sections:**
1. **Profil Tab:**
   - Display: Name, height, weight, IMC, BMR, TDEE, calorie target, diet
   - Edit button → form to update taille/poids/calories
   - Save recalculates BMR/TDEE

2. **Historique Tab:**
   - List of days with total kcal consumed
   - Format: "Lundi 26 mai 2026 : 1346 kcal" → button to expand
   - Expand shows: list of meals eaten that day (from History_[user])
   - Detail modal shows each meal with time, qty, kcal

3. **Stats Tab:**
   - Summary cards: avg kcal/day, avg weight, weight lost/gained
   - Chart: last 30 days kcal consumption (Chart.js line chart)
   - Chart: last 30 days weight (Chart.js line chart)
   - Button to log weight: input weight → append to weight log

**Data flow:**
1. Load Profils tab (current profile)
2. Load History_[user] tab, group by date
3. For each day, sum kcal
4. Render historique list
5. On day click: load details for that date
6. For stats: aggregate last 30 days, render charts

**Modules used:** Auth, UserContext, SheetsAPI, Utils, Chart.js

---

### 7. **Courses (courses.html)** — Shopping List
**Purpose:** Generate shopping list from weekly plan.

**Sections:**
- **Header:** Week date, "Générer" button
- **Shopping List:**
  - Grouped by category (Fruits, Légumes, Viandes, etc)
  - Item: name, needed quantity, unit
  - Checkbox to mark bought
  - Total price estimation

**Data flow:**
1. Load this week's Planning
2. For each recipe scheduled:
   - Load recipe from RecipesAPI
   - Get ingredients
3. For each ingredient:
   - Check Inventaire for current quantity
   - Needed = (recipe qty * portions) - (inventory qty)
   - If needed > 0, add to list
4. Group by category
5. Render

**Modules used:** Auth, UserContext, SheetsAPI, RecipesAPI, InventoryAPI, Utils

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
- Courses shown from Planning

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

### Flow 3: Plan Next Week
1. User on Planning
2. Taps "Suivant" to go to next week
3. Taps Monday Midi cell → recipe picker
4. Selects "Pâtes Carbonara" (2 portions)
5. Planning tab updates: Monday Midi_Recette = recipe_id_1, Midi_Portions = 2
6. User taps "Générer liste de courses"
7. App calculates:
   - Pâtes Carbonara ingredients: 400g pâtes, 3 œufs, 150g lardons (per 2 portions)
   - Check Inventaire: 100g pâtes in stock → need 300g more
   - Check Inventaire: 0 eggs → need 3
   - Check Inventaire: 200g lardons in stock → need -50g (don't buy)
8. Shopping list: Pâtes 300g, Œufs 3 pièces
9. Redirect to Courses page with list

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

