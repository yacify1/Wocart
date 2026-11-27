import { describe, expect, it } from "vitest";
import { saveAppearanceSchema } from "./appearance";

describe("appearance save schema", () => {
  it("accepts a hero-only section edit, as an immediate picture save sends", () => {
    const parsed = saveAppearanceSchema.parse({
      sections: {
        hero: { image: { key: "products/hero.webp", width: 1200, height: 600 } },
      },
    });

    expect(parsed.sections).toEqual({
      hero: { image: { key: "products/hero.webp", width: 1200, height: 600 } },
    });
  });

  it("accepts merchant-friendly contact details and rejects unsafe links", () => {
    const parsed = saveAppearanceSchema.parse({
      contact: { contactPhone: "+213 55 12 34 56", contactEmail: "hello@example.dz", instagramUrl: "@shop.dz" },
    });
    expect(parsed.contact).toMatchObject({ instagramUrl: "@shop.dz" });
    expect(() => saveAppearanceSchema.parse({ contact: { contactPhone: "javascript:alert(1)" } })).toThrow();
    expect(() => saveAppearanceSchema.parse({ contact: { twitterUrl: "https://x.test" } })).toThrow();
  });

  it("still rejects a section the storefront does not have", () => {
    expect(() => saveAppearanceSchema.parse({ sections: { unknown: {} } })).toThrow();
  });
});
