// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("astro:env/client", () => ({ PUBLIC_API_URL: "https://api.test" }));

const seam = vi.hoisted(() => ({
  appearance: null as null | Record<string, any>,
  calls: [] as Array<Record<string, any>>,
}));

vi.mock("@/features/settings/api", () => ({
  getAppearance: async () => seam.appearance,
  saveAppearance: async (payload: Record<string, any>) => {
    seam.calls.push(payload);
    seam.appearance = { ...seam.appearance!, ...payload };
    return seam.appearance;
  },
}));
vi.mock("@/i18n/react", () => ({
  useT: () => (key: string) => key,
  useLocale: () => "en",
}));
vi.mock("@/features/uploads/api", () => ({
  IMAGE_ACCEPT: "image/*",
  MAX_UPLOAD_MB: 10,
  partitionUploadFiles: (files: File[]) => ({ accepted: files, unsupportedCount: 0, tooLargeCount: 0 }),
  uploadFailure: () => "upload_failed",
}));
vi.mock("@/features/uploads/useImageUpload", () => ({ useImageUpload: () => ({ upload: vi.fn(), progress: null }) }));
vi.mock("@/lib/notify", () => ({ notify: { success: vi.fn(), error: vi.fn() } }));

import { APPEARANCE_DEFAULT_SCHEMES } from "../../../../../cod-shared/stores/appearance";
import { AppearanceSettings, autoDetailSwatch } from "./AppearanceSettings";

const appearance = () => ({
  themeKey: "theme-00",
  primaryLocale: "en",
  locales: ["en"],
  colorSchemes: JSON.parse(JSON.stringify(APPEARANCE_DEFAULT_SCHEMES)),
  pageScheme: "scheme-1",
  hideLogo: false,
  hideHeaderText: false,
  hideMenu: false,
  searchEnabled: true,
  headerHtml: "",
  logoAlignment: "right",
  detailColors: {},
  texts: {},
});

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  seam.appearance = appearance();
  seam.calls = [];
  host = document.createElement("div");
  document.body.appendChild(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

async function render() {
  await act(async () => {
    root = createRoot(host);
    root.render(<AppearanceSettings />);
  });
}

async function setValue(
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  value: string,
  event: string,
) {
  const prototype =
    element instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(new Event(event, { bubbles: true }));
  });
}

function section(title: string): HTMLElement {
  const found = [...host.querySelectorAll("section")].find((node) => node.textContent?.includes(title));
  if (!found) throw new Error(`No section for ${title}`);
  return found;
}

function saveButton(card: HTMLElement): HTMLButtonElement {
  const found = [...card.querySelectorAll("button")].find((node) => node.textContent === "store.save");
  if (!found) throw new Error("No save button");
  return found as HTMLButtonElement;
}

async function click(element: HTMLElement) {
  await act(async () => element.click());
}

