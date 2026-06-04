const GOOGLE_CLIENT_ID = "864467783347-povu10fv1f30km3sfp8u14ppregeduro.apps.googleusercontent.com";

// Persisted across tabs and browser restarts (localStorage, not sessionStorage).
const LS_TOKEN = "googleAccessToken";
const LS_ID = "googleIdToken";
const LS_EXP = "googleTokenExpiresAt";

let googleAccessToken = null;
let tokenClient = null;

// Silent-refresh coordination
let _refreshPromise = null;
let _refreshResolve = null;
let _consentTried = false;

// ---------------------------------------------------------------------------
// Token storage helpers
// ---------------------------------------------------------------------------

function _storeToken(response) {
  googleAccessToken = response.access_token;
  localStorage.setItem(LS_TOKEN, googleAccessToken);
  const ttlMs = (parseInt(response.expires_in, 10) || 3600) * 1000;
  localStorage.setItem(LS_EXP, String(Date.now() + ttlMs));
}

function _clearToken() {
  googleAccessToken = null;
  localStorage.removeItem(LS_TOKEN);
  localStorage.removeItem(LS_EXP);
}

function _tokenExpiresAt() {
  return parseInt(localStorage.getItem(LS_EXP), 10) || 0;
}

/**
 * @param {number} [marginMs=0] - treat token as expired this many ms early
 * @returns {boolean}
 */
function _tokenExpired(marginMs = 0) {
  if (!getAccessToken()) return true;
  const exp = _tokenExpiresAt();
  if (!exp) return false; // unknown expiry → rely on 401 handling
  return Date.now() >= exp - marginMs;
}

// ---------------------------------------------------------------------------
// OAuth token client + flows
// ---------------------------------------------------------------------------

function ensureTokenClient() {
  if (!tokenClient) {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      callback: handleTokenResponse,
    });
  }
  return tokenClient;
}

function handleCredentialResponse(response) {
  localStorage.setItem(LS_ID, response.credential);
  requestAccessToken();
}

/**
 * Interactive / initial access-token request. On success the page reloads to
 * load data for the freshly-connected account.
 */
function requestAccessToken() {
  ensureTokenClient().requestAccessToken({ prompt: "" });
}

/**
 * Resolve the in-flight silent refresh (if any) and clear its state.
 */
function _resolveRefresh(value) {
  const resolve = _refreshResolve;
  _refreshResolve = null;
  _refreshPromise = null;
  if (resolve) resolve(value);
}

/**
 * Silently obtain a fresh access token (no UI) if the Google session is alive.
 * De-duplicates concurrent calls. Resolves to the new token, or null on failure.
 * @returns {Promise<string|null>}
 */
function refreshAccessTokenSilent() {
  if (_refreshPromise) return _refreshPromise;
  if (typeof google === "undefined" || !google.accounts || !google.accounts.oauth2) {
    return Promise.resolve(null);
  }

  _refreshPromise = new Promise((resolve) => { _refreshResolve = resolve; });
  try {
    ensureTokenClient().requestAccessToken({ prompt: "" });
  } catch {
    _resolveRefresh(null);
  }
  // Safety net: if GIS never calls back, don't hang forever.
  setTimeout(() => { if (_refreshResolve) _resolveRefresh(null); }, 15000);
  return _refreshPromise;
}

function handleTokenResponse(response) {
  const silent = !!_refreshResolve;

  if (response && response.access_token) {
    _storeToken(response);
    _consentTried = false;
    if (silent) {
      _resolveRefresh(googleAccessToken);
      updateUI();
    } else {
      // Initial/interactive connect → reload to load the account's data.
      location.reload();
    }
    return;
  }

  // No token returned.
  if (silent) {
    _resolveRefresh(null);
  } else if (!_consentTried) {
    _consentTried = true;
    ensureTokenClient().requestAccessToken({ prompt: "consent" });
  } else {
    _consentTried = false;
    updateUI(); // give up → auth gate stays visible
  }
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------

function updateUI() {
  const loginDiv = document.getElementById("google-login-btn");
  const logoutBtn = document.getElementById("google-logout-btn");

  if (isAuthenticated()) {
    if (loginDiv) loginDiv.style.display = "none";
    if (logoutBtn) {
      logoutBtn.style.display = "inline-flex";
      logoutBtn.className = "";
      logoutBtn.title = "Se déconnecter";
      logoutBtn.innerHTML = "🚪 Déconnexion";
      logoutBtn.style.cssText =
        "display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:20px;" +
        "background:rgba(255,255,255,0.9);color:#c62828;border:1px solid #ef9a9a;" +
        "font-size:13px;font-weight:600;cursor:pointer;line-height:1;";
    }
  } else {
    if (loginDiv) loginDiv.style.display = "block";
    if (logoutBtn) logoutBtn.style.display = "none";
  }

  applyAuthGate();
}

/**
 * Hide all page content and show a "Connectez-vous" panel when not authenticated.
 * Runs on every page (google-auth.js is loaded everywhere).
 */
function applyAuthGate() {
  const authed = isAuthenticated();
  const main = document.querySelector("main");
  const nav = document.querySelector(".nav-bottom");
  let gate = document.getElementById("auth-gate");

  if (authed) {
    if (main) main.style.display = "";
    if (nav) nav.style.display = "";
    if (gate) gate.style.display = "none";
    return;
  }

  if (main) main.style.display = "none";
  if (nav) nav.style.display = "none";
  if (!gate) {
    gate = document.createElement("div");
    gate.id = "auth-gate";
    gate.style.cssText =
      "position:fixed;inset:0;z-index:500;display:flex;align-items:center;justify-content:center;" +
      "padding:24px;background:linear-gradient(160deg,#e8f5e9 0%,#f1f8f4 100%);";
    gate.innerHTML =
      '<div style="background:#fff;border-radius:18px;box-shadow:0 10px 40px rgba(0,0,0,0.12);' +
      'padding:36px 28px;max-width:360px;width:100%;text-align:center;">' +
      '<div style="font-size:3.4em;line-height:1;">🍽️</div>' +
      '<h1 style="margin:12px 0 4px;color:#2E7D32;font-size:1.6em;">MealFlow</h1>' +
      '<p style="color:#666;margin:0 0 24px;font-size:0.95em;">Connectez-vous pour accéder à vos repas, recettes et courses.</p>' +
      '<div id="auth-gate-btn-host" style="display:flex;justify-content:center;"></div>' +
      "</div>";
    document.body.appendChild(gate);
  }
  // Relocate the Google sign-in button into the gate card
  const host = document.getElementById("auth-gate-btn-host");
  const loginBtn = document.getElementById("google-login-btn");
  if (host && loginBtn && loginBtn.parentElement !== host) {
    loginBtn.style.display = "block";
    host.appendChild(loginBtn);
  }
  gate.style.display = "flex";
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

function initGoogleAuth() {
  if (typeof google === "undefined") {
    setTimeout(initGoogleAuth, 200);
    return;
  }

  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleCredentialResponse,
    auto_select: true,
  });

  const loginDiv = document.getElementById("google-login-btn");
  if (loginDiv && !localStorage.getItem(LS_TOKEN)) {
    google.accounts.id.renderButton(loginDiv, {
      theme: "outline",
      size: "large",
      text: "signin_with"
    });
  }

  restoreToken();
  updateUI();

  // Refresh on demand when the tab becomes visible again with a stale token.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && _tokenExpired(60 * 1000)) {
      refreshAccessTokenSilent();
    }
  });
}

