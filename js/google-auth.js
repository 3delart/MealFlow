/**
 * Google OAuth2 Authentication for MealFlow
 * Handles login and token management for Sheets API write access
 */

const GOOGLE_CLIENT_ID = "864467783347-povu10fv1f30km3sfp8u14ppregeduro.apps.googleusercontent.com";
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

let googleAuthToken = null;

/**
 * Initialize Google Sign-In
 */
function initGoogleAuth() {
  if (typeof google === "undefined") {
    console.error("Google API library not loaded");
    return;
  }

  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleCredentialResponse
  });
}

/**
 * Handle OAuth response callback
 */
function handleCredentialResponse(response) {
  console.log("Google Auth response received");

  if (response.credential) {
    // JWT token from Google Sign-In
    googleAuthToken = response.credential;
    localStorage.setItem("googleAuthToken", googleAuthToken);
    console.log("Auth token saved");

    // Update UI
    document.getElementById("google-login-btn")?.style.display = "none";
    document.getElementById("google-logout-btn")?.style.display = "block";

    // Trigger page reload to show authenticated state
    window.location.reload();
  }
}

/**
 * Start OAuth2 flow for Sheets write access
 */
function startOAuth2Flow() {
  if (typeof google === "undefined") {
    console.error("Google API library not loaded");
    return;
  }

  const client = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: SCOPES.join(" "),
    callback: (response) => {
      if (response.access_token) {
        googleAuthToken = response.access_token;
        localStorage.setItem("googleAccessToken", googleAuthToken);
        console.log("OAuth2 access token obtained");

        // Update UI
        document.getElementById("google-login-btn")?.style.display = "none";
        document.getElementById("google-logout-btn")?.style.display = "block";

        window.location.reload();
      }
    }
  });

  client.requestAccessToken({ prompt: "" });
}

/**
 * Logout from Google
 */
function logoutGoogle() {
  googleAuthToken = null;
  localStorage.removeItem("googleAuthToken");
  localStorage.removeItem("googleAccessToken");

  if (typeof google !== "undefined") {
    google.accounts.id.disableAutoSelect();
  }

  document.getElementById("google-login-btn")?.style.display = "block";
  document.getElementById("google-logout-btn")?.style.display = "none";

  console.log("Logged out from Google");
  window.location.reload();
}

/**
 * Get stored auth token
 */
function getAuthToken() {
  return googleAuthToken || localStorage.getItem("googleAccessToken") || localStorage.getItem("googleAuthToken");
}

/**
 * Check if user is authenticated
 */
function isAuthenticated() {
  return !!getAuthToken();
}

// Restore token on page load
function restoreAuthToken() {
  const token = localStorage.getItem("googleAccessToken") || localStorage.getItem("googleAuthToken");
  if (token) {
    googleAuthToken = token;
    console.log("Auth token restored from localStorage");
  }
}

// Run on load
document.addEventListener("DOMContentLoaded", () => {
  restoreAuthToken();
  initGoogleAuth();
});
