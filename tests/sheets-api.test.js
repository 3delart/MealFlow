/**
 * Unit tests for Google Sheets API wrapper
 * Tests for the SheetsAPI module functions
 */

// Import the sheets-api module
const { readSheetTab, rowsToObjects, writeSheetTab } = require('../js/sheets-api.js');

describe('SheetsAPI', () => {
  describe('rowsToObjects', () => {
    test('should convert rows to objects with headers as keys', () => {
      const rows = [
        ['Name', 'Age', 'City'],
        ['Alice', '30', 'NYC'],
        ['Bob', '25', 'LA']
      ];

      const result = rowsToObjects(rows);

      expect(result).toEqual([
        { Name: 'Alice', Age: '30', City: 'NYC' },
        { Name: 'Bob', Age: '25', City: 'LA' }
      ]);
    });

    test('should return empty array when input is empty', () => {
      const result = rowsToObjects([]);
      expect(result).toEqual([]);
    });

    test('should return empty array when input is null or undefined', () => {
      expect(rowsToObjects(null)).toEqual([]);
      expect(rowsToObjects(undefined)).toEqual([]);
    });

    test('should return empty array when only headers are provided', () => {
      const rows = [['Name', 'Age', 'City']];
      const result = rowsToObjects(rows);
      expect(result).toEqual([]);
    });

    test('should handle rows with missing cells by filling with empty strings', () => {
      const rows = [
        ['A', 'B', 'C'],
        ['1', '2']
      ];

      const result = rowsToObjects(rows);

      expect(result).toEqual([
        { A: '1', B: '2', C: '' }
      ]);
    });

    test('should handle rows where all cells are missing except first', () => {
      const rows = [
        ['Column1', 'Column2', 'Column3'],
        ['OnlyValue']
      ];

      const result = rowsToObjects(rows);

      expect(result).toEqual([
        { Column1: 'OnlyValue', Column2: '', Column3: '' }
      ]);
    });

    test('should handle multiple rows with varying missing cells', () => {
      const rows = [
        ['First', 'Second', 'Third', 'Fourth'],
        ['A', 'B', 'C', 'D'],
        ['1', '2'],
        ['X', 'Y', 'Z']
      ];

      const result = rowsToObjects(rows);

      expect(result).toEqual([
        { First: 'A', Second: 'B', Third: 'C', Fourth: 'D' },
        { First: '1', Second: '2', Third: '', Fourth: '' },
        { First: 'X', Second: 'Y', Third: 'Z', Fourth: '' }
      ]);
    });

    test('should preserve data types (strings)', () => {
      const rows = [
        ['String', 'Number', 'Boolean'],
        ['hello', '123', 'true'],
        ['world', '456', 'false']
      ];

      const result = rowsToObjects(rows);

      // All values should be strings (no type conversion)
      expect(result[0].String).toBe('hello');
      expect(result[0].Number).toBe('123');
      expect(result[0].Boolean).toBe('true');
      expect(typeof result[0].Number).toBe('string');
    });

    test('should handle special characters in header and data', () => {
      const rows = [
        ['User-Name', 'Email_Address', 'Phone #'],
        ['John-Doe', 'john@example.com', '555-1234']
      ];

      const result = rowsToObjects(rows);

      expect(result).toEqual([
        { 'User-Name': 'John-Doe', 'Email_Address': 'john@example.com', 'Phone #': '555-1234' }
      ]);
    });

    test('should handle empty strings in data', () => {
      const rows = [
        ['Name', 'Email', 'Phone'],
        ['Alice', '', 'phone1'],
        ['Bob', 'bob@example.com', '']
      ];

      const result = rowsToObjects(rows);

      expect(result).toEqual([
        { Name: 'Alice', Email: '', Phone: 'phone1' },
        { Name: 'Bob', Email: 'bob@example.com', Phone: '' }
      ]);
    });
  });

  describe('readSheetTab', () => {
    test('should be an async function that returns a Promise', () => {
      // Verify that readSheetTab returns a promise
      // Note: This will fail due to invalid SHEET_ID/API_KEY, but we're testing the structure
      const result = readSheetTab('TestSheet');
      expect(result).toBeInstanceOf(Promise);

      // Handle the promise rejection to avoid unhandled rejection
      return result.catch(() => {
        // Expected to fail with invalid credentials
      });
    });

    test('should export readSheetTab function', () => {
      // This test documents the expected behavior when API keys are not set
      // In practice, the user must configure SHEET_ID and SHEET_API_KEY
      expect(typeof readSheetTab).toBe('function');
    });
  });

  describe('writeSheetTab', () => {
    test('should throw error indicating not implemented', () => {
      expect(() => {
        writeSheetTab('TestSheet', [['test']]);
      }).toThrow('writeSheetTab is not yet implemented');
    });

    test('should log a warning before throwing', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      try {
        writeSheetTab('TestSheet', [['test']]);
      } catch (e) {
        // Expected to throw
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Write not yet implemented')
      );

      consoleSpy.mockRestore();
    });
  });
});
