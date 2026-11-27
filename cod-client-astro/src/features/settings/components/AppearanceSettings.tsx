import { useEffect, useRef, useState } from "react";
import { Check, Layers3, Loader2, Palette, SlidersHorizontal, Type } from "lucide-react";
import { Alert, Badge, Field, Input, Select, SwitchField, Textarea } from "@/components/ui";
import { useLocale, useT } from "@/i18n/react";
import { notify } from "@/lib/notify";
import { getAppearance, saveAppearance, type SaveAppearanceInput } from "@/features/settings/api";
import { SettingsSection, FieldRow } from "@/features/settings/components/SettingsSection";
import { ImageUploader } from "@/features/uploads/components/ImageUploader";
import { isMediaImage, type MediaImage } from "@/features/uploads/api";
import type { StoreAppearance } from "@/features/settings/types";
import {
  APPEARANCE_COLOR_ROLES,
  APPEARANCE_DEFAULT_SCHEMES,
  APPEARANCE_HEADER_HTML_MAX,
  APPEARANCE_HOME_SECTIONS,
  APPEARANCE_LOGO_ALIGNMENTS,
  APPEARANCE_MARQUEE_TEXT_MAX,
  APPEARANCE_TEXT_KEYS,
  APPEARANCE_TEXT_LIMITS,
  APPEARANCE_HEX,
  colorSchemesProblem,
  effectiveSchemeColor,
  effectiveSchemeColors,
  type AppearanceColorRole,
  type AppearanceColorScheme,
  type AppearanceDetailColorKey,
  type AppearanceDetailColors,
  type AppearanceHomeSectionKey,
  type AppearanceImage,
  type AppearanceLogoAlignment,
  type AppearanceSectionEdits,
  type AppearanceTextKey,
} from "../../../../../cod-shared/stores/appearance";
import { STORE_LOCALE_INFO, type StoreLocale } from "../../../../../cod-shared/i18n/locales";

const COLOR_LABEL_KEYS: Record<AppearanceColorRole, string> = {
  background: "store.appearance_color_background",
  text: "store.appearance_color_text",
  heading: "store.appearance_color_heading",
  accent: "store.appearance_color_accent",
  button: "store.appearance_color_primary",
  buttonText: "store.appearance_color_buttonText",
  border: "store.appearance_color_border",
};

const TEXT_FIELDS: { key: AppearanceTextKey; labelKey: string; hintKey?: string }[] = [
  { key: "heroTitle", labelKey: "store.appearance_text_heroTitle" },
  { key: "heroSubtitle", labelKey: "store.appearance_text_heroSubtitle" },
  { key: "heroCtaPrimary", labelKey: "store.appearance_text_heroCtaPrimary", hintKey: "store.appearance_text_heroCtaPrimary_hint" },
  { key: "heroCtaSecondary", labelKey: "store.appearance_text_heroCtaSecondary", hintKey: "store.appearance_text_heroCtaSecondary_hint" },
  { key: "bannerTag", labelKey: "store.appearance_text_bannerTag" },
  { key: "bannerTitle", labelKey: "store.appearance_text_bannerTitle", hintKey: "store.appearance_text_bannerTitle_hint" },
  { key: "bannerSub", labelKey: "store.appearance_text_bannerSub" },
];

const DETAIL_COLOR_FIELDS: { key: AppearanceDetailColorKey; labelKey: string }[] = [
  { key: "secondaryButton", labelKey: "store.appearance_color_secondaryButton" },
  { key: "offer", labelKey: "store.appearance_color_offer" },
  { key: "oldPrice", labelKey: "store.appearance_color_oldPrice" },
  { key: "newPrice", labelKey: "store.appearance_color_newPrice" },
];

function mixHex(from: string, to: string, weight: number): string {
  const channel = (hex: string, at: number) => Number.parseInt(hex.slice(at, at + 2), 16);
  const mixed = [1, 3, 5].map((at) =>
    Math.round(channel(from, at) * weight + channel(to, at) * (1 - weight))
      .toString(16)
      .padStart(2, "0"),
  );
  return `#${mixed.join("")}`;
}

