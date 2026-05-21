# MealFlow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task with fresh subagent per task and two-stage review.

**Goal:** Build a multi-page web app (HTML/CSS/JS) for meal planning, inventory, shopping list, and nutrition tracking with real-time synchronization between two users via Google Sheets.

**Architecture:** Static frontend (GitHub Pages) + Google Sheets as backend. Each page fetches/writes data via Sheets API v4. Shared modules for API integration, user context, and utilities. Per-page modules for specific features. TDD for business logic (BMR/TDEE calcs), manual testing for UI/UX.

**Tech Stack:** Vanilla HTML/CSS/JavaScript, Google Sheets API v4, localStorage for user context + offline cache, GitHub Pages hosting.

---

## File Structure

```
MealFlow/
├── index.html                          # Landing page / Bonjour (progress + objectives)
├── planning.html                       # Weekly meal grid (5 meals × 7 days)
├── courses.html                        # Shopping list (existing + Sheets sync)
├── inventory.html                      # Home inventory tracking
├── profils.html                        # User profiles + BMR/TDEE calculations
├── recette.html                        # Daily recipe viewer (existing + Sheets link)
├── stats.html                          # Historical graphs (calories + weight)
├── css/
│   ├── style.css                       # Shared styles (grid, colors, responsive)
│   ├── planning.css                    # Planning page specific
│   ├── inventory.css                   # Inventory page specific
│   └── profils.css                     # Profils page specific
├── js/
│   ├── sheets-api.js                   # Google Sheets API wrapper (read/write)
│   ├── utils.js                        # Shared utilities (date, calc, DOM helpers)
│   ├── user-context.js                 # User toggle (Florian/Naomi) + localStorage
│   ├── planning.js                     # Planning page logic
│   ├── courses.js                      # Courses page logic (adapt existing)
│   ├── inventory.js                    # Inventory page logic
│   ├── profils.js                      # Profils page logic + BMR/TDEE calcs
│   ├── recette.js                      # Recette page logic (adapt existing)
│   └── accueil.js                      # Hub page navigation
├── tests/
│   ├── profils.test.js                 # BMR/TDEE calculation tests
│   ├── utils.test.js                   # Shared utility tests
│   └── sheets-api.test.js              # Sheets API wrapper tests (mocked)
├── docs/
│   ├── SHEETS_SETUP.md                 # Google Sheets creation + API key setup
│   └── superpowers/
│       ├── specs/
│       │   └── 2026-05-21-mealflow-design.md
│       └── plans/
│           └── 2026-05-21-mealflow-implementation.md
└── README.md
```

---

## Tasks

### Task 1: Initialize Project Structure & Google Sheets Setup

**Status:** PENDING

**Files:**
- Create: `README.md` (project overview)
- Create: `docs/SHEETS_SETUP.md` (step-by-step Google Sheets + API key setup)
- Create: `.gitignore` (ignore secrets)
- Create: `package.json` (for future Node tooling)

**Description:** Set up project README, documentation for Sheets setup, .gitignore, and package.json with test runner.

**Expected Output:**
- README.md with project overview and structure
- docs/SHEETS_SETUP.md with step-by-step instructions
- .gitignore with secrets, OS, IDE patterns
- package.json with jest test runner configured
- All committed with commit message "docs: initialize project structure and setup guide"

---

### Task 2: Google Sheets API Wrapper

**Status:** PENDING

**Files:**
- Create: `js/sheets-api.js` (API read/write with error handling)
- Create: `tests/sheets-api.test.js` (mocked API tests)

**Description:** Build Google Sheets API wrapper module that reads sheet tabs and converts rows to objects. Include error handling. Write unit tests.

**Requirements:**
- `readSheetTab(tabName)` async function fetches data from Sheets API v4
- `rowsToObjects(rows)` converts array of rows to array of objects (headers = keys)
- Error handling and logging
- Tests cover: normal data, empty data, missing cells
- Exported to `window.SheetsAPI`

