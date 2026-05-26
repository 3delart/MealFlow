# MealFlow V2 — Design Specification

**Date:** 2026-05-26  
**Project:** MealFlow V2 — rebuilt from scratch  
**Users:** Florian + Naomi (2 people, shared data where noted)  
**Tech Stack:** Vanilla HTML/CSS/JS + GitHub Pages + Google Sheets (backend)

---

## 1. Overview

MealFlow V2 is a mobile-first web app for meal logging, recipe management, weekly planning, inventory tracking, and nutrition history. Two users (Florian and Naomi) share some data (recipes, planning, courses) while keeping personal data separate (consumption journal, calorie history, stats).

---

## 2. Architecture

### Frontend
- Vanilla JS, multi-page HTML (one `.html` file per page)
- No build step — deploys directly to GitHub Pages
- Mobile-first CSS, green color theme (`--primary: #2e7d32`)

### Backend
- Single Google Spreadsheet **"MealFlow-V2"**
- Read: Google Sheets API v4 with public API key (no auth required)
- Write: Google OAuth 2.0 (GIS) access token, persisted in localStorage

### JS Module Structure
```
js/
  auth.js           → OAuth persistent token, email→user mapping, silent re-auth
  sheets-api.js     → all Sheets read/write/append/update/clear ops
  recipes.js        → CRUD recipes (reads/writes RecettesJSON cell A1)
  inventory.js      → inventory CRUD + Open Food Facts API
  user-context.js   → current user state (derived from OAuth email)
  utils.js          → shared helpers (date, kcal calc, format)

  accueil.js        → daily journal, "j'ai mangé" modal
  planning.js       → weekly grid, recipe picker, week navigation
  courses.js        → auto-generate shopping list from planning + inventory diff
  profils.js        → profile view/edit, historique list, stats charts
  recettes.js       → recipe list, add/edit/delete UI
```

---

## 3. Google Sheets Structure

### Tab: `Profils`
| User | Prénom | Email | Taille_cm | Poids_kg | Âge | Sexe | Activité | Objectif | Régime | Allergies_JSON | Calories_cible |
|---|---|---|---|---|---|---|---|---|---|---|---|
| florian | Florian | florian@gmail.com | 180 | 75 | 32 | M | Modéré | Perte modérée | Omnivore | [] | 2100 |
| naomi | Naomi | naomi@gmail.com | 165 | 62 | 28 | F | Modéré | Perte modérée | Omnivore | [] | 1800 |

**Email column** is used to map Google OAuth identity → user profile automatically.

### Tab: `Planning`
| Date | Jour | Midi_RecetteID | Soir_RecetteID |
|---|---|---|---|
| 2026-05-26 | lundi | pates_bolo | salade_grecque |
| 2026-05-27 | mardi | poulet_roti | |

**Shared between Florian and Naomi.**

### Tab: `Inventory`
| ID | Produit | Qty | Unité | Catégorie | Date_ajout | Péremption | Prix | Kcal_per_100 | Protéines_per_100 | Glucides_per_100 | Lipides_per_100 | Consommé |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| uuid | Pâtes rigatoni | 500 | g | Féculents | 2026-05-20 | 2026-08-01 | 1.20 | 350 | 12 | 70 | 2 | FALSE |

### Tab: `RecettesJSON`
- Cell **A1** contains the full recipes JSON string.
- Read: one API call, `JSON.parse()`
- Write: `updateSheetCell("RecettesJSON!A1", JSON.stringify(recipes), token)`

**Recipes JSON structure:**
```json
{
  "pates_bolo": {
    "name": "Pâtes bolognaise",
    "tags": ["omnivore", "30min"],
    "prep_minutes": 30,
    "portions": 2,
    "steps": [
      "Faire revenir le bœuf haché avec l'ail, 5 min.",
      "Ajouter la sauce tomate, mijoter 15 min.",
      "Cuire les pâtes al dente (10 min).",
      "Servir et râper le parmesan."
    ],
    "ingredients": [
      {"name": "Pâtes rigatoni", "quantity": 200, "unit": "g"},
      {"name": "Bœuf haché", "quantity": 300, "unit": "g"},
      {"name": "Sauce tomate", "quantity": 400, "unit": "g"},
      {"name": "Parmesan", "quantity": 40, "unit": "g"},
      {"name": "Ail", "quantity": 2, "unit": "pièce"}
    ]
  }
}
```

