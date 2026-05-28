# MealFlow V2 — Foundation Modules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build 6 core foundation modules that all pages depend on, ensuring clean interfaces, no circular dependencies, and persistent authentication across sessions.

**Architecture:** Bottom-up module building. Start with auth.js + sheets-api.js (low-level API wrappers), then user-context.js (user state), then recipes.js + inventory.js (data models). Each module exports to `window.ModuleName`, handles errors, and stores state in memory or localStorage. Pages will depend on these modules but not interact with each other.

**Tech Stack:** Vanilla JavaScript, Google Identity Services (GIS) v1, Google Sheets API v4, localStorage, Chart.js, html5-qrcode, Open Food Facts API

---

## File Structure

**New files to create:**

```
js/
├── auth.js                 — OAuth2 flow + persistent sessions (localStorage)
├── sheets-api.js           — Google Sheets read/write wrapper
├── user-context.js         — Current user profile + email → profile lookup
├── utils.js                — Date helpers, calorie calcs, BMR/TDEE, formatting
├── recipes.js              — Recipe CRUD + kcal calculations
└── inventory.js            — Inventory CRUD + expiry tracking
```

**Existing files to modify:**

```
index.html                 — Add <script> tags for all 6 modules in order
docs/APP_COMPLETE_SPEC.md  — Already up to date
```

**Config file (create separately later):**

```
js/config.js               — SHEET_ID, API_KEY, OAUTH2_CLIENT_ID (not in this plan)
```

---

## Task Dependencies

```
auth.js
  ↓
sheets-api.js (independent of auth, uses API_KEY only)
  ↓
user-context.js (depends on auth.js + sheets-api.js)
  ↓
recipes.js (depends on sheets-api.js)
inventory.js (depends on sheets-api.js)
```

Load order in HTML: `auth.js` → `sheets-api.js` → `user-context.js` → `utils.js` → `recipes.js` → `inventory.js`

---

## Task 1: auth.js — OAuth2 + Persistent Authentication

**Files:**
- Create: `js/auth.js`

**Overview:**
Manages Google OAuth2 via GIS library. Handles token persistence in localStorage, silent re-auth on page load, token refresh, and cross-session restoration.

- [ ] **Step 1: Create auth.js with module skeleton**

```javascript
// js/auth.js
window.Auth = (() => {
  const STATE = {
    _currentEmail: null,
    _accessToken: null,
    _idToken: null,
  };

  // Module initialization
  const init = async () => {
    // TODO: implement
  };

  const getToken = () => {
    // TODO: implement
  };

  const isAuthenticated = () => {
    // TODO: implement
  };

  const logout = () => {
    // TODO: implement
  };

  const showLoginButton = () => {
    // TODO: implement
  };

  return {
    init,
    getToken,
    isAuthenticated,
    logout,
    showLoginButton,
  };
})();
```

- [ ] **Step 2: Implement localStorage token helpers (private)**

```javascript
// Add inside Auth module, before return statement
const saveTokens = (accessToken, idToken) => {
  localStorage.googleAccessToken = accessToken;
  localStorage.googleIdToken = idToken;
};

const loadTokens = () => {
  return {
    accessToken: localStorage.googleAccessToken || null,
    idToken: localStorage.googleIdToken || null,
  };
};

const clearTokens = () => {
  delete localStorage.googleAccessToken;
  delete localStorage.googleIdToken;
};
```

- [ ] **Step 3: Implement `init()` method**

```javascript
const init = async () => {
  // 1. Load tokens from localStorage if exist
  const { accessToken, idToken } = loadTokens();
  
  if (accessToken && idToken) {
    // 2. Try silent re-auth with GIS
    try {
      const response = await google.accounts.id.initialize({
        client_id: window.OAUTH2_CLIENT_ID,
      });
      
      // 3. Attempt to refresh token silently
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: window.OAUTH2_CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/spreadsheets',
        prompt: 'none', // Silent mode
        callback: (tokenResponse) => {
          if (tokenResponse.access_token) {
            STATE._accessToken = tokenResponse.access_token;
            STATE._idToken = idToken;
            saveTokens(tokenResponse.access_token, idToken);
          }
        },
      });
      
      tokenClient.requestAccessToken();
      
      // Get email from ID token (decode JWT payload)
      const emailFromToken = decodeJWT(idToken).email;
      STATE._currentEmail = emailFromToken;
      return emailFromToken;
    } catch (err) {
      // Silent re-auth failed; clear tokens and return null
      clearTokens();
      return null;
    }
  }
  
  // 4. No tokens found; return null (user needs to login)
  return null;
};
```