describe("AppearanceSettings", () => {
  it("saves only colors so a color change cannot clear texts or storefront controls", async () => {
    await render();
    const background = host.querySelectorAll<HTMLInputElement>('input[aria-label$=" hex"]')[0]!;
    await setValue(background, "#123456", "input");
    await act(async () => background.dispatchEvent(new FocusEvent("blur", { bubbles: true })));

    await click(saveButton(section("store.appearance_colors_title")));

    expect(seam.calls).toHaveLength(1);
    expect(Object.keys(seam.calls[0]!).sort()).toEqual(["colorSchemes", "detailColors", "pageScheme"]);
    expect(seam.calls[0]!.colorSchemes[0].colors.background).toBe("#123456");
    expect(host.querySelectorAll<HTMLInputElement>('input[aria-label$=" hex"]')[0]!.value).toBe("#123456");
  });

  it("saves a picked detail color with the scheme colors", async () => {
    await render();
    const offer = host.querySelector<HTMLInputElement>('input[aria-label="store.appearance_color_offer hex"]')!;
    await setValue(offer, "#abcdef", "input");
    await act(async () => offer.dispatchEvent(new FocusEvent("blur", { bubbles: true })));

    await click(saveButton(section("store.appearance_colors_title")));

    expect(seam.calls[0]!.detailColors.offer).toBe("#abcdef");
    expect(seam.calls[0]!.colorSchemes).toBeDefined();
  });

  it("accepts a hex typed without the hash when the field loses focus", async () => {
    await render();
    const background = host.querySelectorAll<HTMLInputElement>('input[aria-label$=" hex"]')[0]!;
    await setValue(background, "123456", "input");
    await act(async () => background.dispatchEvent(new FocusEvent("blur", { bubbles: true })));
    await click(saveButton(section("store.appearance_colors_title")));

    expect(seam.calls[0]!.colorSchemes[0].colors.background).toBe("#123456");
    expect(background.value).toBe("#123456");
  });

  it("saves an Auto scheme role as null while showing the color its scheme supplies", async () => {
    await render();
    const auto = [...host.querySelectorAll<HTMLButtonElement>("button")].find((node) =>
      node.getAttribute("aria-label")?.startsWith("store.appearance_color_background store.appearance_color_auto"),
    )!;
    await click(auto);

    const input = host.querySelector<HTMLInputElement>('input[aria-label="store.appearance_color_background hex"]')!;
    expect(input.value).toBe("#ffffff");
    expect(auto.disabled).toBe(true);

    await click(saveButton(section("store.appearance_colors_title")));
    expect(seam.calls[0]!.colorSchemes[0].colors.background).toBeNull();
  });

  it("keeps Auto on the scheme it follows when the store opens on another palette", async () => {
    const schemes = JSON.parse(JSON.stringify(APPEARANCE_DEFAULT_SCHEMES));
    schemes.find((scheme: { id: string }) => scheme.id === "scheme-6").colors.accent = null;
    seam.appearance = { ...appearance(), colorSchemes: schemes, pageScheme: "scheme-6" };
    await render();

    const olive = [...host.querySelectorAll("button")].find(
      (node) => node.hasAttribute("aria-pressed") && node.textContent?.includes("Olive"),
    )!;
    await click(olive);
    const accent = host.querySelector<HTMLInputElement>('input[aria-label="store.appearance_color_accent hex"]')!;
    expect(accent.value).toBe("#66763b");

    await click(saveButton(section("store.appearance_colors_title")));
    expect(seam.calls[0]!.colorSchemes.find((scheme: { id: string }) => scheme.id === "scheme-6").colors.accent).toBeNull();
  });

  it("opens on the palette the live sections wear, not only the page", async () => {
    seam.appearance = { ...appearance(), pageScheme: "scheme-6" };
    await render();
    const light = Array.from(host.querySelectorAll("button")).find(
      (node) => node.getAttribute("aria-pressed") === "true" && node.textContent?.includes("Light"),
    );
    expect(light).toBeTruthy();
    expect(host.querySelectorAll<HTMLInputElement>('input[aria-label$=" hex"]')[0]!.value).toBe("#ffffff");
  });

  it("saves storefront controls on their own", async () => {
    await render();
    const logoSelect = (Array.from(host.querySelectorAll("select")) as HTMLSelectElement[]).find((node) =>
      Array.from(node.options).some((option) => option.value === "left"),
    )!;
    await setValue(logoSelect, "left", "change");

    await click(saveButton(section("store.appearance_storefront_title")));

    expect(seam.calls).toHaveLength(1);
    expect(seam.calls[0]!.logoAlignment).toBe("left");
    expect(seam.calls[0]!.colorSchemes).toBeUndefined();
    expect(seam.calls[0]!.texts).toBeUndefined();
  });

  it("saves the hide-header-text switch without touching colors or texts", async () => {
    await render();
    const toggle = [...host.querySelectorAll<HTMLButtonElement>('[role="switch"]')].find((node) =>
      node.parentElement?.textContent?.includes("store.appearance_control_hideHeaderText"),
    )!;
    await click(toggle);

    await click(saveButton(section("store.appearance_storefront_title")));

    expect(seam.calls[0]!.hideHeaderText).toBe(true);
    expect(seam.calls[0]!.colorSchemes).toBeUndefined();
    expect(seam.calls[0]!.texts).toBeUndefined();
  });

  it("saves text edits without touching colors or storefront controls", async () => {
    await render();
    const label = [...host.querySelectorAll("label")].find((node) =>
      node.textContent?.includes("store.appearance_text_heroTitle"),
    )!;
    const title = label.querySelector("input")!;
    await setValue(title, "New title", "input");

    await click(saveButton(section("store.appearance_texts_title")));

    expect(seam.calls).toHaveLength(1);
    expect(Object.keys(seam.calls[0]!)).toEqual(["texts"]);
    expect(seam.calls[0]!.texts.values.heroTitle).toBe("New title");
    expect(seam.calls[0]!.colorSchemes).toBeUndefined();
    expect(seam.calls[0]!.logoAlignment).toBeUndefined();
  });

  it("restores a quick look's original colors instead of keeping old edits", async () => {
    const schemes = JSON.parse(JSON.stringify(APPEARANCE_DEFAULT_SCHEMES));
    const olive = schemes.find((scheme: { id: string }) => scheme.id === "scheme-6");
    olive.colors.background = "#123456";
    olive.colors.button = "#654321";
    seam.appearance = { ...appearance(), colorSchemes: schemes, pageScheme: "scheme-6" };
    await render();

    const look = [...host.querySelectorAll("button")].find((node) =>
      node.textContent?.includes("store.appearance_look_olive"),
    )!;
    await click(look);
    const background = host.querySelectorAll<HTMLInputElement>('input[aria-label$=" hex"]')[0]!;
    await setValue(background, "#abcdef", "input");
    await act(async () => background.dispatchEvent(new FocusEvent("blur", { bubbles: true })));
    await click(saveButton(section("store.appearance_colors_title")));

    expect(seam.calls[0]!.pageScheme).toBe("scheme-6");
    const oliveColors = APPEARANCE_DEFAULT_SCHEMES.find((scheme) => scheme.id === "scheme-6")!.colors;
    expect(seam.calls[0]!.colorSchemes.find((scheme: { id: string }) => scheme.id === "scheme-1").colors).toEqual({
      ...oliveColors,
      background: "#abcdef",
    });
    expect(seam.calls[0]!.colorSchemes.find((scheme: { id: string }) => scheme.id === "scheme-6").colors).toEqual(
      oliveColors,
    );
  });

  it("resets every palette and detail color when Original is chosen", async () => {
    const schemes = JSON.parse(JSON.stringify(APPEARANCE_DEFAULT_SCHEMES));
    schemes[1].colors.background = "#123456";
    seam.appearance = {
      ...appearance(),
      colorSchemes: schemes,
      pageScheme: "scheme-2",
      detailColors: { offer: "#abcdef" },
    };
    await render();

    const original = [...host.querySelectorAll("button")].find((node) =>
      node.textContent?.includes("store.appearance_look_original"),
    )!;
    await click(original);
    await click(saveButton(section("store.appearance_colors_title")));

    expect(seam.calls[0]!.pageScheme).toBe("scheme-1");
    expect(seam.calls[0]!.colorSchemes).toEqual(APPEARANCE_DEFAULT_SCHEMES);
    expect(seam.calls[0]!.detailColors).toEqual({});
  });

  it("saves scrolling text and color, then returns the color to Auto", async () => {
    await render();
    const card = section("store.appearance_sections_title");
    const textarea = card.querySelector("textarea")!;
    await setValue(textarea, "<strong>Free delivery</strong>", "input");
    const color = card.querySelector<HTMLInputElement>(
      'input[aria-label="store.appearance_section_marquee_color hex"]',
    )!;
    await setValue(color, "#123456", "input");
    await act(async () => color.dispatchEvent(new FocusEvent("blur", { bubbles: true })));

    await click(saveButton(card));
    expect(Object.keys(seam.calls[0]!)).toEqual(["sections"]);
    expect(seam.calls[0]!.sections.marquee.text).toBe("<strong>Free delivery</strong>");
    expect(seam.calls[0]!.sections.marquee.color).toBe("#123456");

    const auto = [...card.querySelectorAll<HTMLButtonElement>("button")].find((node) =>
      node.getAttribute("aria-label")?.includes("store.appearance_section_marquee_color"),
    )!;
    await click(auto);
    await click(saveButton(card));
    expect(seam.calls[1]!.sections.marquee.color).toBeNull();
  });

  it("saves the hide-menu switch without touching colors or texts", async () => {
    await render();
    const toggle = [...host.querySelectorAll<HTMLButtonElement>('[role="switch"]')].find((node) =>
      node.parentElement?.textContent?.includes("store.appearance_control_hideMenu"),
    )!;
    await click(toggle);

    await click(saveButton(section("store.appearance_storefront_title")));

    expect(seam.calls[0]!.hideMenu).toBe(true);
    expect(seam.calls[0]!.colorSchemes).toBeUndefined();
    expect(seam.calls[0]!.texts).toBeUndefined();
  });

  it("saves section hiding on its own and uploads pictures only where sections use them", async () => {
    await render();
    const card = section("store.appearance_sections_title");
    const uploads = [...card.querySelectorAll("button")].filter(
      (node) => node.textContent === "store.appearance_section_upload",
    );
    expect(uploads).toHaveLength(2);

    const toggleFor = (label: string) =>
      [...card.querySelectorAll<HTMLButtonElement>('[role="switch"]')].find((node) =>
        node.parentElement?.textContent?.includes(label),
      )!;
    await click(toggleFor("store.appearance_section_category-cards"));
    await click(toggleFor("store.appearance_section_marquee"));
    await click(saveButton(card));

    expect(seam.calls).toHaveLength(1);
    expect(Object.keys(seam.calls[0]!)).toEqual(["sections"]);
    expect(seam.calls[0]!.sections["category-cards"].hidden).toBe(true);
    expect(seam.calls[0]!.sections.marquee.hidden).toBe(true);
    expect(seam.calls[0]!.sections["image-banner"].hidden).toBe(false);
  });

  it("uses the storefront's muted fallback for an auto old price", () => {
    expect(autoDetailSwatch("oldPrice", APPEARANCE_DEFAULT_SCHEMES[0])).toBe(
      "color-mix(in oklab, #3b4250 74%, #ffffff)",
    );
  });
});
