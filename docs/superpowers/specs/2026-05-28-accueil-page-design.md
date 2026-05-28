# Accueil (Home) Page — Design Specification

**Date:** 2026-05-28  
**Feature:** Daily calorie tracking with meal logging and consumption history  
**Users:** Florian + Naomi (separate consumptions, goals, histories)  
**Tech Stack:** Vanilla JS, Google Sheets (Planning, History_florian, History_naomi, Profils tabs)

---

## 1. Overview

Accueil page is the daily dashboard. Users see today's planned meals (Midi/Soir only), log consumption via "Manger" (for recipes) or "Consommer" (for any inventory item), and track calories against a daily goal. Calorie wheel visualizes progress (consumed ÷ goal × 100%).

---

## 2. Architecture

### Files

- **`index.html`** — Page structure
  - Calorie wheel (circular progress)
  - Today's planned meals section
  - Consume buttons (Manger per meal, Consommer generic)
  - Real-time consumption log
  
- **`js/accueil.js`** — Core page logic
  - Load today's meals from Planning tab (filter by date = today)
  - Load daily goal from Profils tab (per user)
  - Load today's consumptions from History_[user] tab
  - Render wheel + meals + log
  - Handle Manger / Consommer consumption logging
  - State: `todaysMeals`, `dailyGoal`, `todaysConsumptions`

- **`js/accueil-ui.js`** (new) — Modal forms
  - Modal: Qty input for "Manger" (recipe quantity → auto-calc kcal)
  - Modal: Product picker + qty for "Consommer" (any inventory item)
  - Submit → append to History_[user] tab
  
- **`css/accueil.css`** (if needed) — Calorie wheel styling

### State Management

```javascript
todaysMeals = [
  { type: "Midi", name: "Salade maïs surimi", kcal_per_100: 201 },
  { type: "Soir", name: "", kcal_per_100: null }  // empty
]

dailyGoal = 2000  // kcal (from Profils)

todaysConsumptions = [
  { time: "12:30", name: "Maïs doux", qty: 100, unit: "g", kcal_total: 102, type: "meal" },
  { time: "15:00", name: "Surimi", qty: 50, unit: "g", kcal_total: 85, type: "snack" }
]
```

Load on `DOMContentLoaded` → fetch data from sheets → render all components → listen for consumption

---

## 3. UI Components

### Calorie Wheel

Circular progress visualization:
```
     ⭕ 45%
  
  Remaining: 1,100 kcal
```

- Center: percentage consumed (consumed ÷ goal × 100)
- Below: "Remaining: XXX kcal"
- Arc: filled from 0% to current % (green if under goal, orange if near, red if over)
- Updates in real-time after each consumption

### Meals Section

Header: "🍽️ Repas du jour"

For each meal (Midi/Soir):
```
🍽️ MIDI — Salade maïs surimi
  [Manger] button
  
🌙 SOIR — (empty, no recipe planned)
  [Manger] button
```

If no meal planned, show "Aucun repas prévu" in gray.

### Consume Buttons

Two action buttons:
1. **[Manger]** — One per meal. Opens modal with qty input. Calculates qty × (kcal_per_100 ÷ 100).
2. **[Consommer]** — Generic button. Opens modal with product dropdown + qty. Auto-calculates from inventory calories.

### Consumption Log

Real-time list of today's consumptions:

```
Heure    | Aliment         | Qty   | Kcal  | Action
---------|-----------------|-------|-------|--------
12:30    | Maïs doux       | 100g  | 102   | [✕]
15:00    | Surimi          | 50g   | 85    | [✕]
```

- Sorted by time (newest first or chronological, TBD)
- Delete button per row (removes from History tab + updates wheel)
- Empty state: "Aucune consommation aujourd'hui"

---

## 4. Data Flow

### Page Load

```
DOMContentLoaded
  → getUserContext() → get current user (Florian or Naomi)
  → loadTodaysMeals() → filter Planning tab by date = today
  → loadDailyGoal() → fetch from Profils tab
  → loadTodaysConsumptions() → fetch from History_[user] where date = today
  → renderWheel()
  → renderMeals()
  → renderConsumptionLog()
```

### Manger (Recipe Meal)

```
User clicks [Manger] on Midi/Soir
  → openQtyModal(mealName, kcal_per_100)
  → user enters qty (e.g., "150")
  → calculates: kcal_total = 150 × (kcal_per_100 ÷ 100)
  → user clicks "Manger"
  → appendToHistory(date, time, mealName, qty, "g", kcal_total, "meal")
  → re-renderWheel()
  → re-renderConsumptionLog()
  → closeModal()
```

### Consommer (Any Inventory Item)

```
User clicks [Consommer]
  → openProductModal()
  → user selects product from inventory dropdown
  → user enters qty
  → calculates: kcal_total = qty × (inventory.kcal_per_100 ÷ 100)
  → user clicks "Consommer"
  → appendToHistory(date, time, productName, qty, unit, kcal_total, "snack")
  → re-renderWheel()
  → re-renderConsumptionLog()
  → closeModal()
```

### Delete Consumption

```
User clicks [✕] on log row
  → confirm dialog
  → delete row from History_[user] tab
  → re-renderWheel()
  → re-renderConsumptionLog()
```

---

## 5. Google Sheets Integration

### Planning Tab
- Read: Today's meals (date = today, columns: Date, Midi, Soir)
- Filter: `row.Date === getTodayISO()`

### Profils Tab
- Read: Daily goal (kcal) per user
- Assumed columns: Name, DailyGoal_kcal (or similar)

### History_florian / History_naomi Tabs
- Read: Today's consumptions (date = today)
- Write: Append new consumption row (Date, Heure, Nom, Quantité, Unité, Kcal_total, Type)
- Delete: Remove row when user deletes from log
- Columns: Date, Heure (time), Nom, Quantité, Unité, Kcal_total, Type ("meal" or "snack")

---

## 6. Calorie Calculation

### Per Consumption

```
kcal_total = quantity × (kcal_per_100 ÷ 100)
```

Example:
- Maïs doux (kcal_per_100 = 102): 100g → 100 × (102 ÷ 100) = 102 kcal
- Surimi (kcal_per_100 = ?): 50g → 50 × (kcal_per_100 ÷ 100) = X kcal

### Wheel Calculation

```
consumed = SUM(todaysConsumptions.kcal_total)
goal = dailyGoal (from Profils)
percentage = (consumed ÷ goal) × 100
remaining = goal - consumed
```

---

## 7. Error Handling

- **Missing daily goal:** Show "⚠️ Daily goal not set in Profils"
- **No meals planned:** Display empty state "Aucun repas prévu"
- **Product not in inventory:** Show error in Consommer modal, prevent submission
- **Sheets API failure:** Show toast "Erreur de sauvegarde", keep log in-memory (localStorage fallback)
- **Delete fails:** Show toast, log entry remains until refresh

---

## 8. Testing

- Load page → wheel shows 0% (no consumptions)
- Click [Manger] on Midi → qty modal opens → enter 150 → wheel updates
- Click [Consommer] → product modal opens → select Maïs → enter 100 → wheel updates again
- Delete consumption → wheel recalculates
- Reload page → consumptions persist from History tab
- Switch user → shows that user's goal + history

---

## 9. Future Extensions (Out of Scope)

- Weekly/monthly stats (see Profils history feature)
- Meal templates ("quick add" common meals)
- Barcode scanner for inventory items
- Goal auto-adjustment based on activity
- Push notifications ("only 200 kcal left!")

---

**Status:** Ready for implementation plan.
