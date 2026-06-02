import { describe, it, expect } from "vitest";
import config from "../js/config.js";

const { suggestDietConcepts, DIET_RULES } = config;

describe("suggestDietConcepts", () => {
  it("detects fish from name keyword", () => {
    expect(suggestDietConcepts("Filet de cabillaud", "", "")).toContain("poisson");
    expect(suggestDietConcepts("Pavé de saumon", "", "")).toContain("poisson");
  });

  it("detects concepts from English OFF allergens", () => {
    const c = suggestDietConcepts("Biscuits", "en:milk, en:gluten", "Apéro");
    expect(c).toContain("lait");
    expect(c).toContain("gluten");
  });

  it("uses inventory category", () => {
    expect(suggestDietConcepts("Comté", "", "Fromage")).toContain("lait");
    expect(suggestDietConcepts("Truc", "", "Poissons")).toContain("poisson");
  });

  it("detects pork for halal via keyword", () => {
    const c = suggestDietConcepts("Lardons fumés", "", "Viandes");
    expect(c).toContain("porc");
    expect(c).toContain("viande");
  });

  it("treats honey as animal-derived", () => {
    expect(suggestDietConcepts("Miel de fleurs", "", "")).toContain("animal");
  });

  it("suppresses animal concepts for plant-based products", () => {
    // Vegan-category plant 'lardon' must not be flagged as meat/pork
    const c = suggestDietConcepts("Lardon fumé lavie", "en:soybeans", "Vegan");
    expect(c).not.toContain("viande");
    expect(c).not.toContain("porc");
    // soy yogurt under Produits laitiers must not be flagged as dairy
    const s = suggestDietConcepts("Sojade citron", "", "Produits laitiers");
    expect(s).not.toContain("lait");
  });

  it("does not false-match short keywords across word boundaries", () => {
    // "ble" (gluten) must not match inside "blette"
    expect(suggestDietConcepts("Blettes", "", "Légumes")).not.toContain("gluten");
  });
});

describe("DIET_RULES", () => {
  it("vegan forbids all animal-origin concepts incl. animal", () => {
    expect(DIET_RULES.vegan).toEqual(
      expect.arrayContaining(["viande", "poisson", "lait", "oeuf", "animal"])
    );
  });
  it("sans lactose forbids dairy", () => {
    expect(DIET_RULES["sans lactose"]).toContain("lait");
  });
});