**Expected Output:**
- js/sheets-api.js with read functionality
- tests/sheets-api.test.js with passing tests
- All committed with "feat: add Google Sheets API wrapper with read + error handling"

---

### Task 3: User Context & Navigation

**Status:** PENDING

**Files:**
- Create: `js/user-context.js` (toggle Florian/Naomi + localStorage)
- Create: `css/style.css` (shared styles: header, toggle, colors)

**Description:** Build user context module that persists user choice (Florian/Naomi) to localStorage and broadcasts changes. Create shared CSS design system.

**Requirements:**
- `getCurrentUser()` returns "florian" or "naomi" from localStorage
- `setCurrentUser(user)` persists to localStorage
- `toggleUser()` switches between users
- `initializeUserToggle()` injects toggle button into `<header>`
- Shared CSS with color palette, header, button, form styles
- Responsive (480px+)

**Expected Output:**
- js/user-context.js with user context module
- css/style.css with complete shared design system
- All committed with "feat: add user context toggle and shared styles"

---

### Task 4: Landing Page (index.html)

**Status:** PENDING

**Files:**
- Create: `index.html` (hub with progress circle + today's objectives)
- Create: `css/accueil.css` (hub-specific styles)
- Create: `js/accueil.js` (hub logic: fetch profils, display progress, objectives)

**Description:** Build landing page (Bonjour) with daily progress circle, today's objectives, and navigation menu at bottom.

**Requirements:**
- Header with "MealFlow" title, date (e.g., "Jeudi 22 mai"), user toggle
- Welcome section: "Bonjour [User]" + date
- Progress circle showing % calories consumed today (0-100%)
- "Today's objectives" card showing:
  - Current user's calorie goal + consumed
  - Meals planned for today (from Planning tab)
  - % progress for each meal type
- Search box (functional: search meals/recipes)
- Bottom navigation bar (5 tabs: Accueil, Planning, Courses, Inventaire, Profils)
- Loads data from Profils + Planning tabs
- Update when user switches or date changes

**Expected Output:**
- index.html with progress circle + objectives layout
- css/accueil.css with circle, progress, responsive styles
- js/accueil.js with data loading and progress calculation
- All committed with "feat: add landing page with daily progress and objectives"

---

### Task 5: Utils Module

**Status:** PENDING

**Files:**
- Create: `js/utils.js` (date helpers, calc helpers, DOM helpers)
- Create: `tests/utils.test.js` (unit tests: 15+ test cases)

**Description:** Build shared utilities module with date parsing, BMR/TDEE calculations, and DOM helpers. Write comprehensive unit tests.

**Requirements:**

**Date utilities:**
- `getTodayISO()` — current date in YYYY-MM-DD
- `getDateISO(daysOffset)` — future/past date in YYYY-MM-DD
- `getDayName(isoString)` — "Lun", "Mar", etc.
- `formatDate(isoString)` — "Lun 18 mai"
- `daysUntilExpiration(expirationISO)` — days remaining
- `isExpired(isoString)`, `isExpiringS(isoString)` — checks for < 3 days

**Calculations:**
- `calculateBMR(weightKg, heightCm, ageYears, sex)` — Mifflin-St Jeor formula
- `calculateTDEE(bmr, activity)` — multiply by activity coefficient
- `calculateObjectiveCalories(tdee, objectif)` — apply deficit/surplus

**DOM:**
- `createElement(tag, attrs, content)` — create element with attributes
- `clearElement(el)` — remove all children

**Tests:** 15+ test cases covering all functions, edge cases

**Expected Output:**
- js/utils.js with all utilities
- tests/utils.test.js with 15+ passing tests
- All committed with "feat: add utils module with date, BMR/TDEE, and DOM helpers"

---

### Task 6: Profils Page & Calculations

**Status:** PENDING

**Files:**
- Create: `profils.html` (two user profile cards + edit modals)
- Create: `css/profils.css` (profile card styles)
- Create: `js/profils.js` (load profiles, calculate BMR/TDEE, render cards)

**Description:** Build Profils page that displays both users' profile data with calculated BMR/TDEE and visual cards.

**Requirements:**
- Load "Profils" tab from Sheets
- Calculate BMR using Mifflin-St Jeor formula
- Calculate TDEE = BMR × activity coefficient
- Calculate objective calories = TDEE ± adjustment
- Render two profile cards (Florian + Naomi) with:
  - Name, measurements, IMC, age, sex
  - BMR, TDEE, objective calories
  - Preferences (activity, cuisine level, max prep time)
  - Restrictions (allergies, aversions)
- Edit buttons (functionality in later task)
- Gracefully handle missing Sheets data

**Expected Output:**
- profils.html with profile card layout
- css/profils.css with card, stat, modal styles
- js/profils.js with profile loading and calculations
- All committed with "feat: add profils page with BMR/TDEE calculations"

---

### Task 7: Planning Page (Weekly Grid) — Read-Only

**Status:** PENDING

**Files:**
- Create: `planning.html` (5 meals × 7 days grid)
- Create: `css/planning.css` (grid styles)
- Create: `js/planning.js` (render grid, load data, week navigation)

**Description:** Build Planning page with weekly meal grid (5 meal types × 7 days) in read-only mode with auto-generation note.

**Requirements:**
- Load "Planning" tab from Sheets
- Render 5 rows (meal types: Petit-déj, Collation matin, Déjeuner, Collation après-midi, Diner)
- Render 7 columns (days of week with dates: "Lun 18 mai", etc.)
- Color-code cells by user (Florian = pink, Naomi = purple, both = green, empty = gray)
- Show meal names in cells (e.g., "Poid-déj granola", "Wrap poulet")
- Week navigation (prev/next week buttons)
- Display week label at top
- Show "Génération auto lundi" note
- Show current week by default
- Gracefully handle missing data

**Expected Output:**
- planning.html with grid layout
- css/planning.css with table, cell, responsive styles
- js/planning.js with grid rendering and week logic
- All committed with "feat: add planning page with weekly grid (read-only)"

---

### Task 8: Stats Page (Calories & Weight History)

**Status:** PENDING

**Files:**
- Create: `stats.html` (graphs for calories + weight history)
- Create: `css/stats.css` (graph styles)
- Create: `js/stats.js` (load historical data, render charts)

**Description:** Build Stats page with historical graphs showing calories consumed and weight over time.

**Requirements:**
- Header with "Historique" title, user toggle
- Two graphs side-by-side (mobile: stacked):
  1. **Calories graph**: Line chart of daily calories consumed (last 30 days)
  2. **Weight graph**: Line chart of weight history (last 30 days)
- Load data from localStorage (or future Sheets historical tab)
- X-axis: dates, Y-axis: values (kcal or kg)
- Color-code lines by user (Florian = pink, Naomi = purple)
- Show current trend (↑ or ↓)
- Export button (future: download CSV)
- Responsive charts
- Bottom navigation bar (same 5 tabs as accueil)

**Expected Output:**
- stats.html with graph layout
- css/stats.css with graph/responsive styles
- js/stats.js with data loading and chart rendering (Chart.js library)
- All committed with "feat: add stats page with historical graphs"

---

## Execution Notes

**Order:** Tasks 1-7 execute in sequence. Each task is independent enough that subagent review cycles can proceed without blocking.

**Commits:** One commit per task (as specified in each task's Expected Output).

**Testing:** Unit tests in Task 5 (utils.test.js) run with `npm test`. Manual browser testing for HTML pages.

**Subagent guidance:**
- Task 1-4, 7: Mostly HTML/CSS/JS, straightforward (use cheaper model)
- Task 5: Calculations + unit tests, clear spec (use cheaper model)
- Task 6: Integration (load Sheets + calculate + render), more judgment (use standard model)

---

## Summary

**Tasks 1-7 complete:** Basic app structure, API integration, shared utilities, landing page, profiles with calculations, read-only meal planning.

**Remaining tasks (not in this plan):** Inventory, Courses sync, edit modals, offline cache, mobile testing, deployment.

**Total estimated effort:** 8-10 hours for experienced developer with TDD.
