const GOOGLE_CLIENT_ID = "864467783347-povu10fv1f30km3sfp8u14ppregeduro.apps.googleusercontent.com";
let googleAccessToken = null;
let tokenClient = null;

function handleCredentialResponse(response) {
  console.log("Sign-In success");
  localStorage.setItem("googleIdToken", response.credential);

  requestAccessToken();
}

function requestAccessToken() {
  if (!tokenClient) {
    console.log("Initializing token client...");
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
    localStorage.setItem("googleAccessToken", googleAccessToken);
    console.log("Access token obtained");

    updateUI();
  } else {
    console.log("No access token, prompting user...");
    tokenClient.requestAccessToken({ prompt: "consent" });
  }
}

function updateUI() {
  const loginDiv = document.getElementById("google-login-btn");
  const logoutBtn = document.getElementById("google-logout-btn");

  if (googleAccessToken || localStorage.getItem("googleAccessToken")) {
    if (loginDiv) loginDiv.style.display = "none";
    if (logoutBtn) logoutBtn.style.display = "block";
  } else {
    if (loginDiv) loginDiv.style.display = "block";
    if (logoutBtn) logoutBtn.style.display = "none";
  }
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
  if (loginDiv && !localStorage.getItem("googleAccessToken")) {
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
  const token = localStorage.getItem("googleAccessToken");
  if (token) {
    googleAccessToken = token;
    console.log("Access token restored");
  }
}

function logoutGoogle() {
  googleAccessToken = null;
  localStorage.removeItem("googleAccessToken");
  localStorage.removeItem("googleIdToken");

  if (typeof google !== "undefined") {
    google.accounts.id.disableAutoSelect();
  }

  updateUI();
  location.reload();
}

function getAccessToken() {
  return googleAccessToken || localStorage.getItem("googleAccessToken");
}

function isAuthenticated() {
  return !!getAccessToken();
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(initGoogleAuth, 100);
});
