# MealFlow Design Specification

**Date:** 2026-05-21  
**Project:** MealFlow — Meal planning, inventory, shopping list, profile management  
**Users:** Florian + Naomi (2 people, synchronized)  
**Tech Stack:** HTML/CSS/JS (vanilla) + GitHub Pages (frontend) + Google Sheets (backend)

---

## 1. Overview

MealFlow is a web app for meal planning, inventory tracking, shopping list management, and personalized nutrition goals. Two users (Florian and Naomi) share the same data with real-time synchronization via Google Sheets.

**Core Features:**
- Weekly meal planning (5 meals/day: Petit-déj, Collation matin, Déjeuner, Collation après-midi, Diner)
- Shopping list with per-user checkboxes
- Home inventory tracking (fridge/pantry with expiration)
- Personalized profiles (calories, objectives, dietary restrictions, preferences)
- Daily recipe display
- Multi-user context (toggle between Florian/Naomi)

---

## 2. Architecture

### Frontend (GitHub Pages)
Hosted on GitHub Pages. Single-page app pattern with static HTML files.

**Pages:**
- `index.html` — Landing page with navigation hub
- `planning.html` — Weekly meal planning (5 meals × 7 days grid)
- `courses.html` — Shopping list with categories and checkboxes
- `inventory.html` — Home inventory (add/view/mark consumed)
- `profils.html` — User profiles (Florian + Naomi)
- `recette.html` — Daily recipe viewer

**Authentication:** Simple context switch (toggle "Florian" / "Naomi" at top of each page). No real login — just localStorage-based preference.

**API Integration:** Google Sheets API v4 (read/write JSON data from frontend).

### Backend (Google Sheets)
Single Google Sheet named "MealFlow-Data" with 5 named tabs:

1. **Planning** — Weekly meal schedule
2. **Courses** — Shopping list items
3. **Inventory** — Home inventory (fridge/pantry)
4. **Profils** — User profile data (Florian + Naomi)
5. **Recipes** — Recipe database (reserved for future)

---

## 3. Data Schema

### Tab 1: Planning

| Date | Jour | Petit-déj | Collation_matin | Déjeuner | Collation_après-midi | Diner |
|------|------|-----------|-----------------|----------|----------------------|-------|
| 2026-05-18 | Lun | Moi | Moi + Naomi | Moi seul | Moi + Naomi | Naomi seule |

**Values:** "Moi" (Florian only), "Naomi" (Naomi only), "Moi + Naomi" (both), or recipe name.

**Display:** Frontend transforms into 5×7 grid (5 meal types as rows, 7 days as columns). Cells are editable (click to change meal or assignment).

### Tab 2: Courses

| Item | Qty | Unité | Prix | Catégorie | Florian_checked | Naomi_checked | Date_création |
|------|-----|-------|------|-----------|-----------------|---------------|---------------|
| Pain Complet | 400 | g | 1.80 | Pain | FALSE | FALSE | 2026-05-21 |
| Tomates Cerises | 400 | g | 2.50 | Fruits & Légumes | TRUE | FALSE | 2026-05-20 |

**Per-user checkboxes:** Each user can check items independently (soft sync — both see their own state).

### Tab 3: Inventory

| Produit | Qty | Unité | Catégorie | Date_ajout | Péremption | Consommé |
|---------|-----|-------|-----------|-----------|-----------|----------|
| Tomate | 5 | pièce | Légumes | 2026-05-21 | 2026-05-25 | FALSE |
| Lait | 1 | litre | Produits laitiers | 2026-05-20 | 2026-05-27 | FALSE |

**Lifecycle:** Add item → view by category → mark consumed (soft-delete, not truly removed). Can filter "expiring soon" (< 3 days).

### Tab 4: Profils

| User | Prénom | Taille_cm | Poids_kg | Âge | Sexe | Activité | Objectif | Régime | Allergies_JSON | Aversions_JSON | Cuisines_JSON | Niveau_culinaire | Durée_max_prep | Calories_cible_manuel |
|------|--------|-----------|----------|-----|------|----------|----------|--------|-----------------|-----------------|---------------|-----------------|-----------------|----------------------|
| florian | Florian | 180 | 75.5 | 32 | M | Modéré | Perte | Omnivore | [] | [] | ["Méditerranéenne","Asiatique"] | Expert | Moyenne | null |
| naomi | Naomi | 165 | 62.0 | 29 | F | Sédentaire | Maintien | Végane | ["arachides"] | ["oeufs"] | ["Asiatique"] | Intermédiaire | Rapide | null |

**Calculations (frontend):**
- **BMR** = Mifflin-St Jeor formula: `(10×W + 6.25×H - 5×A ± 5) × gender_coef`
- **TDEE** = BMR × activity_coefficient
  - Sédentaire: 1.2
  - Léger: 1.375
  - Modéré: 1.55
  - Actif: 1.725
  - Très actif: 1.9
- **Objective Adjustment:**
  - Perte légère: TDEE - 250
  - Perte modérée: TDEE - 500
  - Perte agressive: TDEE - 750
  - Maintien: TDEE ± 0
  - Prise de masse: TDEE + 300

### Tab 5: Recipes

Reserved for future expansion (currently unused).

---

## 4. Frontend Pages

### index.html (Landing/Hub)
- Header with app title + user toggle (Florian/Naomi)
- 5 main navigation buttons:
  1. Planning
  2. Courses
  3. Inventory
  4. Profils
  5. Today's Recipe
- Optional: Budget estimate, daily calories, upcoming meals

