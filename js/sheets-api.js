/**
 * Google Sheets API v4 Wrapper
 * Provides functions to read data from Google Sheets and convert to usable formats
 */

// Configuration constants
// User must replace these with their actual values from Google Cloud Console
const SHEET_ID_DEFAULT = "1Dg9d-XIHzPqQIi4wZ2bTbnmHUKkn_V-IRzMOtRzQjOI";
const SHEET_API_KEY_DEFAULT = "AIzaSyDZxRe3JtjbbqN9orW0xFCosxO4_3o6h74";

/**
 * Get Sheet ID from localStorage or fallback to default
 */
function getSheetId() {
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem("SHEETS_ID");
    if (stored && stored !== "YOUR_SHEET_ID_HERE") {
      return stored;
    }
  }
  return SHEET_ID_DEFAULT;
}

/**
 * Get API Key from localStorage or fallback to default
 */
function getApiKey() {
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem("SHEETS_API_KEY");
    if (stored && stored !== "YOUR_API_KEY_HERE") {
      return stored;
    }
  }
  return SHEET_API_KEY_DEFAULT;
}

/**
 * Reads data from a Google Sheet tab
 * @param {string} tabName - The name of the sheet tab to read from
 * @returns {Promise<Array<Array>>} Array of rows, where each row is an array of cell values
 * @throws {Error} If the API request fails
 */
async function readSheetTab(tabName, range = null) {
  try {
    const sheetId = getSheetId();
    const apiKey = getApiKey();

    // Construct the API URL for the specified tab (with optional range to include empty columns)
    const rangeSpec = range ? `${tabName}!${range}` : tabName;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${rangeSpec}?key=${apiKey}`;

    // Fetch the data from Google Sheets API
    const response = await fetch(url);

    // Check if the request was successful
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}: ${response.statusText}`);
    }

    // Parse the JSON response
    const data = await response.json();

    // Return the values (rows) or empty array if no data exists
    return data.values || [];
  } catch (error) {
    // Log the error for debugging
    console.error(`Error reading sheet tab "${tabName}":`, error);
    // Re-throw the error so the caller can handle it
    throw error;
  }
}

/**
 * Converts an array of rows to an array of objects using the first row as headers
 * @param {Array<Array>} rows - Array of rows where first row contains header names
 * @returns {Array<Object>} Array of objects with headers as keys
 */
function rowsToObjects(rows) {
  // Handle empty input
  if (!rows || rows.length === 0) {
    return [];
  }

  // Extract headers from the first row
  const headers = rows[0];

  // If there's only a header row and no data rows, return empty array
  if (rows.length === 1) {
    return [];
  }

  // Convert each data row (starting from index 1) to an object
  return rows.slice(1).map(row => {
    const obj = {};

    // Iterate through each header
    headers.forEach((header, index) => {
      // Get the value at this index or use empty string if cell is missing
      obj[header] = row[index] !== undefined ? row[index] : "";
    });

    return obj;
  });
}

/**
 * Append row to Google Sheet tab with OAuth2 token
 * @param {string} tabName - The sheet tab name
 * @param {Array} row - Row data to append
 * @param {string} accessToken - OAuth2 access token
 * @returns {Promise<Object>} API response
 */
