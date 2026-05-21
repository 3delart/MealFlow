/**
 * User Context Module for MealFlow
 * Manages user toggle between Florian and Naomi
 * Persists user preference to localStorage
 */

const DEFAULT_USER = "florian";
const USERS = ["florian", "naomi"];
const STORAGE_KEY = "mealflow_user";

/**
 * Get current user from localStorage
 * Returns "florian" or "naomi", defaults to "florian" if not set
 * @returns {string} Current user ID
 */
function getCurrentUser() {
  const user = localStorage.getItem(STORAGE_KEY);
  if (user && USERS.includes(user)) {
    return user;
  }
  return DEFAULT_USER;
}

/**
 * Set current user and persist to localStorage
 * Validates that user is in USERS array
 * Dispatches custom "userChanged" event
 * @param {string} user - User ID to set (must be in USERS array)
 * @throws {Error} If user is not in USERS array
 */
function setCurrentUser(user) {
  if (!USERS.includes(user)) {
    throw new Error(`Invalid user: ${user}. Must be one of: ${USERS.join(", ")}`);
  }
  localStorage.setItem(STORAGE_KEY, user);

  // Dispatch custom event for other parts of the app to listen to
  const event = new CustomEvent("userChanged", {
    detail: { user: user }
  });
  document.dispatchEvent(event);
}

/**
 * Toggle between available users
 * If current user is florian, switches to naomi and vice versa
 */
function toggleUser() {
  const current = getCurrentUser();
  const next = current === "florian" ? "naomi" : "florian";
  setCurrentUser(next);
}

/**
 * Initialize user toggle button in header
 * Creates a button that allows switching between users
 * Listens to userChanged events and updates button text
 */
function initializeUserToggle() {
  const header = document.querySelector("header");
  if (!header) {
    console.warn("UserContext: <header> element not found");
    return;
  }

  // Create user toggle button
  const button = document.createElement("button");
  button.id = "user-toggle";
  button.className = "user-toggle";

  // Set initial button text
  const currentUser = getCurrentUser();
  const displayName = currentUser.charAt(0).toUpperCase() + currentUser.slice(1);
  button.textContent = `👤 ${displayName}`;

  // Add click handler to toggle user and reload page
  button.addEventListener("click", function() {
    toggleUser();
    // Reload page to apply user-specific styles and data
    location.reload();
  });

  // Append button to header
  header.appendChild(button);

  // Listen for userChanged events and update button text
  document.addEventListener("userChanged", function(event) {
    const user = event.detail.user;
    const displayName = user.charAt(0).toUpperCase() + user.slice(1);
    button.textContent = `👤 ${displayName}`;

    // Update page background color based on user
    if (user === "florian") {
      document.body.style.backgroundColor = "var(--color-florian)";
    } else if (user === "naomi") {
      document.body.style.backgroundColor = "var(--color-naomi)";
    }
  });
}

/**
 * Apply user-specific styling based on current user
 * Called on page load to set initial background color
 */
function applyUserStyling() {
  const user = getCurrentUser();
  if (user === "florian") {
    document.body.style.backgroundColor = "var(--color-florian)";
  } else if (user === "naomi") {
    document.body.style.backgroundColor = "var(--color-naomi)";
  }
}

// Export to window for use in other scripts
window.UserContext = {
  getCurrentUser,
  setCurrentUser,
  toggleUser,
  initializeUserToggle,
  applyUserStyling
};