function autoDetailColor(key: AppearanceDetailColorKey, scheme: AppearanceColorScheme | undefined): string {
  if (key === "secondaryButton") return effectiveSchemeColor(scheme, "heading");
  if (key === "oldPrice") {
    return mixHex(effectiveSchemeColor(scheme, "text"), effectiveSchemeColor(scheme, "background"), 0.74);
  }
  if (key === "newPrice") return effectiveSchemeColor(scheme, "accent");
  return "#f2c14e";
}

export function autoDetailSwatch(key: AppearanceDetailColorKey, scheme: AppearanceColorScheme | undefined): string {
  if (key === "oldPrice") {
    return `color-mix(in oklab, ${effectiveSchemeColor(scheme, "text")} 74%, ${effectiveSchemeColor(scheme, "background")})`;
  }
  return autoDetailColor(key, scheme);
}

const IMAGE_SECTION_KEYS = new Set<AppearanceHomeSectionKey>(["hero", "image-banner"]);
const MARQUEE_SECOND_AUTO = "#f2c14e";
const MARQUEE_BACKGROUND_AUTO = "#f2c14e";

const LOOKS = [
  { id: "scheme-1", labelKey: "store.appearance_look_original" },
  { id: "scheme-6", labelKey: "store.appearance_look_olive" },
  { id: "scheme-5", labelKey: "store.appearance_look_midnight" },
].map((look) => ({
  ...look,
  colors: effectiveSchemeColors(APPEARANCE_DEFAULT_SCHEMES.find((scheme) => scheme.id === look.id)!),
}));

/** A scheme's name is a plain string, or the same name in several languages. */
function schemeName(name: AppearanceColorScheme["name"], locale: string): string {
  if (typeof name === "string") return name;
  return name[locale] ?? Object.values(name)[0] ?? "";
}

function cloneSchemes(schemes: AppearanceColorScheme[]): AppearanceColorScheme[] {
  return JSON.parse(JSON.stringify(schemes)) as AppearanceColorScheme[];
}

function normalizedHex(raw: string): string | null {
  const next = raw.trim().toLowerCase();
  if (APPEARANCE_HEX.test(next)) return next;
  if (APPEARANCE_HEX.test(`#${next}`)) return `#${next}`;
  return null;
}

function safeHex(value: unknown): string | null {
  return typeof value === "string" && APPEARANCE_HEX.test(value) ? value.toLowerCase() : null;
}

function safeSize(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
}

type SectionState = StoreAppearance["sections"][AppearanceHomeSectionKey];

function emptySection(key: AppearanceHomeSectionKey): SectionState {
  return key === "marquee"
    ? { hidden: false, image: null, text: "", color: null, accentColor: null, backgroundColor: null }
    : { hidden: false, image: null };
}

function emptySections(): StoreAppearance["sections"] {
  return Object.fromEntries(
    APPEARANCE_HOME_SECTIONS.map(({ key }) => [key, emptySection(key)]),
  ) as StoreAppearance["sections"];
}

function sectionImageOf(image: MediaImage | null): AppearanceImage | null {
  if (!isMediaImage(image)) return null;
  const width = safeSize(image.width);
  const height = safeSize(image.height);
  return {
    key: image.key,
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
  };
}

function sectionEdits(sections: StoreAppearance["sections"]): AppearanceSectionEdits {
  return Object.fromEntries(
    APPEARANCE_HOME_SECTIONS.map(({ key }) => [
      key,
      {
        hidden: sections[key]?.hidden ?? false,
        image: IMAGE_SECTION_KEYS.has(key) ? sectionImageOf(sections[key]?.image ?? null) : null,
        ...(key === "marquee"
          ? {
              text: sections.marquee?.text ?? null,
              color: sections.marquee?.color ?? null,
              accentColor: sections.marquee?.accentColor ?? null,
              backgroundColor: sections.marquee?.backgroundColor ?? null,
            }
          : {}),
      },
    ]),
  ) as AppearanceSectionEdits;
}

function savedSectionImage(image: unknown): MediaImage | null {
  if (!isMediaImage(image)) return null;
  return {
    key: image.key,
    url: image.url,
    width: safeSize(image.width) ?? null,
    height: safeSize(image.height) ?? null,
  };
}