**Shared between Florian and Naomi.**

### Tabs: `History_florian` / `History_naomi`
| Date | Heure | Nom | Quantité | Unité | Kcal_total | Type | Recette_ID |
|---|---|---|---|---|---|---|---|
| 2026-05-26 | 12:14 | Pâtes bolognaise | 350 | g | 648 | recette | pates_bolo |
| 2026-05-26 | 07:45 | Croissant | 80 | g | 300 | scanner | |

**Type values:** `recette` / `scanner` / `inventaire` / `manuel`  
**Per-user — not shared.**

---

## 4. Authentication

### Flow
1. App starts → `auth.js` attempts silent token request (`prompt: ""`)
2. If token valid → decode Google email → match to `Profils` tab `Email` column → set user
3. Token + email stored in localStorage → persists between sessions
4. If token expired/missing → show "Se connecter avec Google" button → OAuth consent → token obtained
5. On successful auth → reload data for identified user

### User Context
- `user-context.js` exposes `getCurrentUser()` → returns `"florian"` or `"naomi"`
- Derived from OAuth email, not a manual toggle
- Shared pages (Planning, Courses, Recettes) ignore user context for data
- Per-user pages (Accueil, Profils, Historique, Stats) filter by current user

---

## 5. Pages

### 5.1 — Accueil (`index.html`) — Per-user

**Components:**
- Header: "Bonjour [Prénom]", date du jour, user chip (vert)
- Progress circle SVG: `consumed / target * 100%`, color turns orange if >100%
- Caption: `1 346 / 2 100 kcal`
- Button: **"🍴 J'ai mangé"** → bottom sheet modal
- Journal du jour: scrollable list, newest first — `[emoji] [Nom] · [qty][unit] · [HH:MM] · [kcal] kcal`

**"J'ai mangé" modal — 4 options:**
1. **📱 Scanner un produit** → barcode → Open Food Facts → qty input → log
2. **📖 Choisir une recette** → list of recipes → qty input (grams) → auto-calc kcal → log
3. **📦 Chercher dans l'inventaire** → search inventory → qty input → auto-calc kcal → log
4. **✏️ Saisie manuelle** → name + kcal → log

**On log:**
- Append row to `History_[user]` via OAuth
- Update localStorage cache for today's journal
- Re-render progress circle + journal list

**Calorie calculation for recipes:**
```
total_kcal = sum(ingredient.quantity * inventory[ingredient.name].kcal_per_100 / 100)
kcal_per_100g = total_kcal / total_weight_g * 100
portion_kcal = (eaten_grams / 100) * kcal_per_100g
```
If ingredient not found in inventory → 0 kcal contribution, show warning.

**Midnight rollover:** detect date change → reset journal display (history data stays in Sheets).

---

### 5.2 — Recettes (`recettes.html`) — Shared

**Components:**
- Button **"➕ Ajouter une recette"** at top
- Search bar (filter by name or tag)
- Recipe cards list: name, tags, prep time, portions, `kcal/100g` (calculated), ingredient count
- Tap card → recipe detail view (ingredients + steps) with Edit / Delete buttons

**Add/Edit recipe form:**
- Name (text)
- Tags: multi-select chips (`végétarien`, `vegan`, `rapide`, `omnivore`, `sans gluten`)
- Prep time (minutes)
- Portions (number)
- Ingredients: dynamic list — add row `[name input] [qty] [unit select]` — ingredient name auto-completes from inventory
- Steps: dynamic list — numbered textareas
- Save → `JSON.stringify` updated recipes → `updateSheetCell("RecettesJSON!A1", ...)`

**Delete:** remove key from JSON → re-save.

**kcal/100g calculation** (frontend, on-the-fly):
- For each ingredient, look up `Kcal_per_100` in inventory by name match
- `total_kcal = Σ (qty * kcal_per_100 / 100)`
- `kcal_per_100g = total_kcal / total_weight * 100`
- Display live as user builds the recipe

---

### 5.3 — Planning (`planning.html`) — Shared

