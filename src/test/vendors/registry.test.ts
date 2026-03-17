import { describe, it, expect } from "vitest";
import {
  getAllVendors,
  getEnabledVendors,
  getVendorById,
  getVendorsByCategory,
  searchVendors,
} from "../../vendors/registry.js";

describe("registry", () => {
  describe("getAllVendors", () => {
    it("returns all vendors from catalog", () => {
      const vendors = getAllVendors();
      expect(vendors.length).toBeGreaterThanOrEqual(50);
    });

    it("every vendor has required fields", () => {
      for (const v of getAllVendors()) {
        expect(v.id).toBeTruthy();
        expect(v.name).toBeTruthy();
        expect(v.category).toBeTruthy();
        expect(v.statusPageUrl).toBeTruthy();
        expect(v.ingestion).toBeDefined();
        expect(v.ingestion.type).toBeTruthy();
        expect(v.ingestion.url).toBeTruthy();
        expect(v.pollIntervalSeconds).toBeGreaterThan(0);
        expect(typeof v.defaultEnabled).toBe("boolean");
      }
    });

    it("has no duplicate IDs", () => {
      const ids = getAllVendors().map((v) => v.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe("getEnabledVendors", () => {
    it("returns only vendors with defaultEnabled=true", () => {
      const enabled = getEnabledVendors();
      expect(enabled.length).toBeGreaterThan(0);
      expect(enabled.length).toBeLessThan(getAllVendors().length);
      for (const v of enabled) {
        expect(v.defaultEnabled).toBe(true);
      }
    });

    it("includes GitHub, Stripe, Vercel", () => {
      const ids = getEnabledVendors().map((v) => v.id);
      expect(ids).toContain("github");
      expect(ids).toContain("stripe");
      expect(ids).toContain("vercel");
    });
  });

  describe("getVendorById", () => {
    it("returns GitHub by id", () => {
      const gh = getVendorById("github");
      expect(gh).toBeDefined();
      expect(gh!.name).toBe("GitHub");
      expect(gh!.category).toBe("devtools");
      expect(gh!.ingestion.type).toBe("statuspage-api");
    });

    it("returns undefined for unknown id", () => {
      expect(getVendorById("nonexistent")).toBeUndefined();
    });

    it("returns AWS by id", () => {
      const aws = getVendorById("aws");
      expect(aws).toBeDefined();
      expect(aws!.ingestion.type).toBe("rss");
    });
  });

  describe("getVendorsByCategory", () => {
    it("returns cloud providers", () => {
      const cloud = getVendorsByCategory("cloud");
      expect(cloud.length).toBeGreaterThanOrEqual(3);
      const names = cloud.map((v) => v.name);
      expect(names).toContain("AWS");
      expect(names).toContain("DigitalOcean");
    });

    it("returns empty for unknown category", () => {
      expect(getVendorsByCategory("nonexistent")).toEqual([]);
    });
  });

  describe("searchVendors", () => {
    it("finds GitHub by name", () => {
      const results = searchVendors("GitHub");
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].id).toBe("github");
    });

    it("is case-insensitive", () => {
      const results = searchVendors("STRIPE");
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].id).toBe("stripe");
    });

    it("searches by partial id", () => {
      const results = searchVendors("git");
      const ids = results.map((v) => v.id);
      expect(ids).toContain("github");
      expect(ids).toContain("gitlab");
    });

    it("searches by category", () => {
      const results = searchVendors("monitoring");
      expect(results.length).toBeGreaterThanOrEqual(3);
    });

    it("returns empty for no match", () => {
      expect(searchVendors("zzzzz_nothing")).toEqual([]);
    });
  });
});