function sectionsFrom(saved: StoreAppearance): StoreAppearance["sections"] {
  const nextSections = emptySections();
  for (const { key } of APPEARANCE_HOME_SECTIONS) {
    const savedSection = saved.sections?.[key];
    nextSections[key] = {
      hidden: savedSection?.hidden === true,
      image: savedSectionImage(savedSection?.image),
      ...(key === "marquee"
        ? {
            text: typeof savedSection?.text === "string" ? savedSection.text : "",
            color: safeHex(savedSection?.color),
            accentColor: safeHex(savedSection?.accentColor),
            backgroundColor: safeHex(savedSection?.backgroundColor),
          }
        : {}),
    };
  }
  return nextSections;
}

function safeColorSchemes(value: unknown, fallback: AppearanceColorScheme[]): AppearanceColorScheme[] {
  if (colorSchemesProblem(value) === null) return cloneSchemes(value as AppearanceColorScheme[]);
  if (colorSchemesProblem(fallback) === null) return cloneSchemes(fallback);
  return cloneSchemes(APPEARANCE_DEFAULT_SCHEMES);
}

function safeTexts(value: unknown): Partial<Record<StoreLocale, Record<string, string>>> {
  if (!value || typeof value !== "object") return {};
  const next: Partial<Record<StoreLocale, Record<string, string>>> = {};
  for (const [code, values] of Object.entries(value as Record<string, unknown>)) {
    if (!Object.prototype.hasOwnProperty.call(STORE_LOCALE_INFO, code)) continue;
    if (!values || typeof values !== "object") continue;
    const strings = Object.entries(values as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    );
    next[code as StoreLocale] = Object.fromEntries(strings);
  }
  return next;
}

function safeLocales(value: unknown): StoreLocale[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (code): code is StoreLocale =>
      typeof code === "string" && Object.prototype.hasOwnProperty.call(STORE_LOCALE_INFO, code),
  );
}

function sameColors(
  scheme: AppearanceColorScheme | undefined,
  colors: Record<AppearanceColorRole, string>,
): boolean {
  return APPEARANCE_COLOR_ROLES.every((role) => effectiveSchemeColor(scheme, role) === colors[role]);
}

function ColorField({
  label,
  value,
  onChange,
  isAuto = false,
  autoLabel,
  onClear,
  swatch,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  isAuto?: boolean;
  autoLabel?: string;
  onClear?: () => void;
  swatch?: string;
}) {
  const [text, setText] = useState(value);

  useEffect(() => setText(value), [value]);

  function commit(raw: string) {
    const next = normalizedHex(raw);
    setText(raw);
    if (next) onChange(next);
  }

  function settle() {
    const next = normalizedHex(text);
    if (next) {
      setText(next);
      onChange(next);
    } else {
      setText(value);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 rounded-lg border border-border px-3 py-2.5">
      {isAuto && swatch ? (
        <span
          aria-hidden="true"
          className="size-8 shrink-0 rounded-md border border-input p-0.5"
          style={{ background: swatch }}
        >
          <span className="block size-full rounded-sm border border-border/60" />
        </span>
      ) : (
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value.toLowerCase())}
          aria-label={label}
          className="size-8 shrink-0 cursor-pointer rounded-md border border-input bg-card p-0.5"
        />
      )}
      <span className="min-w-0 flex-1 basis-20 break-words text-sm leading-5 text-foreground">{label}</span>
      <Input
        value={text}
        onChange={(event) => commit(event.target.value)}
        onBlur={settle}
        aria-label={`${label} hex`}
        spellCheck={false}
        maxLength={7}
        className="h-8 w-24 shrink-0 px-2 font-mono text-xs uppercase"
      />
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          disabled={isAuto}
          aria-label={`${label} ${autoLabel ?? "auto"}`}
          className={`inline-flex h-8 shrink-0 items-center rounded-md border px-2.5 text-[0.65rem] font-semibold transition-colors ${
            isAuto
              ? "border-primary/40 bg-primary/[0.06] text-foreground"
              : "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          }`}
        >
          {autoLabel ?? "Auto"}
        </button>
      )}
    </div>
  );
}

