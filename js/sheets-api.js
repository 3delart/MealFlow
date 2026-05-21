/**
 * Google Sheets API v4 Wrapper
 * Provides functions to read data from Google Sheets and convert to usable formats
 */

// Configuration constants
// User must replace these with their actual values from Google Cloud Console
const SHEET_ID = "YOUR_SHEET_ID_HERE";
const SHEET_API_KEY = "YOUR_API_KEY_HERE";

/**
 * Reads data from a Google Sheet tab
 * @param {string} tabName - The name of the sheet tab to read from
 * @returns {Promise<Array<Array>>} Array of rows, where each row is an array of cell values
 * @throws {Error} If the API request fails
 */
async function readSheetTab(tabName) {
  try {
    // Construct the API URL for the specified tab
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${tabName}?key=${SHEET_API_KEY}`;

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
 * Writes data to a Google Sheet tab
 * NOTE: This is a stub function. Writing to Google Sheets requires OAuth2 authentication
 * or a service account, which is not possible with a public API key.
 *
 * TODO: Implement with OAuth2 or service account credentials
 *
 * @param {string} tabName - The name of the sheet tab to write to
 * @param {Array<Array>} rows - Array of rows to write
 * @throws {Error} Always throws as write is not yet implemented
 */
function writeSheetTab(tabName, rows) {
  console.warn(
    "Write not yet implemented. " +
    "Writing to Google Sheets requires OAuth2 or service account authentication. " +
    "Please use the Google Sheets UI to modify data, or implement OAuth2."
  );
  throw new Error("writeSheetTab is not yet implemented");
}

// Export all functions to the window object so they can be used globally (in browser)
if (typeof window !== 'undefined') {
  window.SheetsAPI = {
    readSheetTab,
    rowsToObjects,
    writeSheetTab
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