async function appendRowWithToken(tabName, row, accessToken) {
  if (!accessToken) {
    throw new Error("No access token provided. User must be authenticated.");
  }

  const sheetId = getSheetId();
  const values = [row];

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${tabName}:append?valueInputOption=USER_ENTERED`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ values })
    });

    if (!response.ok) {
      if (response.status === 401 && typeof handleAuthError === 'function') {
        handleAuthError("Token expired - please re-login");
        return {};
      }
      const error = await response.json();
      console.error(`Sheets API error: ${error.error.message}`);
      throw new Error(`Failed to append row: ${error.error.message}`);
    }

    const result = await response.json();
    console.log(`Row appended to ${tabName}:`, result);
    return result;
  } catch (error) {
    console.error(`Error appending row to ${tabName}:`, error);
    throw error;
  }
}

/**
 * Append a consumption record to the History sheet
 * @param {string} historyTab - The history sheet tab name (e.g., "History_florian" or "History_naomi")
 * @param {string} date - The date of consumption
 * @param {string} productName - Name of the product consumed
 * @param {number} quantity - Quantity consumed
 * @param {string} unit - Unit of measurement (e.g., "g", "ml", "piece")
 * @param {number} caloriesPer100g - Calories per 100g/ml of the product
 * @param {number} totalCalories - Total calories for this consumption
 * @param {string} type - Type of consumption ("meal" or "grignottage")
 * @param {string} accessToken - OAuth2 access token
 * @returns {Promise<Object>} API response from appendRowWithToken
 */
async function appendConsumptionRecord(historyTab, date, productName, quantity, unit, caloriesPer100g, totalCalories, type, accessToken) {
  const rowData = [date, productName, quantity, unit, caloriesPer100g, totalCalories, type];
  return appendRowWithToken(historyTab, rowData, accessToken);
}

/**
 * Writes data to a Google Sheet tab
 * @param {string} tabName - The sheet tab name
 * @param {Array<Array>} rows - Array of rows to write
 * @throws {Error} If write fails or no token available
 */
function writeSheetTab(tabName, rows) {
  console.warn("Use appendRowWithToken() with OAuth2 access token instead");
  throw new Error("writeSheetTab requires appendRowWithToken() with access token");
}

/**
 * Update a single cell in Sheets via Google API (requires OAuth2 token).
 * @param {string} range - Cell range (e.g., "Inventory!G2")
 * @param {string} value - Value to set
 * @param {string} accessToken - OAuth2 access token (optional, uses getAccessToken() if available)
 * @returns {Promise<void>}
 */
async function updateSheetCell(range, value, accessToken) {
  const sheetId = getSheetId();
  const token = accessToken || (typeof getAccessToken === 'function' ? getAccessToken() : null);

  if (!sheetId) {
    throw new Error("Sheet ID not configured");
  }

  if (!token) {
    console.warn("updateSheetCell: No access token available, skipping update");
    return;
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?valueInputOption=USER_ENTERED`;
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ values: [[value]] })
  });

  if (!response.ok) {
    if (response.status === 401 && typeof handleAuthError === 'function') {
      handleAuthError("Token expired - please re-login");
      return;
    }
    const error = await response.json();
    console.error(`Sheets API update error: ${error.error?.message || response.statusText}`);
    throw new Error(`Failed to update cell: ${error.error?.message || response.statusText}`);
  }

  console.log(`Updated cell ${range} to "${value}"`);
}

/**
 * Clear a range in Sheets via Google API (requires OAuth2 token).
 * @param {string} range - Range to clear (e.g., "Inventory!A2:L2")
 * @param {string} accessToken - OAuth2 access token (optional, uses getAccessToken() if available)
 * @returns {Promise<void>}
 */
async function clearSheetRange(range, accessToken) {
  const sheetId = getSheetId();
  const token = accessToken || (typeof getAccessToken === 'function' ? getAccessToken() : null);

  if (!sheetId) {
    throw new Error("Sheet ID not configured");
  }

  if (!token) {
    console.warn("clearSheetRange: No access token available, skipping delete");
    return;
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}:clear`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    if (response.status === 401 && typeof handleAuthError === 'function') {
      handleAuthError("Token expired - please re-login");
      return;
    }
    const error = await response.json();
    console.error(`Sheets API clear error: ${error.error?.message || response.statusText}`);
    throw new Error(`Failed to clear range: ${error.error?.message || response.statusText}`);
  }

  console.log(`Cleared range ${range}`);
}

/**
 * Atomically replace a sheet range with new data (clear + append in one request)
 * @param {string} range - Sheet range (e.g. "Planning!A2:C100")
 * @param {Array<Array>} values - 2D array of values to write
 * @param {string} accessToken - OAuth2 access token
 * @returns {Promise<Object>} API response
 */
async function batchUpdateRange(range, values, accessToken) {
  const sheetId = getSheetId();
  const token = accessToken || (typeof getAccessToken === 'function' ? getAccessToken() : null);

  if (!sheetId) {
    throw new Error("Sheet ID not configured");
  }

  if (!token) {
    throw new Error("No access token available");
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?valueInputOption=RAW`;
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ values })
  });

  if (!response.ok) {
    if (response.status === 401 && typeof handleAuthError === 'function') {
      handleAuthError("Token expired - please re-login");
      return {};
    }
    const error = await response.json();
    throw new Error(`Sheets API update error: ${error.error?.message || response.statusText}`);
  }

  return response.json();
}

