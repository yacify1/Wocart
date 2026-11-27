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

  it("still rejects a section the storefront does not have", () => {
    expect(() => saveAppearanceSchema.parse({ sections: { unknown: {} } })).toThrow();
  });
});