**Components:**
- Week navigation: `◀ Préc. | 26 mai – 1 juin | Suiv. ▶` (can navigate weeks ahead/back freely)
- Weekly grid: 7 rows (days) × 2 columns (Midi / Soir)
- Today's row: green background + "Aujourd'hui" badge
- Filled cell: green background, recipe name in green
- Empty cell: dashed border, "+ Choisir" text → tap opens recipe picker modal
- Recipe picker modal: search + list of recipes with kcal/100g
- Button: **"🛒 Générer liste de courses"** → navigates to courses page
- Button (per day): **"🍳 Voir recette"** → navigates to recette du jour sub-view

**Data:** read/write `Planning` tab. Date format: `YYYY-MM-DD`.

---

### 5.4 — Recette du jour (sub-view within Planning)

**Accessible from:** Planning page (tap "Voir recette" on a day row).

**Components:**
- Toggle: Midi / Soir
- Recipe hero card: name, tags, `kcal/100g`, prep time, portions
- Ingredients list with **inventory status per ingredient:**
  - ✓ en stock (green) — sufficient qty
  - ⚠ Xg restants (orange) — less than needed
  - ✗ manquant (red) — not in inventory at all
- Numbered steps
- Button: **"✓ J'ai cuisiné ça — Logger"** → opens qty input → logs to History + decrements inventory

---

### 5.5 — Inventaire (`inventory.html`) — Shared

**Components:**
- Button **"📱 Scanner un produit"** at top → barcode scanner → Open Food Facts auto-fill
- Stats row: `[N articles en stock] [N expirent bientôt]`
- Expiry banner (if any): "⚠ Yaourt, Lait — expirent dans <3 jours"
- Category filter dropdown
- Inventory list **grouped by category** (rayon): category header → items
- Each item: name, qty+unit, expiry date (orange if <3 days, red if expired), kcal/100g
- Tap item → edit modal (qty, expiry, category, price)
- Swipe or button: mark as consumed (soft-delete, `Consommé = TRUE`)

**Add item form** (shown after scanner or manual tap):
- Product name (auto-filled from Open Food Facts)
- Qty, Unité, Catégorie, Date péremption, Prix
- Nutrition (auto-filled if available): Kcal/100g, Protéines, Glucides, Lipides

---

### 5.6 — Courses (`courses.html`) — Shared

**Generation algorithm:**
1. Fetch Planning for current week (7 days)
2. For each recipe in planning → fetch ingredients from RecettesJSON
3. Aggregate ingredients: same name → sum quantities
4. Compare with Inventory: subtract available qty
5. Result: items with `needed_qty > 0` = shopping list

**Components:**
- Button **"🔄 Regénérer"** (re-runs algorithm)
- List grouped by category
- Each item: `[Produit] — [qty needed] [unit]` with checkbox
- Checked = bought → tap to add to inventory (shortcut)
- Manual add button: add item not linked to a recipe
- Estimated total price (if prices available in inventory)

---

### 5.7 — Profils (`profils.html`) — Per-user

**3 sub-tabs per user:**

#### Sub-tab: Profil
- Display: Prénom, Poids, Taille, IMC, BMR, TDEE, Calories cible, Régime
- BMR calculated client-side (Mifflin-St Jeor)
- Edit button → inline form to update profile → writes to `Profils` tab

#### Sub-tab: Historique
- List of days, newest first: `[Jour DD mois YYYY] — [N kcal] — [Voir détail button]`
- Today highlighted with green left border + "en cours" sub-label
- Days exceeding calorie target: kcal shown in orange
- "Voir détail" → sub-view showing all entries for that day (name, qty, time, source type)

#### Sub-tab: Stats
- Summary row: `[Moy. kcal/jour] [Jours dans objectif] [Évolution poids]`
- Chart 1: Calories 30 days — line chart, yellow dashed line = target
- Chart 2: Poids 30 days — line chart, shows trend direction + delta
- Weight input: `[number input] kg [OK button]` → appends to today's History row

**Charts:** rendered with Chart.js (CDN).

---

## 6. Navigation

Bottom nav bar (5 tabs, always visible):

| Tab | Page | Per-user? |
|---|---|---|
| 🏠 Accueil | index.html | ✅ Per-user |
| 📖 Recettes | recettes.html | 🔗 Shared |
| 📅 Planning | planning.html | 🔗 Shared |
| 📦 Inventaire | inventory.html | 🔗 Shared |
| 👤 Profils | profils.html | ✅ Per-user |

