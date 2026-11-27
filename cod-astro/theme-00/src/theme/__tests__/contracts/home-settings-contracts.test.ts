// @vitest-environment node
/// <reference types="vitest/globals" />
/**
 * The home settings an editor can change, proven through the real renderer:
 * a saved value takes effect, an absent one keeps the shipped behavior, and a
 * hostile value never reaches the markup.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { Category, ProductList } from "@wocart/storefront";
import type { RendererIssue } from "@wocart/theme/astro";
import type { ComponentInstance } from "@wocart/theme";
import { en } from "@/theme/content/en";
import { fakeStorefront, makeProduct, renderSections } from "../support/home-render";

const products = Array.from({ length: 6 }, (_, index) =>
  makeProduct({
    id: `prod_${index}`,
    name: `Product ${index}`,
    handle: `product-${index}`,
    coverImage: {
      key: `products/p${index}.jpg`,
      url: `https://media.boutique.test/products/p${index}.jpg`,
      width: 600,
      height: 600,
      altText: `Photo ${index}`,
    } as ProductList["coverImage"],
  }),
);
const categories = Array.from(
  { length: 6 },
  (_, index) =>
    ({ id: `cat_${index}`, name: `Category ${index}`, slug: `category-${index}`, position: index, image: null }) as unknown as Category,
);
const storefront = fakeStorefront(products, categories);

const countOf = (html: string, text: string) => html.split(text).length - 1;

describe("hero and promo links", () => {
  it("keep the shipped targets when nothing is saved", async () => {
    const html = await renderSections(
      [
        { id: "h", type: "hero" },
        { id: "w", type: "whatsapp-cta" },
      ],
      storefront,
    );
    expect(html).toContain('href="/products"');
    expect(html).toContain('href="#best-sellers"');
  });

  it("use the saved targets", async () => {
    const html = await renderSections(
      [
        { id: "h", type: "hero", props: { ctaPrimaryHref: "/lp/summer", ctaSecondaryHref: "/category/chairs" } },
        { id: "w", type: "whatsapp-cta", props: { ctaHref: "https://wa.me/213555000000" } },
      ],
      storefront,
    );
    expect(html).toContain('href="/lp/summer"');
    expect(html).toContain('href="/category/chairs"');
    expect(html).toContain('href="https://wa.me/213555000000"');
  });

  it.each(["javascript:alert(1)", "//evil.example", "data:text/html,x"])(
    "never render the hostile link %j, and report it",
    async (href) => {
      const issues: RendererIssue[] = [];
      const html = await renderSections(
        [{ id: "h", type: "hero", props: { ctaPrimaryHref: href } }],
        storefront,
        { onIssue: (issue) => issues.push(issue) },
      );
      expect(html).not.toContain(href);
      expect(html).toContain('href="/products"');
      expect(issues).toEqual([
        expect.objectContaining({ code: "invalid-prop", path: "props.ctaPrimaryHref" }),
      ]);
    },
  );
});

describe("per-section visibility and photos", () => {
  const sections: ComponentInstance[] = [
    { id: "h", type: "hero" },
    { id: "b", type: "image-banner" },
  ];

  it("show by default and disappear only where the store hides them", async () => {
    const shown = await renderSections(sections, storefront);
    expect(shown).toContain("hero-grid no-photo");
    expect(shown).not.toContain("hero-photo");
    expect(shown).toContain("banner-photo");

    const heroHidden = await renderSections(sections, storefront, { themeSettings: { homeHeroHidden: true } });
    expect(heroHidden).not.toMatch(/class="hero-grid/);
    expect(heroHidden).not.toContain(en.heroTitle);
    expect(heroHidden).not.toContain(en.heroCtaPrimary);
    expect(heroHidden).toContain("banner-photo");

    const bannerHidden = await renderSections(sections, storefront, { themeSettings: { homeImageBannerHidden: true } });
    expect(bannerHidden).toContain("hero-grid no-photo");
    expect(bannerHidden).not.toContain("banner-photo");
  });

  it("leaves the hero without a photo after a clear, even with products", async () => {
    const html = await renderSections([{ id: "h", type: "hero" }], storefront);
    expect(html).toContain("hero-grid no-photo");
    expect(html).not.toContain("<img");
    expect(html).toContain(en.heroTitle);
  });

  it("uses each section's own photo instead of the first product", async () => {
    const html = await renderSections(sections, storefront, {
      themeSettings: {
        homeHeroImage: { key: "products/hero.webp", alt: "Own hero" },
        homeImageBannerImage: { key: "landing/promo.webp", alt: "Own promo" },
      },
    });
    expect(html).toContain('alt="Own hero"');
    expect(html).toContain('alt="Own promo"');
    expect(html).toContain("hero-grid has-photo");
    expect(html).not.toContain("Photo 0");
  });

  it("keeps the old grouped switch until a save clears it", async () => {
    const legacy = await renderSections(sections, storefront, { themeSettings: { hideHeroImages: true } });
    expect(legacy).not.toMatch(/class="hero-grid/);
    expect(legacy).not.toContain("banner-photo");

    const superseded = await renderSections(sections, storefront, {
      themeSettings: { hideHeroImages: true, homeHeroHidden: false },
    });
    expect(superseded).toContain("hero-grid no-photo");
    expect(superseded).not.toContain("banner-photo");
  });

  it("centers a hero without a photo instead of keeping the two-column gutter", () => {
    const source = readFileSync(resolve(process.cwd(), "src/theme/components/home/Hero.astro"), "utf8");
    const desktop = source.slice(source.indexOf("@media (min-width: 1024px)"));
    expect(desktop).toContain(".hero-grid.has-photo { grid-template-columns: 1fr 1fr;");
    expect(desktop).toContain(".has-photo .hero-copy { padding-inline:");
    expect(desktop).toContain(".has-photo.photo-start .hero-copy { padding-inline:");
    expect(desktop).toMatch(/\.no-photo \.hero-copy \{[^}]*margin-inline: auto;/);
    expect(desktop).toMatch(/\.no-photo \.hero-copy \{[^}]*padding-inline: 1\.5rem;/);
  });
});

describe("scrolling text controls", () => {
  const marquee = [{ id: "m", type: "marquee" }] as ComponentInstance[];

  it("uses the saved text, color and second color instead of the theme's messages", async () => {
    const html = await renderSections(marquee, storefront, {
      themeSettings: {
        homeMarqueeText: "<strong>Free delivery</strong>",
        homeMarqueeColor: "#123456",
        homeMarqueeAccentColor: "#fedcba",
      },
    });
    expect(html).toContain("<strong>Free delivery</strong>");
    expect(html).toContain("color: #123456");
    expect(html).toContain("--marquee-sparkle: #fedcba");
    const source = readFileSync(resolve(process.cwd(), "src/theme/components/home/Marquee.astro"), "utf8");
    expect(source).toContain("var(--marquee-sparkle, var(--clr-highlight))");
    expect(html).toContain("Free delivery");
  });

  it("keeps the shipped messages and theme color when nothing is saved", async () => {
    const html = await renderSections(marquee, storefront);
    expect(html).toContain(en.trust1Title);
    expect(html).not.toContain("color: #");
  });

  it("drops scripts and unsafe attributes before writing saved HTML into the band", async () => {
    const html = await renderSections(marquee, storefront, {
      themeSettings: {
        homeMarqueeText:
          '<script>alert(1)</script><img src="x" onerror="alert(2)"><strong>Safe</strong> <a href="javascript:alert(3)">bad</a> <a href="https://example.test">good</a>',
      },
    });
    expect(html).toContain("<strong>Safe</strong>");
    expect(html).toContain('<a href="https://example.test">good</a>');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("javascript:");
  });
});

describe("section titles", () => {
  it("best sellers and new arrivals show the saved title, else the pack's", async () => {
    const edited = await renderSections(
      [
        { id: "b", type: "best-sellers", props: { bestSellersSection: "Our picks" } },
        { id: "n", type: "new-arrivals", props: { newArrivalsSection: "Just in" } },
      ],
      storefront,
    );
    expect(edited).toContain("Our picks");
    expect(edited).toContain("Just in");
    expect(edited).not.toContain(en.bestSellersSection);

    const shipped = await renderSections([{ id: "b", type: "best-sellers" }], storefront);
    expect(shipped).toContain(en.bestSellersSection);
  });
});

describe("how many items a section shows", () => {
  it("best sellers shows 8 by default and the saved limit otherwise", async () => {
    const shipped = await renderSections([{ id: "b", type: "best-sellers" }], storefront);
    expect(products.slice(0, 5).every((p) => shipped.includes(p.name))).toBe(true);

    const limited = await renderSections(
      [{ id: "b", type: "best-sellers", props: { limit: 2 } }],
      storefront,
    );
    expect(["Product 0", "Product 1"].every((name) => limited.includes(name))).toBe(true);
    expect(limited).not.toContain("Product 2");
  });

  it("category cards shows 4 by default and the saved limit otherwise", async () => {
    const shipped = await renderSections([{ id: "c", type: "category-cards" }], storefront);
    expect(countOf(shipped, 'href="/category/')).toBe(4);
    expect(shipped).toContain("--tiles: 5");

    const limited = await renderSections(
      [{ id: "c", type: "category-cards", props: { limit: 2 } }],
      storefront,
    );
    expect(countOf(limited, 'href="/category/')).toBe(2);
    expect(limited).toContain("--tiles: 3");
  });

  it("an out-of-range limit is reported and the default applies", async () => {
    const issues: RendererIssue[] = [];
    const html = await renderSections(
      [{ id: "c", type: "category-cards", props: { limit: 500 } }],
      storefront,
      { onIssue: (issue) => issues.push(issue) },
    );
    expect(countOf(html, 'href="/category/')).toBe(4);
    expect(issues).toEqual([expect.objectContaining({ code: "invalid-prop", path: "props.limit" })]);
  });
});

describe("category photos", () => {
  const categoryWith = (width: number | null, height: number | null): Category =>
    ({
      id: "cat_icon",
      name: "Icon category",
      slug: "icon-category",
      position: 0,
      image: {
        key: "products/icon.webp",
        url: "https://media.boutique.test/products/icon.webp",
        width,
        height,
        altText: "Icon photo",
      },
    }) as unknown as Category;

  const renderCategory = (width: number | null, height: number | null) =>
    renderSections([{ id: "c", type: "category-cards" }], fakeStorefront([], [categoryWith(width, height)]));

  it("keeps a 48×48 WebP icon at its natural size in a contained tile", async () => {
    const html = await renderCategory(48, 48);
    const photo = /<img[^>]*data-category-photo[^>]*>/.exec(html)?.[0];
    expect(html).toContain("is-icon");
    expect(photo).toContain('width="48"');
    expect(photo).toContain('height="48"');
    expect(photo).not.toContain('data-category-icon="auto"');
    expect(html).not.toContain("18vw, 62vw");
  });

  it("keeps a photo whose size the catalog does not know in its own shape", async () => {
    const html = await renderCategory(null, null);
    const photo = /<img[^>]*data-category-photo[^>]*>/.exec(html)?.[0];
    expect(photo).toContain("/cdn-cgi/image/");
    expect(photo).toContain("fit=scale-down");
    expect(photo).toContain("18vw, 62vw");
    expect(photo).toContain('data-category-icon="auto"');
    expect(photo).not.toContain('width="600"');
    expect(photo).not.toContain("fit=cover");
  });

  it("fills the tile with a photo that is not an icon", async () => {
    const html = await renderCategory(600, 750);
    const photo = /<img[^>]*data-category-photo[^>]*>/.exec(html)?.[0];
    expect(html).not.toContain("is-icon");
    expect(photo).toContain('width="600"');
    expect(photo).toContain('height="750"');
    expect(photo).not.toContain('data-category-icon="auto"');
    expect(html).toContain("18vw, 62vw");
  });

  it("caps a short row so its tiles stay proportional instead of filling the frame", () => {
    const source = readFileSync(resolve(process.cwd(), "src/theme/components/home/CategoryCards.astro"), "utf8");
    expect(source).toContain("--tile-max: 16rem;");
    expect(source).toContain(".category-tiles > li { width: 100%; max-width: var(--tile-max); justify-self: center; }");
    expect(source).toContain(
      "width: min(100%, calc(var(--tiles) * var(--tile-max) + (var(--tiles) - 1) * var(--tile-gap)));",
    );
  });
});