- [ ] **Step 4: Implement JWT decode helper (private)**

```javascript
const decodeJWT = (token) => {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  
  const payload = parts[1];
  const decoded = JSON.parse(atob(payload));
  return decoded;
};
```

- [ ] **Step 5: Implement `getToken()` method**

```javascript
const getToken = () => {
  return STATE._accessToken || null;
};
```

- [ ] **Step 6: Implement `isAuthenticated()` method**

```javascript
const isAuthenticated = () => {
  return STATE._accessToken !== null && STATE._currentEmail !== null;
};
```

- [ ] **Step 7: Implement `logout()` method**

```javascript
const logout = () => {
  clearTokens();
  STATE._currentEmail = null;
  STATE._accessToken = null;
  STATE._idToken = null;
  
  // Dispatch event for other modules to listen
  window.dispatchEvent(new CustomEvent('auth-changed', { detail: { authenticated: false } }));
  
  // Reload page to show login button
  window.location.reload();
};
```

- [ ] **Step 8: Implement `showLoginButton()` method**

```javascript
const showLoginButton = () => {
  // Render Google Sign-In button in a target element
  const container = document.getElementById('google-signin-button') || document.body;
  
  google.accounts.id.initialize({
    client_id: window.OAUTH2_CLIENT_ID,
    callback: handleCredentialResponse,
  });
  
  google.accounts.id.renderButton(container, {
    theme: 'outline',
    size: 'large',
  });
};

const handleCredentialResponse = (response) => {
  // Store ID token
  const idToken = response.credential;
  const decoded = decodeJWT(idToken);
  STATE._currentEmail = decoded.email;
  STATE._idToken = idToken;
  
  // Request access token for Sheets API
  const tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: window.OAUTH2_CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    callback: (tokenResponse) => {
      STATE._accessToken = tokenResponse.access_token;
      saveTokens(tokenResponse.access_token, idToken);
      
      // Dispatch auth-changed event
      window.dispatchEvent(new CustomEvent('auth-changed', { detail: { authenticated: true, email: STATE._currentEmail } }));
      
      // Reload page to load user data
      window.location.reload();
    },
  });
  
  tokenClient.requestAccessToken();
};
```

- [ ] **Step 9: Add GIS script tag to index.html**