function AppearancePreview({
  scheme,
  detailColors,
  title,
  subtitle,
  cta,
}: {
  scheme: AppearanceColorScheme | undefined;
  detailColors: AppearanceDetailColors;
  title: string;
  subtitle: string;
  cta: string;
}) {
  const t = useT("settings");
  if (!scheme) return null;
  const colors = effectiveSchemeColors(scheme);
  const secondary = detailColors.secondaryButton ?? autoDetailSwatch("secondaryButton", scheme);
  const oldPrice = detailColors.oldPrice ?? autoDetailSwatch("oldPrice", scheme);
  const newPrice = detailColors.newPrice ?? autoDetailSwatch("newPrice", scheme);
  const offer = detailColors.offer ?? autoDetailColor("offer", scheme);

  return (
    <div className="space-y-1.5">
      <span className="text-sm font-medium text-foreground">{t("store.appearance_preview")}</span>
      <div
        className="rounded-xl border p-4"
        style={{ background: colors.background, borderColor: colors.border, color: colors.text }}
      >
        <p className="text-base font-bold leading-snug" style={{ color: colors.heading }}>
          {title}
        </p>
        <p className="mt-1 text-xs leading-relaxed" style={{ color: colors.text }}>
          {subtitle}
        </p>
        <p className="mt-3 flex items-center gap-2 text-sm">
          <span className="text-xs line-through" style={{ color: oldPrice }}>
            {t("store.appearance_preview_was")}
          </span>
          <span className="text-base font-bold" style={{ color: newPrice }}>
            {t("store.appearance_preview_price")}
          </span>
        </p>
        <span
          className="mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={{ background: offer, color: "#0f1626" }}
        >
          {t("store.appearance_preview_offer")}
        </span>
        <div
          className="mt-3 rounded-lg border px-3 py-2 text-xs"
          style={{ borderColor: colors.border, color: colors.text }}
        >
          {t("store.appearance_preview_field")}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <span
            className="rounded-lg px-3 py-2 text-center text-xs font-bold"
            style={{ background: colors.button, color: colors.buttonText }}
          >
            {cta}
          </span>
          <span
            className="rounded-lg border px-3 py-2 text-center text-xs font-bold"
            style={{ color: secondary, borderColor: secondary }}
          >
            {t("store.appearance_preview_secondary_cta")}
          </span>
        </div>
      </div>
    </div>
  );
}

