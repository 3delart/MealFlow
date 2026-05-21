/**
 * Google OAuth2 Authentication for MealFlow
 */

const GOOGLE_CLIENT_ID = "864467783347-povu10fv1f30km3sfp8u14ppregeduro.apps.googleusercontent.com";
let googleAuthToken = null;

/**
 * Handle Google Sign-In response
 */
function handleCredentialResponse(response) {
  console.log("Google Sign-In successful");
  googleAuthToken = response.credential;
  localStorage.setItem("googleAuthToken", googleAuthToken);

  const loginBtn = document.getElementById("google-login-btn");
  const logoutBtn = document.getElementById("google-logout-btn");
  if (loginBtn) loginBtn.style.display = "none";
  if (logoutBtn) logoutBtn.style.display = "block";
}

/**
 * Initialize Google Sign-In
 */
function initGoogleAuth() {
  if (typeof google === "undefined" || !google.accounts) {
    console.log("Google API not loaded, retrying...");
    setTimeout(initGoogleAuth, 200);
    return;
  }

  console.log("Initializing Google Sign-In");

  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleCredentialResponse
  });

  const loginBtn = document.getElementById("google-login-btn");
  if (loginBtn && !googleAuthToken && localStorage.getItem("googleAuthToken") === null) {
    google.accounts.id.renderButton(loginBtn, { theme: "outline", size: "large" });
    console.log("Rendered Google Sign-In button");
  }
}

/**
 * Logout
 */
function logoutGoogle() {
  googleAuthToken = null;
  localStorage.removeItem("googleAuthToken");

  const loginBtn = document.getElementById("google-login-btn");
  const logoutBtn = document.getElementById("google-logout-btn");
  if (loginBtn) loginBtn.style.display = "block";
  if (logoutBtn) logoutBtn.style.display = "none";

  console.log("Logged out");
}

/**
 * Get auth token
 */
function getAuthToken() {
  return googleAuthToken || localStorage.getItem("googleAuthToken");
}

/**
 * Check if authenticated
 */
function isAuthenticated() {
  return !!getAuthToken();
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("googleAuthToken");
  if (token) {
    googleAuthToken = token;
    const loginBtn = document.getElementById("google-login-btn");
    const logoutBtn = document.getElementById("google-logout-btn");
    if (loginBtn) loginBtn.style.display = "none";
    if (logoutBtn) logoutBtn.style.display = "block";
  }

  setTimeout(initGoogleAuth, 100);
});