Courses and Recette du jour are sub-views accessible from Planning (not separate nav tabs).

---

## 7. Calorie Calculation Logic

### For a logged recipe portion:
```
recipe_total_kcal = Σ ingredient_i: (qty_i_g / 100) × kcal_per_100_i
recipe_total_weight = Σ qty_i_g
recipe_kcal_per_100g = recipe_total_kcal / recipe_total_weight × 100
portion_kcal = (eaten_grams / 100) × recipe_kcal_per_100g
```

### For a logged inventory item:
```
portion_kcal = (eaten_grams / 100) × item.kcal_per_100
```

### For a scanned product:
```
portion_kcal = (eaten_grams / 100) × open_food_facts_kcal_per_100g
```

### For manual entry:
```
portion_kcal = user_entered_kcal (no calculation)
```

---

## 8. Error Handling

| Scenario | Behavior |
|---|---|
| Sheets API unavailable | Show localStorage cache + "Mode hors-ligne" banner |
| No OAuth token | Read-only mode; write actions show "Connexion requise" toast |
| Ingredient not in inventory | 0 kcal contribution + orange warning "X non trouvé dans l'inventaire" |
| Recipe deleted while in planning | Planning cell shows "Recette supprimée" in red |
| Barcode not in Open Food Facts | Manual form shown, user enters name + kcal manually |
| Token expired mid-session | Silent re-auth attempt; if fails → toast "Session expirée, reconnexion..." |

---

## 9. Data Sharing Model

| Data | Storage | Shared? |
|---|---|---|
| Recipes | Sheets `RecettesJSON` | ✅ Florian + Naomi |
| Planning | Sheets `Planning` | ✅ Florian + Naomi |
| Inventory | Sheets `Inventory` | ✅ Florian + Naomi |
| Shopping list | Derived (Planning + Inventory) | ✅ Florian + Naomi |
| Daily journal | localStorage + Sheets `History_[user]` | ❌ Per-user |
| Calorie history | Sheets `History_[user]` | ❌ Per-user |
| Weight history | Sheets `History_[user]` | ❌ Per-user |
| Profile (BMR, target) | Sheets `Profils` | ❌ Per-user |

---

## 10. File Structure

```
MealFlow/
├── index.html          (Accueil)
├── recettes.html       (Recettes)
├── planning.html       (Planning + Recette du jour sub-view)
├── inventory.html      (Inventaire)
├── courses.html        (Courses — generated from Planning)
├── profils.html        (Profils + Historique + Stats)
├── css/
│   ├── style.css       (shared: variables, nav, buttons, modals, cards)
│   ├── accueil.css
│   ├── recettes.css
│   ├── planning.css
│   ├── inventory.css
│   ├── courses.css
│   └── profils.css
├── js/
│   ├── auth.js
│   ├── sheets-api.js
│   ├── recipes.js
│   ├── inventory.js    (module + Open Food Facts)
│   ├── user-context.js
│   ├── utils.js
│   ├── accueil.js
│   ├── planning.js
│   ├── courses.js
│   ├── profils.js
│   └── recettes.js
└── docs/
    └── superpowers/
        └── specs/
            └── 2026-05-26-mealflow-v2-design.md
```

---

## 11. Success Criteria

- [ ] Google OAuth login → auto-identifies user from email, persists between sessions
- [ ] Accueil: "J'ai mangé" logs correctly from all 4 sources, updates circle in real-time
- [ ] Recettes: add/edit/delete recipes with ingredient list + steps, kcal/100g calculated live
- [ ] Planning: 7×2 grid navigable by week, today highlighted, recipe picker works
- [ ] Recette du jour: shows ingredient inventory status correctly
- [ ] Inventaire: grouped by category, expiry alerts, barcode scanner, Open Food Facts auto-fill
- [ ] Courses: auto-generated from planning + inventory diff, grouped by category
- [ ] Profils: historique list per user, stats charts (30j calories + weight), weight input
- [ ] All shared pages show identical data for Florian and Naomi
- [ ] Offline mode: localStorage cache shown with banner when Sheets unreachable
- [ ] Mobile responsive (320px+)