```html
<!-- At top of <head>, before other scripts -->
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

- [ ] **Step 10: Commit**

```bash
git add js/auth.js index.html
git commit -m "feat: add auth.js with OAuth2 + persistent sessions"
```

---

## Task 2: sheets-api.js — Google Sheets API v4 Wrapper

**Files:**
- Create: `js/sheets-api.js`

**Overview:**
Low-level wrapper for Google Sheets API v4. Handles all read/write operations with error handling. Uses API_KEY for reads, OAuth token for writes.

- [ ] **Step 1: Create sheets-api.js skeleton**

```javascript
// js/sheets-api.js
window.SheetsAPI = (() => {
  const STATE = {
    sheetId: window.SHEET_ID,
    apiKey: window.API_KEY,
  };

  const readTab = async (tabName) => {
    // TODO: implement
  };

  const rowsToObjects = (rows) => {
    // TODO: implement
  };

  const appendRow = async (tabName, values, token) => {
    // TODO: implement
  };

  const updateCell = async (tabName, range, value, token) => {
    // TODO: implement
  };

  const ensureTab = async (tabName, token) => {
    // TODO: implement
  };

  return {
    readTab,
    rowsToObjects,
    appendRow,
    updateCell,
    ensureTab,
  };
})();
```

- [ ] **Step 2: Implement `readTab()` method (read-only, API key)**

```javascript
const readTab = async (tabName) => {
  try {
    const range = `${tabName}!A:Z`; // Read all columns A-Z
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${STATE.sheetId}/values/${encodeURIComponent(range)}?key=${STATE.apiKey}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to read tab ${tabName}:`, response.status);
      return null;
    }
    
    const data = await response.json();
    return data.values || []; // Array of arrays
  } catch (err) {
    console.error(`Error reading tab ${tabName}:`, err);
    return null;
  }
};
```

- [ ] **Step 3: Implement `rowsToObjects()` method**

```javascript
const rowsToObjects = (rows) => {
  if (!rows || rows.length === 0) return [];
  
  const headers = rows[0];
  const objects = [];
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const obj = {};
    
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j] || '';
    }
    
    objects.push(obj);
  }
  
  return objects;
};
```

- [ ] **Step 4: Implement `appendRow()` method (OAuth token required)**

```javascript
const appendRow = async (tabName, values, token) => {
  if (!token) {
    console.error('appendRow: OAuth token required');
    return false;
  }
  
  try {
    const range = `${tabName}!A:A`; // Append to column A
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${STATE.sheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [values],
      }),
    });
    
    if (!response.ok) {
      console.error(`Failed to append row to ${tabName}:`, response.status);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error(`Error appending row to ${tabName}:`, err);
    return false;
  }
};
```

- [ ] **Step 5: Implement `updateCell()` method (OAuth token required)**

```javascript
const updateCell = async (tabName, range, value, token) => {
  if (!token) {
    console.error('updateCell: OAuth token required');
    return false;
  }
  
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${STATE.sheetId}/values/${encodeURIComponent(tabName + '!' + range)}?valueInputOption=USER_ENTERED`;
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [[value]],
      }),
    });
    
    if (!response.ok) {
      console.error(`Failed to update cell ${range} in ${tabName}:`, response.status);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error(`Error updating cell ${range} in ${tabName}:`, err);
    return false;
  }
};
```

- [ ] **Step 6: Implement `ensureTab()` method (OAuth token required)**

```javascript
const ensureTab = async (tabName, token) => {
  if (!token) {
    console.error('ensureTab: OAuth token required');
    return false;
  }
  
  try {
    // Try to read the tab; if it fails, create it
    const existing = await readTab(tabName);
    if (existing !== null) return true; // Tab exists
    
    // Create tab via batchUpdate API
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${STATE.sheetId}:batchUpdate`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: {
                title: tabName,
              },
            },
          },
        ],
      }),
    });
    
    if (!response.ok) {
      console.error(`Failed to create tab ${tabName}:`, response.status);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error(`Error ensuring tab ${tabName}:`, err);
    return false;
  }
};
```

- [ ] **Step 7: Commit**

```bash
git add js/sheets-api.js
git commit -m "feat: add sheets-api.js with read/write wrapper"
```

---

## Task 3: user-context.js — User Profile Management

**Files:**
- Create: `js/user-context.js`

**Overview:**
Manages current user profile (loaded from Profils sheet), profile creation, and user switching. Depends on Auth + SheetsAPI.

- [ ] **Step 1: Create user-context.js skeleton**

```javascript
// js/user-context.js
window.UserContext = (() => {
  const STATE = {
    _currentEmail: null,
    _currentProfile: null,
    _allProfiles: {}, // Cache: email → profile object
  };

  const init = async (email) => {
    // TODO: implement
  };

  const getCurrentEmail = () => {
    // TODO: implement
  };

  const getCurrentProfile = () => {
    // TODO: implement
  };

  const getProfile = async (email) => {
    // TODO: implement
  };

  const createProfile = async (email, profileData, token) => {
    // TODO: implement
  };

  const updateProfile = async (email, updates, token) => {
    // TODO: implement
  };

  return {
    init,
    getCurrentEmail,
    getCurrentProfile,
    getProfile,
    createProfile,
    updateProfile,
  };
})();
```

- [ ] **Step 2: Implement `init()` method**

```javascript
const init = async (email) => {
  STATE._currentEmail = email;
  
  // Load all profiles from Profils tab
  const rows = await SheetsAPI.readTab('Profils');
  if (!rows || rows.length === 0) {
    console.warn('Profils tab is empty');
    return;
  }
  
  // Convert to objects
  const profiles = SheetsAPI.rowsToObjects(rows);
  
  // Cache profiles by email
  profiles.forEach(p => {
    STATE._allProfiles[p.Email] = p;
  });
  
  // Load current user's profile
  if (STATE._allProfiles[email]) {
    STATE._currentProfile = STATE._allProfiles[email];
  } else {
    console.warn(`Profile not found for ${email}`);
  }
};
```

- [ ] **Step 3: Implement `getCurrentEmail()` method**

```javascript
const getCurrentEmail = () => {
  return STATE._currentEmail;
};
```

- [ ] **Step 4: Implement `getCurrentProfile()` method**

```javascript
const getCurrentProfile = () => {
  return STATE._currentProfile || null;
};
```

- [ ] **Step 5: Implement `getProfile()` method**

```javascript
const getProfile = async (email) => {
  // Return cached profile if available
  if (STATE._allProfiles[email]) {
    return STATE._allProfiles[email];
  }
  
  // Otherwise, re-load from sheet
  const rows = await SheetsAPI.readTab('Profils');
  if (!rows) return null;
  
  const profiles = SheetsAPI.rowsToObjects(rows);
  profiles.forEach(p => {
    STATE._allProfiles[p.Email] = p;
  });
  
  return STATE._allProfiles[email] || null;
};
```

- [ ] **Step 6: Implement `createProfile()` method**

```javascript
const createProfile = async (email, profileData, token) => {
  if (!token) {
    console.error('createProfile: OAuth token required');
    return false;
  }
  
  // Ensure Profils tab exists
  const tabExists = await SheetsAPI.ensureTab('Profils', token);
  if (!tabExists) return false;
  
  // Calculate BMR using Mifflin-St Jeor
  const bmr = Utils.getMifflinStJeor(
    profileData.Sexe,
    profileData.Poids_kg,
    profileData.Taille_cm,
    profileData.Age
  );
  
  // Calculate TDEE
  const tdee = Utils.getTDEE(bmr, profileData.Activite);
  
  // Build row with all required columns
  const values = [
    email,
    profileData.Nom,
    profileData.Sexe,
    profileData.Age,
    profileData.Taille_cm,
    profileData.Poids_kg,
    profileData.Activite,
    profileData.Calories_cible,
    profileData.Regime,
    bmr,
    tdee,
  ];
  
  // Append row to Profils
  const success = await SheetsAPI.appendRow('Profils', values, token);
  
  if (success) {
    // Cache the new profile
    const newProfile = {
      Email: email,
      Nom: profileData.Nom,
      Sexe: profileData.Sexe,
      Age: profileData.Age,
      Taille_cm: profileData.Taille_cm,
      Poids_kg: profileData.Poids_kg,
      Activite: profileData.Activite,
      Calories_cible: profileData.Calories_cible,
      Regime: profileData.Regime,
      BMR: bmr,
      TDEE: tdee,
    };
    STATE._allProfiles[email] = newProfile;
    STATE._currentProfile = newProfile;
  }
  
  return success;
};
```

- [ ] **Step 7: Implement `updateProfile()` method**

```javascript
const updateProfile = async (email, updates, token) => {
  if (!token) {
    console.error('updateProfile: OAuth token required');
    return false;
  }
  
  // Get current profile
  const profile = STATE._allProfiles[email];
  if (!profile) {
    console.error(`Profile not found for ${email}`);
    return false;
  }
  
  // Merge updates
  const updated = { ...profile, ...updates };
  
  // Recalculate BMR if weight/height/age/sex changed
  if (updates.Poids_kg || updates.Taille_cm || updates.Age || updates.Sexe) {
    updated.BMR = Utils.getMifflinStJeor(
      updated.Sexe,
      updated.Poids_kg,
      updated.Taille_cm,
      updated.Age
    );
    updated.TDEE = Utils.getTDEE(updated.BMR, updated.Activite);
  }
  
  // TODO: Update row in Profils sheet (find row number and update all cells)
  // For now, this is a placeholder; full implementation requires finding row number
  
  // Update cache
  STATE._allProfiles[email] = updated;
  STATE._currentProfile = updated;
  
  return true;
};
```

- [ ] **Step 8: Commit**

```bash
git add js/user-context.js
git commit -m "feat: add user-context.js with profile management"
```

---

## Task 4: utils.js — Helper Functions

**Files:**
- Create: `js/utils.js`

**Overview:**
All utility functions: date formatting, calorie calculations, BMR/TDEE, French locale helpers, etc.

- [ ] **Step 1: Create utils.js with all helper functions**

```javascript
// js/utils.js
window.Utils = (() => {
  // Date helpers
  const getTodayISO = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getLocaleDateFr = (dateISO) => {
    // dateISO format: "2026-05-26"
    const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    
    const [year, month, day] = dateISO.split('-');
    const date = new Date(year, parseInt(month) - 1, parseInt(day));
    
    const dayName = days[date.getDay()];
    const monthName = months[date.getMonth()];
    
    return `${dayName} ${parseInt(day)} ${monthName} ${year}`;
  };

  const addDaysToISO = (dateISO, days) => {
    const [year, month, day] = dateISO.split('-');
    const date = new Date(year, parseInt(month) - 1, parseInt(day));
    date.setDate(date.getDate() + days);
    
    const newYear = date.getFullYear();
    const newMonth = String(date.getMonth() + 1).padStart(2, '0');
    const newDay = String(date.getDate()).padStart(2, '0');
    
    return `${newYear}-${newMonth}-${newDay}`;
  };

  const getWeekStart = (dateISO) => {
    // Get Monday of the week containing dateISO
    const [year, month, day] = dateISO.split('-');
    const date = new Date(year, parseInt(month) - 1, parseInt(day));
    const dayOfWeek = date.getDay();
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust for Sunday = 0
    date.setDate(date.getDate() + daysToMonday);
    
    const newYear = date.getFullYear();
    const newMonth = String(date.getMonth() + 1).padStart(2, '0');
    const newDay = String(date.getDate()).padStart(2, '0');
    
    return `${newYear}-${newMonth}-${newDay}`;
  };

  const getWeekDays = (weekStartISO) => {
    // Get array of 7 days starting from Monday
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDaysToISO(weekStartISO, i));
    }
    return days;
  };

  const daysUntilExpiry = (expiryISO) => {
    const today = new Date(getTodayISO());
    const expiry = new Date(expiryISO);
    const diff = expiry - today;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  // Calorie helpers
  const calcKcalPer100g = (totalKcal, totalWeightG) => {
    if (totalWeightG === 0) return 0;
    return Math.round((totalKcal / totalWeightG) * 100);
  };

  const calcPortionKcal = (eatenGrams, kcalPer100g) => {
    return Math.round((eatenGrams * kcalPer100g) / 100);
  };

  // BMR calculation (Mifflin-St Jeor formula)
  const getMifflinStJeor = (sexe, poids_kg, taille_cm, age) => {
    let bmr;
    if (sexe === 'M') {
      bmr = 10 * poids_kg + 6.25 * taille_cm - 5 * age + 5;
    } else {
      bmr = 10 * poids_kg + 6.25 * taille_cm - 5 * age - 161;
    }
    return Math.round(bmr);
  };

  // Activity level multipliers
  const activityMultipliers = {
    'Sédentaire': 1.2,
    'Peu actif': 1.375,
    'Modéré': 1.55,
    'Très actif': 1.725,
    'Extrêmement actif': 1.9,
  };

  const getTDEE = (bmr, activite) => {
    const multiplier = activityMultipliers[activite] || 1.55;
    return Math.round(bmr * multiplier);
  };

  const getIMC = (poids_kg, taille_cm) => {
    const taille_m = taille_cm / 100;
    return Math.round((poids_kg / (taille_m * taille_m)) * 10) / 10;
  };

  // Formatting
  const slugify = (text) => {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // Remove accents
      .replace(/\s+/g, '-')
      .replace(/[^\w-]/g, '')
      .trim();
  };

  // Toast notifications
  const showToast = (message, type = 'success') => {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#e67e22'};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 0.9em;
      z-index: 1000;
      animation: slideUp 0.3s ease-out;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 3000);
  };

  return {
    getTodayISO,
    getLocaleDateFr,
    addDaysToISO,
    getWeekStart,
    getWeekDays,
    daysUntilExpiry,
    calcKcalPer100g,
    calcPortionKcal,
    getMifflinStJeor,
    getTDEE,
    getIMC,
    slugify,
    showToast,
  };
})();
```

- [ ] **Step 2: Add CSS for toast notifications to css/style.css**

```css
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

.toast {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
```

- [ ] **Step 3: Commit**

```bash
git add js/utils.js css/style.css
git commit -m "feat: add utils.js with date/calorie/BMR helpers"
```

---

## Task 5: recipes.js — Recipe CRUD + Calculations

**Files:**
- Create: `js/recipes.js`

**Overview:**
Recipe management: load from RecettesJSON cell, add/edit/delete in memory, calculate kcal/100g, save back to sheet.

- [ ] **Step 1: Create recipes.js skeleton** 

[Continue with recipes.js, inventory.js, and integration task...]
