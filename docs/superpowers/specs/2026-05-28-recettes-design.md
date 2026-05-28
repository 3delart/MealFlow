# Recipes Page — Design Specification

**Date:** 2026-05-28  
**Feature:** Recipes (Recettes) page with CRUD, display, and automatic calorie calculation  
**Users:** Florian + Naomi (shared recipes)  
**Tech Stack:** Vanilla HTML/CSS/JS, Google Sheets (RecettesJSON!A1)

---

## 1. Overview

Recipes page allows users to create, view, edit, and delete recipes. Each recipe includes:
- Name and description
- Ingredients (matched to inventory for automatic calorie lookup)
- Preparation and cooking time
- Tags (user-defined)
- Step-by-step preparation instructions
- Automatic calorie calculation (total and per 100g)

Recipes are stored as JSON in `RecettesJSON!A1` of the Google Sheet and synchronized on every create/edit/delete.

---

## 2. Architecture

### Files

- **`recettes.html`** — Page structure
  - Header: "Recettes" title + "➕ Ajouter recette" button
  - Container: Recipe list (cards)
  
- **`recettes.js`** — Core data and list logic
  - Load recipes from RecettesJSON!A1 on startup
  - Render recipe cards (list view)
  - Handle create/edit/delete triggers
  - Sync to Google Sheets after mutations
  - State: `recipesData = {recipe_id: recipe_obj}`

- **`recettes-forms.js`** — Modal forms
  - Modal: Create new recipe
  - Modal: View recipe (read-only, "cook mode")
  - Modal: Edit existing recipe
  - Form field management (ingredient rows, steps rows, etc.)

### State Management

```javascript
recipesData = {
  "pates_carbonara": { name, description, prep_minutes, cook_minutes, tags, ingredients, steps },
  "salade_grecque": { ... }
}
```

Load on `DOMContentLoaded` → `loadRecipes()` → `recipesData` → `renderRecipeList()`  
Sync after each mutation → `syncRecipesToSheets()`

---

## 3. Google Sheets Storage

### Tab: `RecettesJSON`

Cell **A1** contains stringified JSON:

```json
{
  "pates_carbonara": {
    "name": "Pâtes carbonara",
    "description": "Une recette délicieuse à base de pâtes fraîches...",
    "prep_minutes": 15,
    "cook_minutes": 20,
    "tags": ["italien", "rapide"],
    "ingredients": [
      {
        "name": "Pâtes",
        "quantity": 100,
        "unit": "g",
        "calories_per_100": 350
      },
      {
        "name": "Sauce tomate",
        "quantity": 200,
        "unit": "g",
        "calories_per_100": 80
      }
    ],
    "steps": [
      "Cuire les pâtes dans l'eau bouillante salée pendant 10 minutes.",
      "Égouter les pâtes et réserver.",
      "Réchauffer la sauce tomate dans une casserole.",
      "Verser la sauce chaude sur les pâtes et bien mélanger."
    ]
  }
}
```

**Read:** `SheetsAPI.readSheetTab("RecettesJSON")` → parse A1 → `JSON.parse()`  
**Write:** `updateSheetCell("RecettesJSON!A1", JSON.stringify(recipesData), token)`

---

## 4. User Interface

### List View (recettes.html)

**Header:**
- Title: "Recettes"
- Button: "➕ Ajouter recette" (green, top-right, triggers Create modal)

**Recipe Card:**
```
┌─────────────────────────────────────────────┐
│ 🍝 Pâtes carbonara                          │
│ Una recette délicieuse...                   │
│                                             │
│ 🏷️  italien, rapide                         │
│ ⏱️  15 min prep + 20 min cuisson            │
│ 🔥 170 kcal/100g                            │
│                                             │
│ [👁️ Voir]  [✏️ Éditer]                       │
└─────────────────────────────────────────────┘
```

**Card fields:**
- Recipe name (bold, large)
- Description (subtitle, 1-2 lines max)
- Tags (badges/pills)
- Prep + cook time (icons)
- Calories per 100g (calculated)
- Buttons: "Voir" (view) | "Éditer" (edit)

### Modal: Create Recipe

