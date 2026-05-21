/**
 * @fileoverview Unit tests for utils.js module
 * Tests cover date utilities, BMR/TDEE calculations, and DOM helpers
 */

// Mock document.createElement for DOM tests before loading utils
global.document = {
  createElement: (tag) => {
    const element = {
      tagName: tag.toUpperCase(),
      attributes: {},
      children: [],
      className: '',
      style: {},
      textContent: '',
      setAttribute: function(key, value) {
        this.attributes[key] = value;
      },
      getAttribute: function(key) {
        return this.attributes[key];
      },
      removeChild: function(child) {
        const index = this.children.indexOf(child);
        if (index > -1) {
          this.children.splice(index, 1);
        }
      },
      get firstChild() {
        return this.children.length > 0 ? this.children[0] : null;
      }
    };
    return element;
  }
};

// Load the utils module
const Utils = require('../js/utils.js');

// =============================================================================
// DATE UTILITIES TESTS
// =============================================================================

describe('Date Utilities', () => {
  describe('getTodayISO', () => {
    test('should return date in YYYY-MM-DD format', () => {
      const today = Utils.getTodayISO();
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test('should return today\'s date', () => {
      const today = Utils.getTodayISO();
      const now = new Date();
      const expectedDate = now.toISOString().split('T')[0];
      expect(today).toBe(expectedDate);
    });
  });

  describe('getDateISO', () => {
    test('should return today for offset 0', () => {
      const today = Utils.getTodayISO();
      const result = Utils.getDateISO(0);
      expect(result).toBe(today);
    });

    test('should return tomorrow for offset 1', () => {
      const tomorrow = Utils.getDateISO(1);
      const today = Utils.getTodayISO();
      const todayDate = new Date(today);
      const tomorrowDate = new Date(todayDate);
      tomorrowDate.setDate(tomorrowDate.getDate() + 1);
      const expectedTomorrow = tomorrowDate.toISOString().split('T')[0];
      expect(tomorrow).toBe(expectedTomorrow);
    });

    test('should return yesterday for offset -1', () => {
      const yesterday = Utils.getDateISO(-1);
      const today = Utils.getTodayISO();
      const todayDate = new Date(today);
      const yesterdayDate = new Date(todayDate);
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const expectedYesterday = yesterdayDate.toISOString().split('T')[0];
      expect(yesterday).toBe(expectedYesterday);
    });

    test('should return correct date for positive offset', () => {
      const future = Utils.getDateISO(7);
      expect(future).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test('should return correct date for negative offset', () => {
      const past = Utils.getDateISO(-7);
      expect(past).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('getDayName', () => {
    test('should return "Lun" for Monday 2026-05-18', () => {
      const result = Utils.getDayName('2026-05-18');
      expect(result).toBe('Lun');
    });

    test('should return "Mar" for Tuesday 2026-05-19', () => {
      const result = Utils.getDayName('2026-05-19');
      expect(result).toBe('Mar');
    });

    test('should return "Mer" for Wednesday 2026-05-20', () => {
      const result = Utils.getDayName('2026-05-20');
      expect(result).toBe('Mer');
    });

    test('should return "Jeu" for Thursday 2026-05-21', () => {
      const result = Utils.getDayName('2026-05-21');
      expect(result).toBe('Jeu');
    });

    test('should return "Ven" for Friday 2026-05-22', () => {
      const result = Utils.getDayName('2026-05-22');
      expect(result).toBe('Ven');
    });

    test('should return "Sam" for Saturday 2026-05-23', () => {
      const result = Utils.getDayName('2026-05-23');
      expect(result).toBe('Sam');
    });

    test('should return "Dim" for Sunday 2026-05-24', () => {
      const result = Utils.getDayName('2026-05-24');
      expect(result).toBe('Dim');
    });

    test('should return 3-letter abbreviation', () => {
      const result = Utils.getDayName('2026-05-18');
      expect(result.length).toBe(3);
    });
  });

  describe('formatDate', () => {
    test('should return formatted date for 2026-05-18', () => {
      const result = Utils.formatDate('2026-05-18');
      expect(result).toBe('Lun 18 mai');
    });

    test('should return formatted date for 2026-05-01', () => {
      const result = Utils.formatDate('2026-05-01');
      expect(result).toMatch(/\d+ mai/);
    });

    test('should include day name', () => {
      const result = Utils.formatDate('2026-05-18');
      expect(result).toMatch(/^(Dim|Lun|Mar|Mer|Jeu|Ven|Sam)/);
    });

    test('should include day number', () => {
      const result = Utils.formatDate('2026-05-18');
      expect(result).toMatch(/\d{1,2}/);
    });

    test('should include month name', () => {
      const result = Utils.formatDate('2026-05-18');
      expect(result).toMatch(/(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)/);
    });

    test('should format January correctly', () => {
      const result = Utils.formatDate('2026-01-15');
      expect(result).toContain('janvier');
    });

    test('should format December correctly', () => {
      const result = Utils.formatDate('2026-12-25');
      expect(result).toContain('décembre');
    });
  });
});

// =============================================================================
// EXPIRATION TESTS
// =============================================================================

describe('Expiration Utilities', () => {
  describe('daysUntilExpiration', () => {
    test('should return 0 for today', () => {
      const today = Utils.getTodayISO();
      const result = Utils.daysUntilExpiration(today);
      expect(result).toBe(0);
    });

    test('should return positive number for future date', () => {
      const future = Utils.getDateISO(5);
      const result = Utils.daysUntilExpiration(future);
      expect(result).toBeGreaterThan(0);
      expect(result).toBe(5);
    });

    test('should return negative number for past date', () => {
      const past = Utils.getDateISO(-5);
      const result = Utils.daysUntilExpiration(past);
      expect(result).toBeLessThan(0);
      expect(result).toBe(-5);
    });

    test('should return 3 for 3 days in future', () => {
      const future = Utils.getDateISO(3);
      const result = Utils.daysUntilExpiration(future);
      expect(result).toBe(3);
    });

    test('should return -1 for 1 day past', () => {
      const past = Utils.getDateISO(-1);
      const result = Utils.daysUntilExpiration(past);
      expect(result).toBe(-1);
    });
  });

  describe('isExpired', () => {
    test('should return true for past date', () => {
      const past = Utils.getDateISO(-1);
      const result = Utils.isExpired(past);
      expect(result).toBe(true);
    });

    test('should return false for today', () => {
      const today = Utils.getTodayISO();
      const result = Utils.isExpired(today);
      expect(result).toBe(false);
    });

    test('should return false for future date', () => {
      const future = Utils.getDateISO(1);
      const result = Utils.isExpired(future);
      expect(result).toBe(false);
    });

    test('should return true for 10 days past', () => {
      const past = Utils.getDateISO(-10);
      const result = Utils.isExpired(past);
      expect(result).toBe(true);
    });

    test('should return false for 10 days in future', () => {
      const future = Utils.getDateISO(10);
      const result = Utils.isExpired(future);
      expect(result).toBe(false);
    });
  });

  describe('isExpiringS', () => {
    test('should return true for less than 3 days', () => {
      const twoDay = Utils.getDateISO(2);
      const result = Utils.isExpiringS(twoDay);
      expect(result).toBe(true);
    });

    test('should return true for 0 days (today)', () => {
      const today = Utils.getTodayISO();
      const result = Utils.isExpiringS(today);
      expect(result).toBe(true);
    });

    test('should return true for 1 day', () => {
      const tomorrow = Utils.getDateISO(1);
      const result = Utils.isExpiringS(tomorrow);
      expect(result).toBe(true);
    });

    test('should return false for 3 days', () => {
      const threeDay = Utils.getDateISO(3);
      const result = Utils.isExpiringS(threeDay);
      expect(result).toBe(false);
    });

    test('should return false for 5 days', () => {
      const fiveDay = Utils.getDateISO(5);
      const result = Utils.isExpiringS(fiveDay);
      expect(result).toBe(false);
    });

    test('should return false for past date', () => {
      const past = Utils.getDateISO(-1);
      const result = Utils.isExpiringS(past);
      expect(result).toBe(false);
    });

    test('should return false for far future', () => {
      const future = Utils.getDateISO(30);
      const result = Utils.isExpiringS(future);
      expect(result).toBe(false);
    });
  });
});

// =============================================================================
// BMR/TDEE TESTS
// =============================================================================

describe('BMR/TDEE Calculations', () => {
  describe('calculateBMR', () => {
    test('should calculate BMR for male correctly', () => {
      // BMR = (10×75) + (6.25×180) - (5×32) + 5
      // BMR = 750 + 1125 - 160 + 5 = 1720
      const result = Utils.calculateBMR(75, 180, 32, 'M');
      expect(result).toBe(1720);
    });

    test('should calculate BMR for female correctly', () => {
      // BMR = (10×62) + (6.25×165) - (5×29) - 161
      // BMR = 620 + 1031.25 - 145 - 161 = 1345.25 → 1345
      const result = Utils.calculateBMR(62, 165, 29, 'F');
      expect(result).toBeCloseTo(1345, 0);
    });

    test('should handle lowercase sex parameter', () => {
      const resultM = Utils.calculateBMR(75, 180, 32, 'm');
      const resultF = Utils.calculateBMR(62, 165, 29, 'f');
      expect(resultM).toBe(1720);
      expect(resultF).toBeCloseTo(1345, 0);
    });

    test('should return number for valid inputs', () => {
      const result = Utils.calculateBMR(75, 180, 32, 'M');
      expect(typeof result).toBe('number');
    });

    test('should calculate different BMR for different weights', () => {
      const light = Utils.calculateBMR(60, 180, 32, 'M');
      const heavy = Utils.calculateBMR(90, 180, 32, 'M');
      expect(heavy).toBeGreaterThan(light);
    });

    test('should calculate different BMR for different heights', () => {
      const short = Utils.calculateBMR(75, 165, 32, 'M');
      const tall = Utils.calculateBMR(75, 190, 32, 'M');
      expect(tall).toBeGreaterThan(short);
    });

    test('should calculate different BMR for different ages', () => {
      const young = Utils.calculateBMR(75, 180, 20, 'M');
      const old = Utils.calculateBMR(75, 180, 60, 'M');
      expect(young).toBeGreaterThan(old);
    });
  });

  describe('calculateTDEE', () => {
    test('should calculate TDEE with Sédentaire activity', () => {
      // 1720 × 1.2 = 2064
      const result = Utils.calculateTDEE(1720, 'Sédentaire');
      expect(result).toBe(2064);
    });

    test('should calculate TDEE with Léger activity', () => {
      // 1720 × 1.375 = 2365
      const result = Utils.calculateTDEE(1720, 'Léger');
      expect(result).toBe(2365);
    });

    test('should calculate TDEE with Modéré activity', () => {
      // 1720 × 1.55 = 2666
      const result = Utils.calculateTDEE(1720, 'Modéré');
      expect(result).toBe(2666);
    });

    test('should calculate TDEE with Actif activity', () => {
      // 1720 × 1.725 = 2967
      const result = Utils.calculateTDEE(1720, 'Actif');
      expect(result).toBe(2967);
    });

    test('should calculate TDEE with Très actif activity', () => {
      // 1720 × 1.9 = 3268
      const result = Utils.calculateTDEE(1720, 'Très actif');
      expect(result).toBe(3268);
    });

    test('should return rounded number', () => {
      const result = Utils.calculateTDEE(1600, 'Modéré');
      expect(Number.isInteger(result)).toBe(true);
    });

    test('should return higher TDEE for higher activity level', () => {
      const bmr = 1720;
      const sedentaire = Utils.calculateTDEE(bmr, 'Sédentaire');
      const modere = Utils.calculateTDEE(bmr, 'Modéré');
      const actif = Utils.calculateTDEE(bmr, 'Très actif');
      expect(sedentaire < modere).toBe(true);
      expect(modere < actif).toBe(true);
    });

    test('should default to Sédentaire for unknown activity', () => {
      const result = Utils.calculateTDEE(1720, 'Unknown');
      expect(result).toBe(2064);
    });
  });

  describe('calculateObjectiveCalories', () => {
    test('should calculate Perte légère (-250)', () => {
      // 2666 - 250 = 2416
      const result = Utils.calculateObjectiveCalories(2666, 'Perte légère');
      expect(result).toBe(2416);
    });

    test('should calculate Perte modérée (-500)', () => {
      // 2666 - 500 = 2166
      const result = Utils.calculateObjectiveCalories(2666, 'Perte modérée');
      expect(result).toBe(2166);
    });

    test('should calculate Perte agressive (-750)', () => {
      // 2666 - 750 = 1916
      const result = Utils.calculateObjectiveCalories(2666, 'Perte agressive');
      expect(result).toBe(1916);
    });

    test('should calculate Maintien (0)', () => {
      // 2666 + 0 = 2666
      const result = Utils.calculateObjectiveCalories(2666, 'Maintien');
      expect(result).toBe(2666);
    });

    test('should calculate Prise de masse (+300)', () => {
      // 2666 + 300 = 2966
      const result = Utils.calculateObjectiveCalories(2666, 'Prise de masse');
      expect(result).toBe(2966);
    });

    test('should return rounded number', () => {
      const result = Utils.calculateObjectiveCalories(2600.5, 'Perte modérée');
      expect(Number.isInteger(result)).toBe(true);
    });

    test('should default to 0 adjustment for unknown objective', () => {
      const result = Utils.calculateObjectiveCalories(2666, 'Unknown');
      expect(result).toBe(2666);
    });

    test('should produce different results for different objectives', () => {
      const tdee = 2666;
      const perte = Utils.calculateObjectiveCalories(tdee, 'Perte modérée');
      const maintien = Utils.calculateObjectiveCalories(tdee, 'Maintien');
      const prise = Utils.calculateObjectiveCalories(tdee, 'Prise de masse');
      expect(perte < maintien).toBe(true);
      expect(maintien < prise).toBe(true);
    });
  });
});

// =============================================================================
// DOM TESTS
// =============================================================================

describe('DOM Helpers', () => {
  describe('createElement', () => {
    test('should create element with correct tag', () => {
      const el = Utils.createElement('div', {}, 'test');
      expect(el.tagName).toBe('DIV');
    });

    test('should set id attribute', () => {
      const el = Utils.createElement('div', { id: 'test-id' }, '');
      expect(el.getAttribute('id')).toBe('test-id');
    });

    test('should set className', () => {
      const el = Utils.createElement('div', { className: 'my-class' }, '');
      expect(el.className).toBe('my-class');
    });

    test('should set multiple classes', () => {
      const el = Utils.createElement('div', { className: 'class1 class2' }, '');
      expect(el.className).toBe('class1 class2');
    });

    test('should set text content', () => {
      const el = Utils.createElement('div', {}, 'Hello World');
      expect(el.textContent).toBe('Hello World');
    });

    test('should set custom attributes', () => {
      const el = Utils.createElement('input', { type: 'text', name: 'username' }, '');
      expect(el.getAttribute('type')).toBe('text');
      expect(el.getAttribute('name')).toBe('username');
    });

    test('should set style properties', () => {
      const el = Utils.createElement('div', { style: { color: 'red', display: 'none' } }, '');
      expect(el.style.color).toBe('red');
      expect(el.style.display).toBe('none');
    });

    test('should create different tags', () => {
      const div = Utils.createElement('div', {}, '');
      const span = Utils.createElement('span', {}, '');
      const button = Utils.createElement('button', {}, '');
      expect(div.tagName).toBe('DIV');
      expect(span.tagName).toBe('SPAN');
      expect(button.tagName).toBe('BUTTON');
    });

    test('should work with empty attributes', () => {
      const el = Utils.createElement('div', {}, 'text');
      expect(el.textContent).toBe('text');
    });

    test('should work with no content parameter', () => {
      const el = Utils.createElement('div', { id: 'test' });
      expect(el.getAttribute('id')).toBe('test');
      expect(el.textContent).toBe('');
    });
  });

  describe('clearElement', () => {
    test('should remove all children from element', () => {
      const el = Utils.createElement('div', {}, '');
      el.children = [
        { tagName: 'SPAN' },
        { tagName: 'P' },
        { tagName: 'DIV' }
      ];
      expect(el.children.length).toBe(3);
      Utils.clearElement(el);
      expect(el.children.length).toBe(0);
    });

    test('should work on empty element', () => {
      const el = Utils.createElement('div', {}, '');
      expect(() => Utils.clearElement(el)).not.toThrow();
      expect(el.children.length).toBe(0);
    });

    test('should remove firstChild property after clearing', () => {
      const el = Utils.createElement('div', {}, '');
      el.children = [{ tagName: 'SPAN' }];
      Utils.clearElement(el);
      expect(el.firstChild).toBe(null);
    });

    test('should handle element with single child', () => {
      const el = Utils.createElement('div', {}, '');
      el.children = [{ tagName: 'SPAN' }];
      Utils.clearElement(el);
      expect(el.children.length).toBe(0);
    });

    test('should handle element with many children', () => {
      const el = Utils.createElement('div', {}, '');
      el.children = Array(100).fill().map(() => ({ tagName: 'SPAN' }));
      expect(el.children.length).toBe(100);
      Utils.clearElement(el);
      expect(el.children.length).toBe(0);
    });
  });
});

// =============================================================================
// INTEGRATION TESTS
// =============================================================================

describe('Integration Tests', () => {
  test('should calculate full TDEE flow', () => {
    const weight = 75;
    const height = 180;
    const age = 32;
    const sex = 'M';
    const activity = 'Modéré';
    const objective = 'Perte modérée';

    const bmr = Utils.calculateBMR(weight, height, age, sex);
    const tdee = Utils.calculateTDEE(bmr, activity);
    const target = Utils.calculateObjectiveCalories(tdee, objective);

    expect(bmr).toBe(1720);
    expect(tdee).toBe(2666);
    expect(target).toBe(2166);
  });

  test('should format dates and calculate expiration', () => {
    const futureDate = Utils.getDateISO(5);
    const formatted = Utils.formatDate(futureDate);
    const daysLeft = Utils.daysUntilExpiration(futureDate);

    expect(formatted).toMatch(/\d+ (janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)/);
    expect(daysLeft).toBe(5);
    expect(Utils.isExpired(futureDate)).toBe(false);
    expect(Utils.isExpiringS(futureDate)).toBe(false);
  });

  test('should handle edge case: expiring soon', () => {
    const soonDate = Utils.getDateISO(2);
    expect(Utils.isExpiringS(soonDate)).toBe(true);
    expect(Utils.isExpired(soonDate)).toBe(false);
    expect(Utils.daysUntilExpiration(soonDate)).toBe(2);
  });
});
