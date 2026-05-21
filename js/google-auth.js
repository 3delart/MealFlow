const GOOGLE_CLIENT_ID = "864467783347-povu10fv1f30km3sfp8u14ppregeduro.apps.googleusercontent.com";
let googleAuthToken = null;

function handleCredentialResponse(response) {
  console.log("Auth success");
  googleAuthToken = response.credential;
  localStorage.setItem("googleAuthToken", googleAuthToken);
  const btn = document.getElementById("google-logout-btn");
  if (btn) btn.style.display = "block";
  setTimeout(() => location.reload(), 500);
}

function initGoogleAuth() {
  if (typeof google === "undefined") {
    setTimeout(initGoogleAuth, 200);
    return;
  }

  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleCredentialResponse
  });

  const loginDiv = document.getElementById("google-login-btn");
  if (loginDiv && !localStorage.getItem("googleAuthToken")) {
    google.accounts.id.renderButton(loginDiv, { theme: "outline", size: "large" });
  }
}

function logoutGoogle() {
  googleAuthToken = null;
  localStorage.removeItem("googleAuthToken");
  location.reload();
}

function getAuthToken() {
  return googleAuthToken || localStorage.getItem("googleAuthToken");
}

function isAuthenticated() {
  return !!getAuthToken();
}

document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("googleAuthToken");
  if (token) {
    googleAuthToken = token;
    const btn = document.getElementById("google-logout-btn");
    if (btn) btn.style.display = "block";
    const div = document.getElementById("google-login-btn");
    if (div) div.style.display = "none";
  }
  setTimeout(initGoogleAuth, 100);
});