**Structure:**
```
┌──────────────────────────────────────────────┐
│ Nouvelle recette                          ✕  │
├──────────────────────────────────────────────┤
│                                              │
│ Nom de la recette *                          │
│ [Pâtes carbonara                           ] │
│                                              │
│ Description                                  │
│ [Une recette délicieuse à base de pâtes...] │
│                                              │
│ Préparation (min)    │  Cuisson (min)       │
│ [15              ]   │  [20               ] │
│                                              │
│ Tags (séparés par virgule)                   │
│ [italien, rapide                           ] │
│                                              │
│ Ingrédients *                                │
│ ┌──────────────────────────────────────────┐ │
│ │ Produit    │ Qté │ Unité                 │ │
│ ├──────────────────────────────────────────┤ │
│ │ Pâtes ▼    │ 100 │ g    [cal: 350]  ✕   │ │
│ │ Sauce ▼    │ 200 │ g    [cal: 80]   ✕   │ │
│ └──────────────────────────────────────────┘ │
│ [➕ Ajouter ingrédient]                       │
│                                              │
│ Étapes *                                     │
│ ┌──────────────────────────────────────────┐ │
│ │ 1. [Cuire les pâtes dans l'eau...     ] ✕ │
│ │ 2. [Égouter les pâtes...              ] ✕ │
│ │ 3. [Ajouter la sauce...               ] ✕ │
│ └──────────────────────────────────────────┘ │
│ [➕ Ajouter une étape]                        │
│                                              │
│ 🔥 Calories totales: 510 kcal / 170 kcal/100g
│                                              │
│                        [Annuler] [Créer]    │
└──────────────────────────────────────────────┘
```

**Fields:**
- **Nom** (required, text input)
- **Description** (optional, textarea)
- **Préparation (min)** (required, number input)
- **Cuisson (min)** (required, number input)
- **Tags** (optional, comma-separated text input)
- **Ingrédients** (required, dynamic rows)
  - Each row: autocomplete product name → auto-populate calories_per_100
  - Quantity + Unit dropdowns
  - Delete button per row
- **Étapes** (required, dynamic rows)
  - Each row: textarea for step description
  - Delete button per row
- **Calories display** (auto-calculated, read-only)

### Modal: View Recipe (Cook Mode)

**Structure (read-only, static display):**
```
┌──────────────────────────────────────────────┐
│ Pâtes carbonara                           ✕  │
├──────────────────────────────────────────────┤
│                                              │
│ Una recette délicieuse à base de pâtes...   │
│                                              │
│ ⏱️  Préparation: 15 min                       │
│ 🍳 Cuisson: 20 min                           │
│ 🏷️  Ingrédients: 2                           │
│ 🔥 Calories: 170 kcal/100g (510 total)      │
│                                              │
│ INGRÉDIENTS                                  │
│ ├─ Pâtes: 100 g (350 kcal/100g → 350 kcal) │
│ └─ Sauce tomate: 200 g (80 kcal/100g → 160) │
│                                              │
│ ÉTAPES                                       │
│ 1. Cuire les pâtes dans l'eau bouillante... │
│ 2. Égouter les pâtes et réserver.           │
│ 3. Réchauffer la sauce tomate...            │
│ 4. Verser la sauce chaude...                │
│                                              │
│ [🍽️ J'ai mangé ça]  (future feature)        │
└──────────────────────────────────────────────┘
```

**Fields:**
- Recipe name (title)
- Description
- Time info (prep + cook)
- Calorie summary (total + per 100g)
- Ingredients list (with quantity + individual calories)
- Steps (numbered, easy to read while cooking)

### Modal: Edit Recipe

Identical to Create modal, but pre-populated with existing recipe data.

---

## 5. Calorie Calculation

### Per-Ingredient Calorie

```
ingredient_kcal = calories_per_100 × (quantity / 100)
```

Example:
- Pâtes: 100g @ 350 kcal/100g = **350 kcal**
- Sauce: 200g @ 80 kcal/100g = **160 kcal**

### Recipe Total & Per 100g

```
recipe_total_kcal = SUM(all ingredient_kcal)
recipe_weight_grams = SUM(all ingredient quantities in grams)
recipe_kcal_per_100g = recipe_total_kcal / (recipe_weight_grams / 100)
```

