import { describe, expect, it } from "vitest";
import {
  APPEARANCE_DEFAULT_SCHEMES,
  APPEARANCE_HEX,
  appearanceContactHref,
  appearanceDetailColorsProblem,
  appearanceLocaleProblem,
  appearanceSettingsOf,
  appearanceSettingsProblem,
  appearanceSettingsToRemove,
  appearanceSettingsToTheme,
  appearanceTextProblem,
  appearanceThemeSettingsOf,
  colorSchemesProblem,
  mergeAppearance,
  sanitizeHeaderHtml,
  type AppearanceSettings,
} from "./appearance";

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const valid = (): AppearanceSettings => ({
  colorSchemes: clone(APPEARANCE_DEFAULT_SCHEMES),
  pageScheme: "scheme-1",
  hideLogo: false,
  hideHeaderText: false,
  hideMenu: false,
  searchEnabled: true,
  headerHtml: "",
  logoAlignment: "right",
});

describe("colorSchemesProblem", () => {
  it("accepts the theme's shipped schemes", () => {
    expect(colorSchemesProblem(APPEARANCE_DEFAULT_SCHEMES)).toBeNull();
  });

  it("rejects a list that is empty or not a list", () => {
    expect(colorSchemesProblem([])).toMatch(/non-empty/);
    expect(colorSchemesProblem({})).toMatch(/non-empty/);
    expect(colorSchemesProblem(null)).toMatch(/non-empty/);
  });

  it("accepts Auto roles and still rejects a color that is not a hex", () => {
    const schemes = clone(APPEARANCE_DEFAULT_SCHEMES);
    schemes[0]!.colors.background = null;
    delete schemes[1]!.colors.text;
    expect(colorSchemesProblem(schemes)).toBeNull();

    schemes[0]!.colors.button = "red";
    expect(colorSchemesProblem(schemes)).toMatch(/hex color for "button"/);
  });

  it("rejects a color that is not a six-digit hex", () => {
    const schemes = clone(APPEARANCE_DEFAULT_SCHEMES);
    schemes[0]!.colors.button = "red";
    expect(colorSchemesProblem(schemes)).toMatch(/hex color for "button"/);
  });

  it("rejects an id that is not lowercase letters, digits and dashes", () => {
    const schemes = clone(APPEARANCE_DEFAULT_SCHEMES);
    schemes[0]!.id = "Scheme 1";
    expect(colorSchemesProblem(schemes)).toMatch(/lowercase letters/);
  });

  it("rejects a repeated id", () => {
    const schemes = clone(APPEARANCE_DEFAULT_SCHEMES);
    schemes[1]!.id = schemes[0]!.id;
    expect(colorSchemesProblem(schemes)).toMatch(/repeats the id/);
  });

  it("rejects a scheme without a name", () => {
    const schemes = clone(APPEARANCE_DEFAULT_SCHEMES) as unknown as Record<string, unknown>[];
    delete schemes[0]!.name;
    expect(colorSchemesProblem(schemes)).toMatch(/needs a name/);
  });

  it("rejects a color role the theme does not read", () => {
    const schemes = clone(APPEARANCE_DEFAULT_SCHEMES) as unknown as Record<string, unknown>[];
    (schemes[0]!.colors as Record<string, string>).glow = "#ffffff";
    expect(colorSchemesProblem(schemes)).toMatch(/unknown role "glow"/);
  });
});

describe("appearanceSettingsProblem", () => {
  it("accepts a page scheme the list names", () => {
    expect(appearanceSettingsProblem(valid())).toBeNull();
  });

  it("rejects a page scheme the list does not name", () => {
    expect(appearanceSettingsProblem({ ...valid(), pageScheme: "scheme-9" })).toMatch(/does not have/);
  });

  it("rejects a page scheme that is not a string", () => {
    expect(appearanceSettingsProblem({ ...valid(), pageScheme: 1 })).toMatch(/must name a scheme/);
  });
});