/**
 * Batch update multiple non-contiguous cells in one API call.
 * @param {Array<{range:string, value:string}>} updates - e.g. [{range:'Inventory!D2', value:'0'}]
 * @param {string} accessToken
 */
async function batchUpdateCells(updates, accessToken) {
  const spreadsheetId = getSheetId();
  const token = accessToken || (typeof getAccessToken === 'function' ? getAccessToken() : null);
  if (!token) throw new Error("No access token for batchUpdateCells");
  if (!updates || updates.length === 0) return;

  const data = updates.map(u => ({ range: u.range, values: [[u.value]] }));
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ valueInputOption: 'RAW', data })
    }
  );
  if (!response.ok) {
    if (response.status === 401 && typeof handleAuthError === 'function') {
      handleAuthError("Token expired - please re-login");
      return;
    }
    const err = await response.json();
    throw new Error(`batchUpdateCells failed: ${err.error?.message || response.statusText}`);
  }
}

/**
 * Delete a single row from a sheet tab by 1-based row number.
 * Safer than clear+rewrite for single-row deletions.
 * @param {string} tabName - Sheet tab name (e.g. "History_florian")
 * @param {number} rowNumber - 1-based row number (row 1 = header, row 2 = first data row)
 * @param {string} accessToken - OAuth2 access token
 */
async function deleteSheetRow(tabName, rowNumber, accessToken) {
  const spreadsheetId = getSheetId();
  const token = accessToken || (typeof getAccessToken === 'function' ? getAccessToken() : null);
  if (!token) throw new Error("No access token for deleteSheetRow");

  const metaResp = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!metaResp.ok) {
    if (metaResp.status === 401 && typeof handleAuthError === 'function') { handleAuthError("Token expired - please re-login"); return; }
    throw new Error("deleteSheetRow: failed to get sheet metadata");
  }
  const meta = await metaResp.json();
  const tab = (meta.sheets || []).find(s => s.properties.title === tabName);
  if (!tab) throw new Error(`deleteSheetRow: tab "${tabName}" not found`);

  const startIndex = rowNumber - 1; // convert to 0-based
  const delResp = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          deleteDimension: {
            range: { sheetId: tab.properties.sheetId, dimension: 'ROWS', startIndex, endIndex: startIndex + 1 }
          }
        }]
      })
    }
  );
  if (!delResp.ok) {
    if (delResp.status === 401 && typeof handleAuthError === 'function') { handleAuthError("Token expired - please re-login"); return; }
    const err = await delResp.json();
    throw new Error(`deleteSheetRow failed: ${err.error?.message || delResp.statusText}`);
  }
}

// Export all functions to the window object so they can be used globally (in browser)
if (typeof window !== 'undefined') {
  window.SheetsAPI = {
    getSheetId,
    readSheetTab,
    rowsToObjects,
    writeSheetTab,
    appendRowWithToken,
    appendConsumptionRecord,
    updateSheetCell,
    clearSheetRange,
    batchUpdateRange,
    batchUpdateCells,
    deleteSheetRow
  };
}

// Export for CommonJS (Node.js/Jest)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    readSheetTab,
    rowsToObjects,
    writeSheetTab
  };
}