Example (continued):
- Total: 350 + 160 = **510 kcal**
- Total weight: 100 + 200 = 300g
- Per 100g: 510 / 3 = **170 kcal/100g**

### Auto-Population from Inventory

When user selects a product in Create/Edit form:
1. Search `inventoryData` by product name (autocomplete)
2. Retrieve `calories_per_100` from matched item
3. Populate into form, display in calculation
4. Update totals in real-time as user adds/modifies ingredients

---

## 6. Data Flow

### Load (Startup)

```
DOMContentLoaded
  → loadRecipes()
    → SheetsAPI.readSheetTab("RecettesJSON")
    → JSON.parse(A1) → recipesData
  → renderRecipeList()
    → create cards for each recipe
    → attach event listeners (Voir, Éditer)
```

### Create Recipe

```
User clicks "➕ Ajouter recette"
  → openCreateModal()
  → user fills form + clicks "Créer"
  → collectFormData()
  → generateRecipeID(name) // "pates_carbonara"
  → calculateCalories()
  → recipesData[id] = new_recipe
  → syncRecipesToSheets()
  → closeModal()
  → renderRecipeList() // refresh
```

### Edit Recipe

```
User clicks "✏️ Éditer" on card
  → openEditModal(recipe_id)
  → populate form with existing data
  → user modifies + clicks "Sauvegarder"
  → collectFormData()
  → calculateCalories()
  → recipesData[id] = updated_recipe
  → syncRecipesToSheets()
  → closeModal()
  → renderRecipeList() // refresh
```

### Delete Recipe

```
User clicks delete button (in Edit modal or via context menu)
  → confirm dialog
  → delete recipesData[id]
  → syncRecipesToSheets()
  → renderRecipeList() // refresh
```

### Sync to Sheets

```
syncRecipesToSheets(token)
  → JSON.stringify(recipesData)
  → SheetsAPI.updateSheetCell("RecettesJSON!A1", json, token)
  → on success: console.log("Recipes synced")
  → on error: console.warn("Failed to sync") + fall back to localStorage
```

---

## 7. Component Boundaries

### recettes.js

**Responsibilities:**
- Load/save recipesData from/to Sheets
- Render recipe list (cards)
- Handle mutation triggers (create/edit/delete buttons)
- Sync to Sheets after each mutation
- Expose public functions: `loadRecipes()`, `renderRecipeList()`, `syncRecipesToSheets()`

**Dependencies:**
- `SheetsAPI` (read/write Sheets)
- `inventoryData` (for ingredient autocomplete)
- `Utils` (date, calorie calc helpers if needed)

### recettes-forms.js

**Responsibilities:**
- Manage Create/Edit/View modals (open/close)
- Form field population (ingredient rows, step rows)
- Real-time calorie calculation display
- Collect and validate form data
- Call `recettes.js` functions to save/sync

**Dependencies:**
- `recipesData` (for edit pre-population)
- `inventoryData` (for ingredient autocomplete)
- `recettes.js` public functions

---

## 8. Error Handling

**Sheets API failures:**
- Show toast/alert: "Erreur: la recette n'a pas pu être sauvegardée"
- Keep recipe in-memory (not lost)
- Offer retry button

**Missing inventory items:**
- Allow free-text ingredient entry (fallback if autocomplete fails)
- Calculate calories to 0 if no match found

**Form validation:**
- Required: Name, Ingredients (min 1), Steps (min 1), Prep/Cook time
- Show inline error messages for missing fields

---

## 9. Testing

- Load recipes from Sheets on startup
- Create new recipe → verify in Sheets
- Edit recipe → verify calories recalc + Sheets update
- Delete recipe → verify Sheets sync
- Ingredient autocomplete → match inventory names
- Modal open/close → no memory leaks
- Form reset on close → next modal is clean

---

## 10. Future Extensions (Out of Scope)

- "J'ai mangé ça" → log to History_florian / History_naomi
- Recipe ratings (user feedback)
- Recipe search/filter
- Ingredient substitutions
- Multi-user recipe collaboration
- Export recipe to PDF

---

**Status:** Ready for implementation plan.