describe("mergeAppearance", () => {
  it("takes the whole list when the store has no valid schemes yet", () => {
    const next = valid();
    expect(mergeAppearance(null, next)).toEqual({ settings: next });
  });

  it("merges colors role by role so Auto survives a save that omits other roles", () => {
    const current = valid();
    const next = valid();
    next.colorSchemes[0]!.colors = { background: null };

    const merged = mergeAppearance(current, next);
    expect(merged.error).toBeUndefined();
    expect(merged.settings!.colorSchemes[0]!.colors).toEqual({
      ...current.colorSchemes[0]!.colors,
      background: null,
    });
  });

  it("changes colors while keeping the store's ids, names and order", () => {
    const current = valid();
    const next = valid();
    next.colorSchemes[2]!.colors.background = "#123456";
    next.colorSchemes[2]!.name = "Renamed";
    next.pageScheme = "scheme-3";

    const merged = mergeAppearance(current, next);
    expect(merged.error).toBeUndefined();
    expect(merged.settings!.colorSchemes[2]).toEqual({
      ...current.colorSchemes[2],
      colors: next.colorSchemes[2]!.colors,
    });
    expect(merged.settings!.colorSchemes.map((scheme) => scheme.id)).toEqual(
      current.colorSchemes.map((scheme) => scheme.id),
    );
    expect(merged.settings!.pageScheme).toBe("scheme-3");
  });

  it("refuses to add or remove a scheme", () => {
    const next = valid();
    next.colorSchemes.pop();
    expect(mergeAppearance(valid(), next).error).toMatch(/cannot be added, removed or reordered/);
  });

  it("refuses a list whose ids name different schemes", () => {
    const next = valid();
    next.colorSchemes[0]!.id = "brand";
    next.pageScheme = "brand";
    expect(mergeAppearance(valid(), next).error).toMatch(/cannot be added, removed or reordered|missing/);
  });

  it("refuses a page scheme the store does not have", () => {
    const next = valid();
    next.pageScheme = "scheme-9";
    expect(mergeAppearance(valid(), next).error).toMatch(/scheme-9/);
  });
});

describe("appearanceSettingsOf", () => {
  it("returns the saved settings when the row holds them", () => {
    expect(appearanceSettingsOf({ ...valid() })).toEqual(valid());
  });

  it("returns null for an empty row or a row without usable colors", () => {
    expect(appearanceSettingsOf({})).toBeNull();
    expect(appearanceSettingsOf({ pageScheme: "scheme-1" })).toBeNull();
    expect(appearanceSettingsOf(null)).toBeNull();
  });

  it("reads missing and null roles as Auto, never as an undefined color", () => {
    const stored = valid();
    stored.colorSchemes[0]!.colors.background = null;
    delete stored.colorSchemes[1]!.colors.text;

    const read = appearanceSettingsOf({ ...stored })!;
    expect(read.colorSchemes[0]!.colors.background).toBeNull();
    expect(read.colorSchemes[1]!.colors.text).toBeNull();
  });

  it("ignores the other keys a theme's settings row carries", () => {
    const stored = { ...valid(), headingFont: "Cairo", corners: "round" };
    expect(appearanceSettingsOf(stored)).toEqual(valid());
  });
});

describe("appearanceTextProblem", () => {
  it("accepts a known key within its limit", () => {
    expect(appearanceTextProblem("heroTitle", "Shop with ease")).toBeNull();
    expect(appearanceTextProblem("heroCtaPrimary", "")).toBeNull();
  });

  it("refuses a key the tab does not edit", () => {
    expect(appearanceTextProblem("checkoutTitle", "x")).toMatch(/not an editable text/);
  });

  it("refuses a value past the key's limit", () => {
    expect(appearanceTextProblem("heroCtaPrimary", "x".repeat(41))).toMatch(/at most 40/);
  });

  it("keeps single-line keys single-line and lets a subtitle wrap", () => {
    expect(appearanceTextProblem("heroTitle", "one\ntwo")).toMatch(/single line/);
    expect(appearanceTextProblem("heroSubtitle", "one\ntwo")).toBeNull();
  });
});