### planning.html (Weekly Meal Grid)
- **Display:** 5 rows (meal types) × 7 columns (days of week)
- **Cells:** Editable — click to select meal or user assignment
- **Features:**
  - Add/edit meal per cell
  - Link recipe to meal
  - Color-code by user (Florian: pink, Naomi: purple, both: green)
  - Navigation: prev/next week
  - Show daily calorie totals (from Profils data)

### courses.html (Shopping List)
- **Reuse existing code** — already functional
- **Sync change:** Fetch/write to Google Sheets "Courses" tab
- **Per-user checkboxes:** Florian & Naomi each see/control their own state
- **Features:**
  - Filter by category
  - Budget total (sum of Prix where not checked)
  - Clear checked items option
  - Add custom item modal (already exists)

### inventory.html (Home Inventory)
- **Add Item Form:** Name, Qty, Unité, Catégorie, Péremption
- **Display:** Group by category (Légumes, Produits laitiers, etc.)
- **Per-item actions:**
  - Mark consumed (hide from view, don't delete)
  - See expiration date
  - Edit qty
- **Filters:**
  - "Expiring soon" (< 3 days to expiration)
  - By category
- **Future:** Barcode scan via Open Food Facts API

### profils.html (User Profiles)
- **Two cards:** Florian + Naomi
- **Each card shows:**
  - Prénom, Taille, Poids, IMC
  - BMR, TDEE, Calories cible (calculated)
  - Objectif, Régime, Allergies, Aversions
  - Cuisines préférées, Niveau culinaire, Durée max prep
- **Edit button per user:** Modal form to update profile
- **Height:** Show calculated BMR/TDEE in real-time as user edits

### recette.html (Daily Recipe)
- **Reuse existing code** — already functional
- **Sync change:** Link to Google Sheets "Recipes" tab (if used)
- **Features:**
  - Show today's meal (from Planning tab, current date)
  - Display ingredients + steps
  - Show calories per user
  - Navigation: prev/next recipe

---

## 5. Google Sheets API Integration

**Setup:**
1. Create Google Sheet "MealFlow-Data"
2. Share with both users (Florian + Naomi)
3. Generate API key (public, read-only) or OAuth2 (for write access)
4. Embed key in frontend code (or use GitHub secrets for sensitive data)

**Frontend Flow:**
- Page loads → fetch tab data via `sheets.googleapis.com/v4/spreadsheets/[SHEET_ID]/values/[TAB_NAME]`
- User edits → write changes back via same API
- Both users' browsers auto-refresh on tab focus (or poll every 10s)

**Sync Strategy:**
- Read-heavy: fetch on page load + periodic (10s interval)
- Write: send immediately on user action
- Conflict resolution: last-write-wins (simple, sufficient for 2 users)

---

## 6. User Context (Florian/Naomi)

**Global state:** localStorage stores current user (`mealflow_user: "florian"` or `"naomi"`).

**Per-page behavior:**
- **Planning:** Filter to show only selected user's meals
- **Courses:** Show selected user's checkbox state only
- **Inventory:** Shared across both (no filtering by user)
- **Profils:** Show selected user's full profile + option to view other
- **Recette:** Show selected user's calorie allocation for today's meal

**UI:** Toggle button in page header, persists on refresh.

---

## 7. Error Handling & Edge Cases

- **Sheet API unavailable:** Show cached data (localStorage) + "offline mode" banner
- **Concurrent edits:** Last-write-wins (log timestamp to detect)
- **Missing profile data:** Pre-fill with sensible defaults; show warning
- **Invalid date in Planning:** Highlight red, prevent save
- **Expired inventory items:** Show in separate "Expired" section
- **Budget overrun:** Highlight courses total in red if > estimated budget

---

## 8. Future Features (Out of Scope)

- Barcode scanning (Open Food Facts API)
- Meal generation algorithm (auto-suggest meals based on profiles + inventory)
- Weight tracking (historical graph)
- Recipe database with detailed nutrition
- Meal calendar history
- Grocery store integration (price lookup)

---

## 9. File Structure

```
MealFlow/
├── index.html
├── planning.html
├── courses.html
├── inventory.html
├── profils.html
├── recette.html
├── css/
│   ├── style.css (shared styles)
│   ├── planning.css
│   ├── profils.css
│   └── ...
├── js/
│   ├── sheets-api.js (Google Sheets integration)
│   ├── utils.js (shared utilities)
│   ├── planning.js
│   ├── inventory.js
│   ├── profils.js
│   └── ...
├── docs/
│   └── superpowers/
│       └── specs/
│           └── 2026-05-21-mealflow-design.md (this file)
└── README.md
```

---

## 10. Success Criteria

- [ ] All 6 pages render correctly on desktop + mobile
- [ ] Google Sheets API reads/writes sync between Florian + Naomi devices
- [ ] Planning grid displays 5 meals × 7 days, editable
- [ ] Profils calculate BMR/TDEE correctly
- [ ] Courses list persists checkboxes per user
- [ ] Inventory tracks expiration, filters "expiring soon"
- [ ] User toggle (Florian/Naomi) changes context consistently across all pages
- [ ] Offline mode (localStorage fallback) works
- [ ] No sensitive data exposed in frontend code

---

## 11. Notes

- **API Key Security:** Consider using GitHub secrets for API key, or OAuth2 flow for better security
- **Mobile:** All pages must be responsive (480px+ width)
- **Performance:** Lazy-load Sheets data; cache in localStorage
- **Testing:** Manual testing on both Android + iOS (or desktop browsers)