export function AppearanceSettings() {
  const t = useT("settings");
  const common = useT("common");
  const locale = useLocale();
  const [data, setData] = useState<StoreAppearance | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [schemes, setSchemes] = useState<AppearanceColorScheme[]>([]);
  const [pageScheme, setPageScheme] = useState("");
  const [selected, setSelected] = useState("");
  const [detailColors, setDetailColors] = useState<AppearanceDetailColors>({});
  const [textLocale, setTextLocale] = useState<StoreLocale>("ar");
  const [drafts, setDrafts] = useState<Partial<Record<StoreLocale, Record<string, string>>>>({});
  const [controls, setControls] = useState({
    hideLogo: false,
    hideHeaderText: false,
    hideMenu: false,
    searchEnabled: true,
    headerHtml: "",
    logoAlignment: "right" as AppearanceLogoAlignment,
  });
  const [sections, setSections] = useState<StoreAppearance["sections"]>(emptySections);
  const sectionVersion = useRef(0);

  function applySaved(saved: StoreAppearance, initial = false, sectionsSaved = false) {
    if (!saved || typeof saved !== "object") throw new Error(t("store.save_error"));
    const colorSchemes = safeColorSchemes(saved.colorSchemes, schemes);
    const pageSchemeSaved =
      typeof saved.pageScheme === "string" && colorSchemes.some((scheme) => scheme.id === saved.pageScheme)
        ? saved.pageScheme
        : pageScheme || colorSchemes[0]?.id || "";
    setData(saved);
    setSchemes(colorSchemes);
    setPageScheme(pageSchemeSaved);
    setDetailColors({ ...(saved.detailColors ?? {}) });
    setSelected((id) =>
      initial || !colorSchemes.some((scheme) => scheme.id === id)
        ? colorSchemes[0]?.id || ""
        : id,
    );
    if (initial) {
      setTextLocale(
        typeof saved.primaryLocale === "string" &&
          Object.prototype.hasOwnProperty.call(STORE_LOCALE_INFO, saved.primaryLocale)
          ? (saved.primaryLocale as StoreLocale)
          : textLocale,
      );
      setDrafts(safeTexts(saved.texts));
    }
    setControls({
      hideLogo: saved.hideLogo ?? controls.hideLogo,
      hideHeaderText: saved.hideHeaderText ?? controls.hideHeaderText,
      hideMenu: saved.hideMenu ?? controls.hideMenu,
      searchEnabled: saved.searchEnabled ?? controls.searchEnabled,
      headerHtml: typeof saved.headerHtml === "string" ? saved.headerHtml : controls.headerHtml,
      logoAlignment: saved.logoAlignment ?? controls.logoAlignment,
    });
    if (initial || sectionsSaved) setSections(sectionsFrom(saved));
  }

  async function load() {
    setLoadError(null);
    try {
      applySaved(await getAppearance(), true);
    } catch (cause) {
      setLoadError(cause);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (loadError) {
    return (
      <Alert role="alert" tone="critical">
        <div className="flex-1">
          <p className="font-semibold">{t("store.appearance_load_error")}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 text-xs font-semibold underline underline-offset-4"
          >
            {common("retry")}
          </button>
        </div>
      </Alert>
    );
  }

  if (data === null) {
    return (
      <div role="status" aria-busy="true" className="flex min-h-40 items-center justify-center">
        <Loader2 size={22} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  const current = schemes.find((scheme) => scheme.id === selected) ?? schemes[0];
  const localeDrafts = drafts[textLocale] ?? {};
  const localeOptions = safeLocales(data.locales);

  function updateColor(role: AppearanceColorRole, value: string | null) {
    if (!current) return;
    setSchemes((list) =>
      list.map((scheme) =>
        scheme.id === current.id ? { ...scheme, colors: { ...scheme.colors, [role]: value } } : scheme,
      ),
    );
  }

  function applyLook(id: string) {
    const look = LOOKS.find((candidate) => candidate.id === id);
    if (!look) return;
    setPageScheme(id);
    setSelected(schemes[0]?.id ?? id);
    if (id === "scheme-1") {
      setSchemes(cloneSchemes(APPEARANCE_DEFAULT_SCHEMES));
      setDetailColors({});
      return;
    }
    setSchemes((list) => list.map((scheme) => ({ ...scheme, colors: { ...look.colors } })));
  }

  function updateSection(key: AppearanceHomeSectionKey, change: Partial<SectionState>) {
    sectionVersion.current += 1;
    setSections((all) => ({ ...all, [key]: { ...all[key], ...change } }));
  }

  async function persistHeroImage(image: MediaImage) {
    const edit = sectionImageOf(image);
    if (!edit) return;
    try {
      const saved = await saveAppearance({ sections: { hero: { image: edit } } });
      const savedImage = savedSectionImage(saved.sections?.hero?.image);
      if (savedImage) {
        setSections((all) => ({ ...all, hero: { ...all.hero, image: savedImage } }));
      }
      notify.success(common("feedback.uploaded"));
    } catch {
      notify.error(t("store.save_error"));
    }
  }

  async function saveColors() {
    const payload: SaveAppearanceInput = { colorSchemes: schemes, pageScheme, detailColors };
    applySaved(await saveAppearance(payload));
  }

  async function saveControls() {
    const payload: SaveAppearanceInput = {
      hideLogo: controls.hideLogo,
      hideHeaderText: controls.hideHeaderText,
      hideMenu: controls.hideMenu,
      searchEnabled: controls.searchEnabled,
      headerHtml: controls.headerHtml,
      logoAlignment: controls.logoAlignment,
    };
    applySaved(await saveAppearance(payload));
  }

  async function saveSections() {
    const version = sectionVersion.current;
    const saved = await saveAppearance({ sections: sectionEdits(sections) });
    applySaved(saved, false, sectionVersion.current === version);
  }

  async function saveTexts() {
    const values: Record<string, string> = {};
    for (const key of APPEARANCE_TEXT_KEYS) values[key] = localeDrafts[key] ?? "";
    const saved = await saveAppearance({ texts: { locale: textLocale, values } });
    applySaved(saved);
    const nextTexts = safeTexts(saved.texts);
    setDrafts((all) => ({ ...all, [textLocale]: nextTexts[textLocale] ?? all[textLocale] ?? {} }));
  }

  function updateText(key: AppearanceTextKey, value: string) {
    setDrafts((all) => ({
      ...all,
      [textLocale]: { ...(all[textLocale] ?? {}), [key]: value },
    }));
  }

  const previewTitle = localeDrafts.heroTitle?.trim() || t("store.appearance_preview_title");
  const previewSubtitle = localeDrafts.heroSubtitle?.trim() || t("store.appearance_preview_text");
  const previewCta = localeDrafts.heroCtaPrimary?.trim() || t("store.appearance_preview_cta");

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-card px-5 py-4 shadow-card">
        <h2 className="text-sm font-semibold text-foreground">{t("store.appearance_title")}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{t("store.appearance_subtitle")}</p>
      </div>

      <SettingsSection
        icon={Palette}
        title={t("store.appearance_colors_title")}
        subtitle={t("store.appearance_colors_subtitle")}
        onSave={saveColors}
      >
        <div className="mb-5 space-y-2">
          <div>
            <span className="block text-sm font-medium text-foreground">
              {t("store.appearance_looks_label")}
            </span>
            <p className="text-xs text-muted-foreground">{t("store.appearance_looks_hint")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {LOOKS.map((look) => {
              const scheme = schemes[0];
              if (!scheme) return null;
              const active = pageScheme === look.id && sameColors(scheme, look.colors);
              return (
                <button
                  key={look.id}
                  type="button"
                  onClick={() => applyLook(look.id)}
                  aria-pressed={active}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    active ? "border-primary/50 bg-primary/[0.06] text-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className="size-3 rounded-full border border-black/10" style={{ background: look.colors.button }} />
                  {t(look.labelKey)}
                  {active && <Check size={13} className="text-primary" />}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <span className="block text-sm font-medium text-foreground">
                {t("store.appearance_schemes_label")}
              </span>
              <p className="text-xs text-muted-foreground">{t("store.appearance_schemes_hint")}</p>
            </div>
            <div className="space-y-1.5">
              {schemes.map((scheme) => {
                const active = scheme.id === current?.id;
                return (
                  <button
                    key={scheme.id}
                    type="button"
                    onClick={() => setSelected(scheme.id)}
                    aria-pressed={active}
                    className={`flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-start transition-colors ${
                      active
                        ? "border-primary/50 bg-primary/[0.06] shadow-xs"
                        : "border-border bg-card hover:bg-muted/60"
                    }`}
                  >
                    <span
                      className="grid size-7 shrink-0 place-items-center rounded-md border"
                      style={{
                        background: effectiveSchemeColor(scheme, "background"),
                        borderColor: effectiveSchemeColor(scheme, "border"),
                      }}
                    >
                      <span
                        className="size-2.5 rounded-full"
                        style={{ background: effectiveSchemeColor(scheme, "button") }}
                      />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {schemeName(scheme.name, locale)}
                    </span>
                    {pageScheme === scheme.id && (
                      <Badge tone="neutral" size="sm">
                        {t("store.appearance_page_badge")}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
            <FieldRow
              label={t("store.appearance_page_scheme_label")}
              help={t("store.appearance_page_scheme_hint")}
            >
              <Select value={pageScheme} onChange={(event) => setPageScheme(event.target.value)}>
                {schemes.map((scheme) => (
                  <option key={scheme.id} value={scheme.id}>
                    {schemeName(scheme.name, locale)}
                  </option>
                ))}
              </Select>
            </FieldRow>
          </div>

          <div className="space-y-4">
            <div className="grid gap-2.5 xl:grid-cols-2">
              {APPEARANCE_COLOR_ROLES.map((role) => {
                const auto = current?.colors[role] == null;
                const color = effectiveSchemeColor(current, role);
                return (
                  <ColorField
                    key={role}
                    label={t(COLOR_LABEL_KEYS[role])}
                    value={color}
                    swatch={color}
                    isAuto={auto}
                    autoLabel={t("store.appearance_color_auto")}
                    onClear={() => updateColor(role, null)}
                    onChange={(value) => updateColor(role, value)}
                  />
                );
              })}
            </div>
            <div className="space-y-2 border-t border-border pt-4">
              <div>
                <span className="block text-sm font-medium text-foreground">
                  {t("store.appearance_detail_colors_label")}
                </span>
                <p className="text-xs text-muted-foreground">{t("store.appearance_detail_colors_hint")}</p>
              </div>
              <div className="grid gap-2.5 xl:grid-cols-2">
                {DETAIL_COLOR_FIELDS.map((field) => {
                  const color = detailColors[field.key];
                  return (
                    <ColorField
                      key={field.key}
                      label={t(field.labelKey)}
                      value={color ?? autoDetailColor(field.key, current)}
                      swatch={color == null ? autoDetailSwatch(field.key, current) : undefined}
                      isAuto={color == null}
                      autoLabel={t("store.appearance_color_auto")}
                      onClear={() =>
                        setDetailColors((all) => ({ ...all, [field.key]: null }))
                      }
                      onChange={(value) =>
                        setDetailColors((all) => ({ ...all, [field.key]: value }))
                      }
                    />
                  );
                })}
              </div>
            </div>
            <AppearancePreview
              scheme={current}
              detailColors={detailColors}
              title={previewTitle}
              subtitle={previewSubtitle}
              cta={previewCta}
            />
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        icon={SlidersHorizontal}
        title={t("store.appearance_storefront_title")}
        subtitle={t("store.appearance_storefront_subtitle")}
        onSave={saveControls}
      >
        <div className="space-y-5">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("store.appearance_group_header")}
            </p>
            <FieldRow
              label={t("store.appearance_control_logoAlignment")}
              help={t("store.appearance_control_logoAlignment_hint")}
            >
              <Select
                value={controls.logoAlignment}
                onChange={(event) =>
                  setControls((current) => ({ ...current, logoAlignment: event.target.value as AppearanceLogoAlignment }))
                }
              >
                {APPEARANCE_LOGO_ALIGNMENTS.map((alignment) => (
                  <option key={alignment} value={alignment}>
                    {t(`store.appearance_logo_${alignment}`)}
                  </option>
                ))}
              </Select>
            </FieldRow>
            <div className="grid gap-3 sm:grid-cols-3">
              <SwitchField
                label={t("store.appearance_control_hideLogo")}
                help={t("store.appearance_control_hideLogo_hint")}
                checked={controls.hideLogo}
                onChange={(hideLogo) => setControls((current) => ({ ...current, hideLogo }))}
              />
              <SwitchField
                label={t("store.appearance_control_hideHeaderText")}
                help={t("store.appearance_control_hideHeaderText_hint")}
                checked={controls.hideHeaderText}
                onChange={(hideHeaderText) => setControls((current) => ({ ...current, hideHeaderText }))}
              />
              <SwitchField
                label={t("store.appearance_control_hideMenu")}
                help={t("store.appearance_control_hideMenu_hint")}
                checked={controls.hideMenu}
                onChange={(hideMenu) => setControls((current) => ({ ...current, hideMenu }))}
              />
            </div>
          </div>
          <div className="space-y-3 border-t border-border pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("store.appearance_group_search")}
            </p>
            <SwitchField
              label={t("store.appearance_control_searchEnabled")}
              help={t("store.appearance_control_searchEnabled_hint")}
              checked={controls.searchEnabled}
              onChange={(searchEnabled) => setControls((current) => ({ ...current, searchEnabled }))}
            />
            <Field
              label={t("store.appearance_control_headerHtml")}
              hint={`${controls.headerHtml.length}/${APPEARANCE_HEADER_HTML_MAX}`}
            >
              <Textarea
                value={controls.headerHtml}
                maxLength={APPEARANCE_HEADER_HTML_MAX}
                rows={3}
                spellCheck={false}
                onChange={(event) => setControls((current) => ({ ...current, headerHtml: event.target.value }))}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {t("store.appearance_control_headerHtml_hint")}
              </p>
            </Field>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        icon={Layers3}
        title={t("store.appearance_sections_title")}
        subtitle={t("store.appearance_sections_subtitle")}
        onSave={saveSections}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {APPEARANCE_HOME_SECTIONS.map(({ key }) => {
            const section = sections[key];
            const label = t(`store.appearance_section_${key}`);
            return (
              <div key={key} className="rounded-lg border border-border p-3">
                <SwitchField
                  label={label}
                  help={t("store.appearance_section_hide")}
                  checked={section?.hidden ?? false}
                  onChange={(hidden) => updateSection(key, { hidden })}
                />
                {key === "marquee" && (
                  <div className="mt-3 space-y-2 border-t border-border pt-3">
                    <Field
                      label={t("store.appearance_section_marquee_text")}
                      hint={`${(section?.text ?? "").length}/${APPEARANCE_MARQUEE_TEXT_MAX}`}
                    >
                      <Textarea
                        value={section?.text ?? ""}
                        maxLength={APPEARANCE_MARQUEE_TEXT_MAX}
                        rows={2}
                        spellCheck={false}
                        onChange={(event) => updateSection(key, { text: event.target.value })}
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("store.appearance_section_marquee_text_hint")}
                      </p>
                    </Field>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <ColorField
                        label={t("store.appearance_section_marquee_color")}
                        value={section?.color ?? effectiveSchemeColor(current, "heading")}
                        swatch={effectiveSchemeColor(current, "heading")}
                        isAuto={!section?.color}
                        autoLabel={t("store.appearance_color_auto")}
                        onClear={() => updateSection(key, { color: null })}
                        onChange={(color) => updateSection(key, { color })}
                      />
                      <ColorField
                        label={t("store.appearance_section_marquee_accent_color")}
                        value={section?.accentColor ?? MARQUEE_SECOND_AUTO}
                        swatch={MARQUEE_SECOND_AUTO}
                        isAuto={!section?.accentColor}
                        autoLabel={t("store.appearance_color_auto")}
                        onClear={() => updateSection(key, { accentColor: null })}
                        onChange={(accentColor) => updateSection(key, { accentColor })}
                      />
                    </div>
                    <ColorField
                      label={t("store.appearance_section_marquee_background_color")}
                      value={section?.backgroundColor ?? MARQUEE_BACKGROUND_AUTO}
                      swatch={MARQUEE_BACKGROUND_AUTO}
                      isAuto={!section?.backgroundColor}
                      autoLabel={t("store.appearance_color_auto")}
                      onClear={() => updateSection(key, { backgroundColor: null })}
                      onChange={(backgroundColor) => updateSection(key, { backgroundColor })}
                    />
                  </div>
                )}
                {IMAGE_SECTION_KEYS.has(key) && (
                  <div className="mt-3 border-t border-border pt-3">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      {t("store.appearance_section_image")}
                    </p>
                    <ImageUploader
                      value={section?.image ?? null}
                      onChange={(image: MediaImage | null) => {
                        const next = isMediaImage(image) ? image : null;
                        updateSection(key, { image: next });
                        if (key === "hero" && next) void persistHeroImage(next);
                      }}
                      alt={label}
                      shape="landscape"
                      buttonLabel={t("store.appearance_section_upload")}
                      quietSuccess={key === "hero"}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SettingsSection>

      <SettingsSection
        icon={Type}
        title={t("store.appearance_texts_title")}
        subtitle={t("store.appearance_texts_subtitle")}
        onSave={saveTexts}
      >
        <FieldRow label={t("store.appearance_language_label")} help={t("store.appearance_text_hint")}>
          <Select
            value={textLocale}
            onChange={(event) => setTextLocale(event.target.value as StoreLocale)}
          >
            {localeOptions.map((code) => (
              <option key={code} value={code}>
                {STORE_LOCALE_INFO[code]?.nativeName ?? code}
              </option>
            ))}
          </Select>
        </FieldRow>

        <div className="grid gap-4 xl:grid-cols-2">
          {TEXT_FIELDS.map((field) => {
            const limit = APPEARANCE_TEXT_LIMITS[field.key];
            const value = localeDrafts[field.key] ?? "";
            return (
              <Field
                key={field.key}
                label={t(field.labelKey)}
                hint={`${value.length}/${limit.max}`}
                className={limit.multiline ? "xl:col-span-2" : ""}
              >
                {limit.multiline ? (
                  <Textarea
                    value={value}
                    maxLength={limit.max}
                    onChange={(event) => updateText(field.key, event.target.value)}
                  />
                ) : (
                  <Input
                    value={value}
                    maxLength={limit.max}
                    onChange={(event) => updateText(field.key, event.target.value)}
                  />
                )}
                {field.hintKey && (
                  <p className="mt-1 text-xs text-muted-foreground">{t(field.hintKey)}</p>
                )}
              </Field>
            );
          })}
        </div>

        <AppearancePreview
          scheme={current}
          detailColors={detailColors}
          title={previewTitle}
          subtitle={previewSubtitle}
          cta={previewCta}
        />
      </SettingsSection>

      <p className="text-xs text-muted-foreground">
        {t("store.appearance_reload_hint")}
      </p>
    </div>
  );
}