describe("appearanceLocaleProblem", () => {
  it("accepts a language the store lists", () => {
    expect(appearanceLocaleProblem("ar", ["ar", "fr"])).toBeNull();
  });

  it("refuses a language the store does not list", () => {
    expect(appearanceLocaleProblem("en", ["ar"])).toMatch(/not one of the store's languages/);
  });
});

describe("the olive preset and storefront controls", () => {
  it("ships an olive scheme the page can wear", () => {
    const olive = APPEARANCE_DEFAULT_SCHEMES.find((scheme) => scheme.id === "scheme-6");
    expect(olive).toMatchObject({ name: "Olive", colors: { background: "#f3f2e7", button: "#4b5b2c" } });
    expect(appearanceSettingsProblem({ ...valid(), pageScheme: "scheme-6" })).toBeNull();
  });

  it("defaults missing controls when an older settings row is read", () => {
    expect(appearanceSettingsOf({ colorSchemes: clone(APPEARANCE_DEFAULT_SCHEMES), pageScheme: "scheme-1" })).toEqual(valid());
    expect(appearanceThemeSettingsOf({ colorSchemes: clone(APPEARANCE_DEFAULT_SCHEMES), pageScheme: "scheme-1" })).toEqual(valid());
  });

  it("keeps the merchant's controls when only colors are saved", () => {
    const current = {
      ...valid(),
      hideLogo: true,
      searchEnabled: false,
      logoAlignment: "left" as const,
      headerHtml: "<strong>Hi</strong>",
      sections: { hero: { hidden: true }, marquee: { image: { key: "landing/strip.jpg" } } },
    };
    const merged = mergeAppearance(current, {
      colorSchemes: current.colorSchemes,
      pageScheme: "scheme-3",
      hideLogo: false,
    });
    expect(merged.settings).toMatchObject({
      pageScheme: "scheme-3",
      hideLogo: false,
      searchEnabled: false,
      logoAlignment: "left",
      headerHtml: "<strong>Hi</strong>",
      sections: current.sections,
    });
  });

  it("keeps the store's colors when only a storefront control is saved", () => {
    const current = {
      ...valid(),
      colorSchemes: clone(APPEARANCE_DEFAULT_SCHEMES).map((scheme, index) =>
        index === 0 ? { ...scheme, colors: { ...scheme.colors, background: "#123456" } } : scheme,
      ),
      pageScheme: "scheme-3",
      hideLogo: true,
    };
    const next = { ...current, hideLogo: false };
    const merged = mergeAppearance(current, next);

    expect(merged.settings).toMatchObject({
      colorSchemes: current.colorSchemes,
      pageScheme: "scheme-3",
      hideLogo: false,
    });
  });

  it("refuses a control that is not on or off, and HTML past its limit", () => {
    expect(appearanceSettingsProblem({ ...valid(), searchEnabled: "yes" })).toMatch(/must be on or off/);
    expect(appearanceSettingsProblem({ ...valid(), headerHtml: "x".repeat(2001) })).toMatch(/at most 2000/);
  });
});

describe("logo alignment and home sections", () => {
  it("takes only the three alignments", () => {
    for (const logoAlignment of ["right", "left", "center"] as const) {
      expect(appearanceSettingsProblem({ ...valid(), logoAlignment })).toBeNull();
    }
    expect(appearanceSettingsProblem({ ...valid(), logoAlignment: "top" })).toMatch(/right, left or center/);
  });

  it("validates each section's hide switch and image reference", () => {
    expect(appearanceSettingsProblem({ ...valid(), sections: { hero: { hidden: true, image: { key: "products/hero.jpg" } } } })).toBeNull();
    expect(appearanceSettingsProblem({ ...valid(), sections: { unknown: { hidden: true } } })).toMatch(/not a home section/);
    expect(appearanceSettingsProblem({ ...valid(), sections: { hero: { image: { key: "../secret.jpg" } } } })).toMatch(/needs a media key/);
    expect(appearanceSettingsProblem({ ...valid(), sections: { hero: { image: { key: "home/hero.jpg" } } } })).toMatch(/needs a media key/);
  });

  it("writes section edits as flat theme settings and removes cleared ones", () => {
    const settings: AppearanceSettings = {
      ...valid(),
      logoAlignment: "center",
      sections: {
        hero: { hidden: true, image: { key: "products/hero.webp", width: 1200, height: 600 } },
        marquee: { hidden: false, image: null },
      },
    };
    expect(appearanceSettingsToTheme(settings)).toMatchObject({
      logoAlignment: "center",
      homeHeroHidden: true,
      homeHeroImage: { key: "products/hero.webp", width: 1200, height: 600 },
    });
    expect(appearanceSettingsToTheme(settings)).not.toHaveProperty("homeMarqueeHidden");
    expect(appearanceSettingsToRemove(settings)).toEqual(
      expect.arrayContaining(["hideHeroImages", "homeMarqueeHidden", "homeMarqueeImage"]),
    );
  });

  it("reads flat theme settings back, including the old grouped image switch", () => {
    const flat = {
      ...appearanceSettingsToTheme(valid()),
      homeImageBannerHidden: true,
      homeCustomerTestimonialsImage: { key: "reviews/quote.jpg" },
    };
    expect(appearanceThemeSettingsOf(flat)?.sections).toEqual({
      "image-banner": { hidden: true },
      "customer-testimonials": { image: { key: "reviews/quote.jpg" } },
    });
    expect(appearanceThemeSettingsOf({ ...flat, hideHeroImages: true })?.sections?.hero).toEqual({ hidden: true });
    expect(appearanceThemeSettingsOf({ ...flat, hideHeroImages: true, homeHeroHidden: false })?.sections?.hero).toBeUndefined();
  });

  it("validates scrolling text only on the marquee and sanitizes it before writing", () => {
    const settings: AppearanceSettings = {
      ...valid(),
      sections: {
        marquee: {
          text: '<script>alert(1)</script><img src="x" onerror="alert(2)"><strong>Free delivery</strong>',
          color: "#123456",
          accentColor: "#fedcba",
          backgroundColor: "#f2c14e",
        },
      },
    };
    expect(appearanceSettingsProblem(settings)).toBeNull();
    expect(appearanceSettingsToTheme(settings)).toMatchObject({
      homeMarqueeText: "<strong>Free delivery</strong>",
      homeMarqueeColor: "#123456",
      homeMarqueeAccentColor: "#fedcba",
      homeMarqueeBackgroundColor: "#f2c14e",
    });
    expect(appearanceSettingsToTheme(settings).homeMarqueeText).not.toContain("onerror");
    expect(appearanceSettingsProblem({ ...valid(), sections: { hero: { text: "not allowed" } } })).toMatch(
      /cannot hold scrolling text/,
    );
    expect(appearanceSettingsProblem({ ...valid(), sections: { marquee: { color: "gold" } } })).toMatch(
      /needs a hex color/,
    );
    expect(appearanceSettingsProblem({ ...valid(), sections: { marquee: { accentColor: "gold" } } })).toMatch(
      /sparkles need a hex color/,
    );
    expect(appearanceSettingsProblem({ ...valid(), sections: { marquee: { backgroundColor: "gold" } } })).toMatch(
      /backgroundColor needs a hex color/,
    );
    expect(
      appearanceSettingsProblem({ ...valid(), sections: { marquee: { text: "x".repeat(501) } } }),
    ).toMatch(/at most 500/);
  });

  it("reads and clears the scrolling-text override without disturbing other sections", () => {
    const stored = {
      ...appearanceSettingsToTheme(valid()),
      homeMarqueeText: "<strong>Free delivery</strong>",
      homeMarqueeColor: "#123456",
      homeMarqueeAccentColor: "#fedcba",
      homeMarqueeBackgroundColor: "#ffcc00",
    };
    expect(appearanceThemeSettingsOf(stored)?.sections?.marquee).toEqual({
      text: "<strong>Free delivery</strong>",
      color: "#123456",
      accentColor: "#fedcba",
      backgroundColor: "#ffcc00",
    });

    const current: AppearanceSettings = {
      ...valid(),
      sections: {
        hero: { hidden: true },
        marquee: { text: "Free delivery", color: "#abcdef", accentColor: "#fedcba", backgroundColor: "#ffcc00" },
      },
    };
    expect(
      mergeAppearance(current, { ...valid(), sections: { marquee: {} } }).settings?.sections?.marquee,
    ).toEqual({ text: "Free delivery", color: "#abcdef", accentColor: "#fedcba", backgroundColor: "#ffcc00" });
    const cleared = mergeAppearance(current, {
      ...valid(),
      sections: { marquee: { text: null, color: null, accentColor: null, backgroundColor: null } },
    });
    expect(cleared.settings?.sections?.marquee).toBeUndefined();
    expect(cleared.settings?.sections?.hero).toEqual({ hidden: true });
    expect(appearanceSettingsToRemove(cleared.settings!)).toEqual(
      expect.arrayContaining([
        "homeMarqueeText",
        "homeMarqueeColor",
        "homeMarqueeAccentColor",
        "homeMarqueeBackgroundColor",
      ]),
    );
  });
});

describe("contact and social links", () => {
  it("turns a phone, email and handles into safe links, and rejects anything else", () => {
    expect(appearanceContactHref("contactPhone", "+213 55 12 34 56")).toBe("tel:+21355123456");
    expect(appearanceContactHref("contactEmail", " hello@example.dz ")).toBe("mailto:hello@example.dz");
    expect(appearanceContactHref("instagramUrl", "@shop.dz")).toBe("https://instagram.com/shop.dz");
    expect(appearanceContactHref("facebookUrl", "https://www.facebook.com/shop.dz")).toBe("https://facebook.com/shop.dz");
    expect(appearanceContactHref("instagramUrl", "https://www.instagram.com/shop.dz/reels")).toBe("https://instagram.com/shop.dz/reels");
    expect(appearanceContactHref("tiktokUrl", "shop.dz")).toBe("https://tiktok.com/@shop.dz");
    expect(appearanceContactHref("contactPhone", "javascript:alert(1)")).toBe("");
    expect(appearanceContactHref("contactEmail", "not-an-email")).toBe("");
    expect(appearanceContactHref("instagramUrl", "https://evil.test/instagram.com/shop")).toBe("");
  });

  it("writes, reads and clears each link as a flat theme setting", () => {
    const current: AppearanceSettings = {
      ...valid(),
      contact: {
        contactPhone: "tel:+21355123456",
        contactEmail: "mailto:hello@example.dz",
        instagramUrl: "https://instagram.com/shop.dz",
      },
    };
    expect(appearanceSettingsProblem(current)).toBeNull();
    const flat = appearanceSettingsToTheme(current);
    expect(flat).toMatchObject({
      contactPhone: "tel:+21355123456",
      contactEmail: "mailto:hello@example.dz",
      instagramUrl: "https://instagram.com/shop.dz",
    });
    expect(appearanceThemeSettingsOf(flat)?.contact).toEqual(current.contact);

    const saved = mergeAppearance(current, {
      colorSchemes: current.colorSchemes,
      pageScheme: current.pageScheme,
      contact: { instagramUrl: "", tiktokUrl: "@shop.dz" },
    });
    expect(saved.settings?.contact).toEqual({
      contactPhone: "tel:+21355123456",
      contactEmail: "mailto:hello@example.dz",
      tiktokUrl: "https://tiktok.com/@shop.dz",
    });
    expect(appearanceSettingsToRemove(saved.settings!)).toContain("instagramUrl");
    expect(appearanceSettingsToRemove(saved.settings!)).not.toContain("contactPhone");
  });

  it("refuses unsafe links and unknown contact fields", () => {
    expect(appearanceSettingsProblem({ ...valid(), contact: { contactPhone: "javascript:alert(1)" } })).toMatch(
      /must be a phone number/,
    );
    expect(appearanceSettingsProblem({ ...valid(), contact: { instagramUrl: "https://facebook.com/shop" } })).toMatch(
      /must be a phone number/,
    );
    expect(appearanceSettingsProblem({ ...valid(), contact: { twitterUrl: "https://x.test" } })).toMatch(
      /not a contact link/,
    );
  });
});

describe("section and chrome colors", () => {
  it("writes each home section's three colors as flat theme keys and removes cleared ones", () => {
    const settings: AppearanceSettings = {
      ...valid(),
      sections: {
        hero: { color: "#112233", backgroundColor: "#f5f5f0", buttonColor: "#445566" },
        "category-cards": { buttonColor: "#abcdef" },
      },
    };
    expect(appearanceSettingsToTheme(settings)).toMatchObject({
      homeHeroTextColor: "#112233",
      homeHeroBackgroundColor: "#f5f5f0",
      homeHeroButtonColor: "#445566",
      homeCategoryCardsButtonColor: "#abcdef",
    });
    expect(appearanceSettingsToRemove(settings)).toEqual(
      expect.arrayContaining(["homeCategoryCardsTextColor", "homeCategoryCardsBackgroundColor"]),
    );
    expect(appearanceSettingsToRemove(settings)).not.toContain("homeHeroTextColor");
    expect(appearanceSettingsToRemove(settings)).not.toContain("homeHeroBackgroundColor");
    expect(appearanceSettingsToRemove(settings)).not.toContain("homeHeroButtonColor");
    expect(appearanceSettingsToRemove(settings)).not.toContain("homeCategoryCardsButtonColor");
  });

  it("writes the header groups' colors and reads them back, including the marquee button override", () => {
    const settings: AppearanceSettings = {
      ...valid(),
      chromeColors: {
        announcement: { color: "#111111", backgroundColor: "#eeeeee", buttonColor: "#222222" },
        header: { color: "#333333" },
        headerHtml: { buttonColor: "#444444" },
      },
      sections: { marquee: { buttonColor: "#556677" } },
    };
    expect(appearanceSettingsProblem(settings)).toBeNull();
    const flat = appearanceSettingsToTheme(settings);
    expect(flat).toMatchObject({
      announcementTextColor: "#111111",
      announcementBackgroundColor: "#eeeeee",
      announcementButtonColor: "#222222",
      headerTextColor: "#333333",
      headerHtmlButtonColor: "#444444",
      homeMarqueeButtonColor: "#556677",
    });
    const read = appearanceThemeSettingsOf(flat)!;
    expect(read.chromeColors).toEqual(settings.chromeColors);
    expect(read.sections?.marquee).toEqual({ buttonColor: "#556677" });
    expect(appearanceSettingsToRemove(settings)).toEqual(
      expect.arrayContaining([
        "headerBackgroundColor",
        "headerButtonColor",
        "headerHtmlTextColor",
        "headerHtmlBackgroundColor",
        "homeMarqueeColor",
      ]),
    );
    expect(appearanceSettingsToRemove(settings)).not.toContain("headerTextColor");
    expect(appearanceSettingsToRemove(settings)).not.toContain("homeMarqueeButtonColor");
  });

  it("refuses colors that are not hex and keys that are not header groups", () => {
    expect(appearanceSettingsProblem({ ...valid(), chromeColors: { footer: { color: "#123456" } } })).toMatch(
      /not a header color group/,
    );
    expect(
      appearanceSettingsProblem({ ...valid(), chromeColors: { header: { color: "gold" } } }),
    ).toMatch(/needs a hex color/);
    expect(appearanceSettingsProblem({ ...valid(), sections: { hero: { buttonColor: "red" } } })).toMatch(
      /buttonColor needs a hex color/,
    );
  });

  it("merges cleared colors back to auto without losing the other controls", () => {
    const current: AppearanceSettings = {
      ...valid(),
      hideLogo: true,
      chromeColors: { header: { color: "#333333", buttonColor: "#444444" } },
      sections: { hero: { color: "#112233" } },
    };
    const next = { ...valid(), chromeColors: { header: { color: null } }, sections: { hero: { color: null } } };
    delete next.hideLogo;
    const merged = mergeAppearance(current, next);
    expect(merged.settings?.chromeColors).toEqual({ header: { buttonColor: "#444444" } });
    expect(merged.settings?.sections?.hero).toBeUndefined();
    expect(merged.settings?.hideLogo).toBe(true);
  });
});

describe("detail colors", () => {
  it("accepts only the four known colors as hex or auto", () => {
    expect(appearanceDetailColorsProblem(undefined)).toBeNull();
    expect(
      appearanceDetailColorsProblem({
        secondaryButton: "#123456",
        offer: null,
        oldPrice: "#abcdef",
        newPrice: "#fedcba",
      }),
    ).toBeNull();
    expect(appearanceDetailColorsProblem({ glow: "#ffffff" })).toMatch(/not a detail color/);
    expect(appearanceDetailColorsProblem({ offer: "gold" })).toMatch(/needs a hex color/);
  });

  it("writes flat theme keys and removes them when returned to auto", () => {
    const settings: AppearanceSettings = {
      ...valid(),
      detailColors: { secondaryButton: "#123456", offer: "#abcdef", oldPrice: null, newPrice: "#fedcba" },
    };
    expect(appearanceSettingsToTheme(settings)).toMatchObject({
      secondaryButtonColor: "#123456",
      offerColor: "#abcdef",
      priceNewColor: "#fedcba",
    });
    expect(appearanceSettingsToTheme(settings)).not.toHaveProperty("priceOldColor");
    expect(appearanceSettingsToRemove(settings)).toEqual(
      expect.arrayContaining(["priceOldColor"]),
    );
    expect(appearanceSettingsToRemove(settings)).not.toContain("secondaryButtonColor");
  });

  it("reads saved colors from the flat keys and prefers an explicit nested reset", () => {
    const saved = appearanceThemeSettingsOf({
      ...appearanceSettingsToTheme(valid()),
      secondaryButtonColor: "#123456",
      priceOldColor: "#abcdef",
    });
    expect(saved?.detailColors).toEqual({ secondaryButton: "#123456", oldPrice: "#abcdef" });
    expect(appearanceThemeSettingsOf({ ...valid(), detailColors: { offer: null } })?.detailColors).toEqual({ offer: null });
  });

  it("prefers flat colors over a stale nested object and removes legacy color keys", () => {
    const read = appearanceThemeSettingsOf({
      ...appearanceSettingsToTheme(valid()),
      detailColors: { offer: "#111111" },
      priceColors: { oldPrice: "#222222" },
      primaryColor: "#333333",
      secondaryButtonColor: "#abcdef",
    });
    expect(read?.detailColors).toEqual({ secondaryButton: "#abcdef" });
    expect(appearanceSettingsToRemove(valid())).toEqual(
      expect.arrayContaining(["detailColors", "priceColors", "primaryColor"]),
    );
  });

  it("keeps picked colors when only a header control is saved", () => {
    const current: AppearanceSettings = { ...valid(), detailColors: { offer: "#abcdef" }, hideHeaderText: true, hideMenu: true };
    const merged = mergeAppearance(current, { colorSchemes: current.colorSchemes, pageScheme: "scheme-1", hideLogo: true });
    expect(merged.settings).toMatchObject({ detailColors: { offer: "#abcdef" }, hideHeaderText: true, hideMenu: true, hideLogo: true });
  });
});

describe("sanitizeHeaderHtml", () => {
  it("keeps a short, safe strip and drops scripts, handlers and unknown tags", () => {
    expect(sanitizeHeaderHtml('<strong class="promo">Sale</strong> <a href="/products" target="_blank">Shop</a><br /><img src="x" onerror="evil()" />'))
      .toBe('<strong class="promo">Sale</strong> <a href="/products" target="_blank" rel="noopener noreferrer">Shop</a><br />&lt;img src=&quot;x&quot; onerror=&quot;evil()&quot; /&gt;');
  });

  it("drops unsafe link targets", () => {
    expect(sanitizeHeaderHtml('<a href="javascript:evil()" onclick="evil()">x</a>')).toBe("<a>x</a>");
    expect(sanitizeHeaderHtml('<a href="https://example.com">x</a>')).toBe('<a href="https://example.com">x</a>');
  });

  it("escapes plain text", () => {
    expect(sanitizeHeaderHtml("A & B < C")).toBe("A &amp; B &lt; C");
  });
});
