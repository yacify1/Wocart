/**
 * The dashboard's per-section home controls, as the theme reads them. The
 * settings are written flat by the server (`homeHeroHidden`, `homeHeroImage`,
 * …) and declared in `settings.ts`; this module names them once and turns a
 * section's type into the state the renderer needs. A stored value the SDK
 * rejected simply never reaches here, so the shipped section stands.
 */
import type { StoreContext } from "./store";
import { settingsOf } from "./settings";
import { pickedPicture } from "@/theme/utils/images";
import type { PickedImage, Picture } from "@wocart/storefront";

export const HOME_SECTION_TYPES = [
  "hero",
  "marquee",
  "category-cards",
  "product-tabs",
  "image-banner",
  "how-it-works",
  "customer-testimonials",
  "features-bar",
] as const;

export type HomeSectionType = (typeof HOME_SECTION_TYPES)[number];

const CAMEL: Record<HomeSectionType, string> = {
  hero: "Hero",
  marquee: "Marquee",
  "category-cards": "CategoryCards",
  "product-tabs": "ProductTabs",
  "image-banner": "ImageBanner",
  "how-it-works": "HowItWorks",
  "customer-testimonials": "CustomerTestimonials",
  "features-bar": "FeaturesBar",
};

export const hiddenSettingKey = (type: HomeSectionType): string => `home${CAMEL[type]}Hidden`;
export const imageSettingKey = (type: HomeSectionType): string => `home${CAMEL[type]}Image`;

/** Only these two sections draw their picked photo themselves; the rest wear it as a backdrop. */
export const NATIVE_IMAGE_SECTIONS = new Set<HomeSectionType>(["hero", "image-banner"]);

export function homeSectionTypeOf(type: string): HomeSectionType | null {
  return (HOME_SECTION_TYPES as readonly string[]).includes(type) ? (type as HomeSectionType) : null;
}

export type HomeSectionState = {
  hidden: boolean;
  image: Picture | null;
  picked: PickedImage | null;
};

export type MarqueeSettings = { text: string | null; color: string | null; accentColor: string | null };

const MARQUEE_TAGS = new Set(["a", "b", "strong", "i", "em", "u", "small", "span", "br"]);
const MARQUEE_DISCARDED =
  /<(script|style|iframe|object|embed|svg|template)\b[^>]*>[\s\S]*?<\/\1\s*>|<!--[\s\S]*?-->/gi;
const MARQUEE_TAG = /<\/?([a-z][a-z0-9]*)\b([^>]*)>/gi;
const MARQUEE_ATTR = /([a-z][a-z0-9-]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;
const MARQUEE_HREF = /^(https?:\/\/|\/|#|\?|mailto:|tel:)/i;
const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

function safeMarqueeHtml(value: string): string {
  const source = value.replace(MARQUEE_DISCARDED, "");
  let output = "";
  let last = 0;
  for (const match of source.matchAll(MARQUEE_TAG)) {
    const start = match.index ?? 0;
    output += escapeHtml(source.slice(last, start));
    last = start + match[0].length;
    const tag = match[1]!.toLowerCase();
    if (!MARQUEE_TAGS.has(tag)) continue;
    if (match[0].startsWith("</")) {
      output += `</${tag}>`;
      continue;
    }
    const attributes: string[] = [];
    for (const attribute of (match[2] ?? "").matchAll(MARQUEE_ATTR)) {
      const name = attribute[1]!.toLowerCase();
      const raw = attribute[3] ?? attribute[4] ?? attribute[5] ?? "";
      if (name === "class") {
        const className = raw.replace(/[^A-Za-z0-9 _-]/g, "").trim().slice(0, 120);
        if (className) attributes.push(`class="${escapeHtml(className)}"`);
      } else if (tag === "a" && name === "href" && MARQUEE_HREF.test(raw.trim())) {
        attributes.push(`href="${escapeHtml(raw.trim())}"`);
      } else if (tag === "a" && name === "target" && raw.trim() === "_blank") {
        attributes.push('target="_blank"', 'rel="noopener noreferrer"');
      }
    }
    output += `<${tag}${attributes.length ? ` ${attributes.join(" ")}` : ""}>`;
  }
  return output + escapeHtml(source.slice(last));
}

/** The Appearance tab's scrolling-text override; absent values keep the shipped band. */
export function marqueeSettingsOf(store: StoreContext): MarqueeSettings {
  const values = settingsOf(store) as unknown as Record<string, unknown>;
  const text = values.homeMarqueeText;
  const color = values.homeMarqueeColor;
  const accentColor = values.homeMarqueeAccentColor;
  const safeText = typeof text === "string" ? safeMarqueeHtml(text).trim() : "";
  const hex = (value: unknown) =>
    typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : null;
  return {
    text: safeText || null,
    color: hex(color),
    accentColor: hex(accentColor),
  };
}

/** One home section's visibility and photo, for the page and the section components alike. */
export function homeSectionStateOf(store: StoreContext, type: string): HomeSectionState {
  const key = homeSectionTypeOf(type);
  if (!key) return { hidden: false, image: null, picked: null };
  const values = settingsOf(store) as unknown as Record<string, unknown>;
  const stored = (store.config.themeSettings ?? {}) as Record<string, unknown>;
  const hiddenKey = hiddenSettingKey(key);
  const legacy =
    (key === "hero" || key === "image-banner") &&
    stored.hideHeroImages === true &&
    !Object.prototype.hasOwnProperty.call(stored, hiddenKey);
  const hidden = values[hiddenKey] === true || legacy;
  const picked = (values[imageSettingKey(key)] as PickedImage | undefined) ?? null;
  return { hidden, image: pickedPicture(picked, store.config.media), picked };
}