function restoreToken() {
  const token = localStorage.getItem(LS_TOKEN);
  if (token) googleAccessToken = token;

  // Proactively renew if the token is missing/stale but a Google session exists.
  if (token && _tokenExpired(2 * 60 * 1000)) {
    refreshAccessTokenSilent();
  } else if (!token && localStorage.getItem(LS_ID)) {
    refreshAccessTokenSilent();
  }
}

function logoutGoogle() {
  _clearToken();
  localStorage.removeItem(LS_ID);

  if (typeof google !== "undefined") {
    google.accounts.id.disableAutoSelect();
  }

  updateUI();
  location.reload();
}

function getAccessToken() {
  return googleAccessToken || localStorage.getItem(LS_TOKEN);
}

/**
 * Async variant: returns a token guaranteed fresh, refreshing silently if the
 * current one is missing/expired. Resolves null if no token can be obtained.
 * @returns {Promise<string|null>}
 */
async function getValidAccessToken() {
  if (!_tokenExpired(60 * 1000)) return getAccessToken();
  const fresh = await refreshAccessTokenSilent();
  return fresh || getAccessToken() || null;
}

function isAuthenticated() {
  return !!getAccessToken();
}

/**
 * Decode the connected Google account's email from the stored ID token (JWT).
 * @returns {string|null} Lowercased email, or null if unavailable.
 */
function getConnectedEmail() {
  const idToken = localStorage.getItem(LS_ID);
  if (!idToken) return null;
  try {
    const payload = idToken.split(".")[1];
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return json.email ? json.email.toLowerCase() : null;
  } catch {
    return null;
  }
}

/**
 * Validate token by attempting a minimal API call
 * Returns {valid: boolean, reason: string}
 */
async function validateToken() {
  const token = getAccessToken();
  if (!token) {
    return { valid: false, reason: "No token found" };
  }

  try {
    const sheetId = typeof getSheetId === 'function' ? getSheetId() : "1Dg9d-XIHzPqQIi4wZ2bTbnmHUKkn_V-IRzMOtRzQjOI";
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Recettes!A1?key=${typeof getApiKey === 'function' ? getApiKey() : "AIzaSyDZxRe3JtjbbqN9orW0xFCosxO4_3o6h74"}`;

    const response = await fetch(url, {
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (response.status === 401) {
      return { valid: false, reason: "Token expired or invalid" };
    }
    if (!response.ok) {
      return { valid: false, reason: `API error: ${response.statusText}` };
    }

    return { valid: true, reason: "Token valid" };
  } catch (err) {
    console.warn("Token validation error:", err);
    return { valid: false, reason: err.message };
  }
}

/**
 * Called by sheets-api when an authenticated request can't be recovered.
 * The silent refresh has already failed by this point, so drop the dead token
 * and show the login gate instead of pretending to be connected.
 */
function handleAuthError(reason = "Session expired or invalid") {
  console.warn("Auth error:", reason);
  _clearToken();
  updateUI();
}

/**
 * Validate token on page load; try a silent refresh before giving up.
 */
async function initTokenValidation() {
  if (!isAuthenticated()) {
    return; // Not logged in yet, skip
  }

  const validation = await validateToken();
  if (validation.valid) return;

  console.warn("Token invalid:", validation.reason, "— attempting silent refresh");
  const fresh = await refreshAccessTokenSilent();
  if (fresh) {
    const revalidated = await validateToken();
    if (revalidated.valid) return;
  }

  // Could not recover → stop pretending connected, show login gate.
  _clearToken();
  updateUI();
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(initGoogleAuth, 100);
  // Validate token after a short delay to allow UI initialization
  setTimeout(initTokenValidation, 500);
});
