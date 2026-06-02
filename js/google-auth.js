const GOOGLE_CLIENT_ID = "864467783347-povu10fv1f30km3sfp8u14ppregeduro.apps.googleusercontent.com";
let googleAccessToken = null;
let tokenClient = null;

function handleCredentialResponse(response) {
  sessionStorage.setItem("googleIdToken", response.credential);

  requestAccessToken();
}

function requestAccessToken() {
  if (!tokenClient) {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      callback: handleTokenResponse,
    });
  }

  tokenClient.requestAccessToken({ prompt: "" });
}

function handleTokenResponse(response) {
  if (response.access_token) {
    googleAccessToken = response.access_token;
    sessionStorage.setItem("googleAccessToken", googleAccessToken);
    // Reload so the page loads data for the freshly-connected account
    location.reload();
  } else {
    tokenClient.requestAccessToken({ prompt: "consent" });
  }
}

function updateUI() {
  const loginDiv = document.getElementById("google-login-btn");
  const logoutBtn = document.getElementById("google-logout-btn");

  if (googleAccessToken || sessionStorage.getItem("googleAccessToken")) {
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

function initGoogleAuth() {
  if (typeof google === "undefined") {
    setTimeout(initGoogleAuth, 200);
    return;
  }

  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleCredentialResponse,
  });

  const loginDiv = document.getElementById("google-login-btn");
  if (loginDiv && !sessionStorage.getItem("googleAccessToken")) {
    google.accounts.id.renderButton(loginDiv, {
      theme: "outline",
      size: "large",
      text: "signin_with"
    });
  }

  restoreToken();
  updateUI();
}

function restoreToken() {
  const token = sessionStorage.getItem("googleAccessToken");
  if (token) {
    googleAccessToken = token;
  }
}

function logoutGoogle() {
  googleAccessToken = null;
  sessionStorage.removeItem("googleAccessToken");
  sessionStorage.removeItem("googleIdToken");

  if (typeof google !== "undefined") {
    google.accounts.id.disableAutoSelect();
  }

  updateUI();
  location.reload();
}

function getAccessToken() {
  return googleAccessToken || sessionStorage.getItem("googleAccessToken");
}

function isAuthenticated() {
  return !!getAccessToken();
}

/**
 * Decode the connected Google account's email from the stored ID token (JWT).
 * @returns {string|null} Lowercased email, or null if unavailable.
 */
function getConnectedEmail() {
  const idToken = sessionStorage.getItem("googleIdToken");
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
 * Show auth error modal and prompt logout/re-login
 */
function handleAuthError(reason = "Session expired or invalid") {
  showAuthErrorModal(reason);
}

/**
 * Display modal: "Session expired, please logout and re-login"
 */
function showAuthErrorModal(reason = "Session expired") {
  const existingModal = document.getElementById("auth-error-modal");
  if (existingModal) existingModal.remove();

  const modal = document.createElement("div");
  modal.id = "auth-error-modal";
  modal.style.cssText = `
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  `;

  const content = document.createElement("div");
  content.style.cssText = `
    background: white;
    border-radius: 12px;
    padding: 24px;
    max-width: 400px;
    text-align: center;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  `;

  content.innerHTML = `
    <h2 style="margin: 0 0 12px; color: #d32f2f; font-size: 18px;">Session Expired</h2>
    <p style="margin: 0 0 20px; color: #666; font-size: 14px;">${typeof Utils !== 'undefined' ? Utils.escapeHTML(reason) : reason}</p>
    <p style="margin: 0 0 20px; color: #999; font-size: 13px;">Please logout and re-login to continue.</p>
    <div style="display: flex; gap: 10px;">
      <button id="auth-logout-btn" style="flex: 1; padding: 10px; background: #d32f2f; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">Logout</button>
      <button id="auth-relogin-btn" style="flex: 1; padding: 10px; background: #1976d2; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">Re-login</button>
    </div>
  `;

  modal.appendChild(content);
  document.body.appendChild(modal);

  document.getElementById("auth-logout-btn").onclick = () => {
    modal.remove();
    logoutGoogle();
  };

  document.getElementById("auth-relogin-btn").onclick = () => {
    modal.remove();
    logoutGoogle();
  };
}

/**
 * Validate token on page load
 */
async function initTokenValidation() {
  if (!isAuthenticated()) {
    return; // Not logged in yet, skip
  }

  const validation = await validateToken();
  if (!validation.valid) {
    console.warn("Token invalid:", validation.reason);
    handleAuthError(validation.reason);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(initGoogleAuth, 100);
  // Validate token after a short delay to allow UI initialization
  setTimeout(initTokenValidation, 500);
});
