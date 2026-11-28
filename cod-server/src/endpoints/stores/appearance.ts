/**
 * The storefront's appearance — its color schemes and its theme text — as the
 * dashboard's Appearance tab reads and writes them.
 *
 * Local customization: the contract in AGENTS.md says theme settings are
 * written by Wocart Cloud's editor. This file is the one deliberate exception,
 * kept apart from the rest of the stores endpoints so a future update can drop
 * it and reapply it.
 */

import { OpenAPIHono, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import type { AppContext } from "@/types";
import type { Env } from "@/types/env";
import { mediaDeliveryOf } from "@/lib/media";
import { defineRoute } from "@/lib/route-builder";
import { getDb } from "@/db";
import * as queries from "./queries";
import {
  getThemeSettings,
  listContentOverrides,
  saveContentOverrides,
  saveThemeSettings,
} from "../../../../cod-shared/queries/stores";
import { STORE_LOCALES } from "../../../../cod-shared/i18n/locales";
import { NotFoundError, ValidationError } from "@/lib/errors/classes";
import { ERROR_CODES } from "../../../../cod-shared/errors/codes";
import {
  APPEARANCE_CHROME_KEYS,
  APPEARANCE_CONTACT_ALIGNMENTS,
  APPEARANCE_CONTACT_KEYS,
  APPEARANCE_CONTACT_LAYOUTS,
  APPEARANCE_DEFAULT_SCHEMES,
  APPEARANCE_HEADER_HTML_MAX,
  APPEARANCE_LINK_MAX,
  APPEARANCE_HEX,
  APPEARANCE_HOME_SECTIONS,
  APPEARANCE_LOGO_ALIGNMENTS,
  APPEARANCE_MARQUEE_TEXT_MAX,
  APPEARANCE_MAX_SCHEMES,
  APPEARANCE_MEDIA_KEY,
  APPEARANCE_SCHEME_ID,
  APPEARANCE_SECTION_COLOR_FIELDS,
  APPEARANCE_TEXT_KEYS,
  appearanceContactHref,
  appearanceLocaleProblem,
  appearanceSettingsToRemove,
  appearanceSettingsToTheme,
  appearanceTextProblem,
  appearanceThemeSettingsOf,
  mergeAppearance,
  normalizeContactAlignment,
  sanitizeHeaderHtml,
  type AppearanceColorScheme,
  type AppearanceContact,
  type AppearanceContactAlignment,
  type AppearanceContactLayout,
  type AppearanceDetailColors,
  type AppearanceHomeSectionKey,
  type AppearanceLogoAlignment,
  type AppearanceSectionEdits,
} from "../../../../cod-shared/stores/appearance";
import { imageOf } from "../../../../cod-shared/media/views";
import { SuccessResponseSchema } from "@/openapi/schemas";

const jsonContent = <T extends z.ZodType>(schema: T) => ({
  "application/json": { schema },
});

const schemeColor = z.string().regex(APPEARANCE_HEX).nullable().optional();

const colorSchemeSchema = z.object({
  id: z.string().regex(APPEARANCE_SCHEME_ID),
  name: z.union([z.string().min(1), z.record(z.string(), z.string())]),
  colors: z.object({
    background: schemeColor,
    text: schemeColor,
    heading: schemeColor,
    accent: schemeColor,
    button: schemeColor,
    buttonText: schemeColor,
    border: schemeColor,
  }),
});

const SECTION_KEYS = APPEARANCE_HOME_SECTIONS.map((section) => section.key) as [
  AppearanceHomeSectionKey,
  ...AppearanceHomeSectionKey[],
];
const logoAlignmentSchema = z.enum(
  APPEARANCE_LOGO_ALIGNMENTS as unknown as [AppearanceLogoAlignment, ...AppearanceLogoAlignment[]],
);
const contactAlignmentSchema = z.enum(
  APPEARANCE_CONTACT_ALIGNMENTS as unknown as [AppearanceContactAlignment, ...AppearanceContactAlignment[]],
);
const contactLayoutSchema = z.enum(
  APPEARANCE_CONTACT_LAYOUTS as unknown as [AppearanceContactLayout, ...AppearanceContactLayout[]],
);

const appearanceImageSchema = z.object({
  key: z.string().regex(APPEARANCE_MEDIA_KEY),
  alt: z.string().max(200).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  focal: z
    .object({
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
    })
    .optional(),
});

const sectionColorSchema = z.object({
  color: z.string().regex(APPEARANCE_HEX).nullable().optional(),
  backgroundColor: z.string().regex(APPEARANCE_HEX).nullable().optional(),
  buttonColor: z.string().regex(APPEARANCE_HEX).nullable().optional(),
});

const sectionEditSchema = sectionColorSchema.extend({
  hidden: z.boolean().nullable().optional(),
  image: appearanceImageSchema.nullable().optional(),
  text: z.string().max(APPEARANCE_MARQUEE_TEXT_MAX).nullable().optional(),
  accentColor: z.string().regex(APPEARANCE_HEX).nullable().optional(),
});

const chromeColorsSchema = z.record(z.enum(APPEARANCE_CHROME_KEYS), sectionColorSchema);

const detailColor = z.string().regex(APPEARANCE_HEX).nullable().optional();
const detailColorsSchema = z.object({
  secondaryButton: detailColor,
  offer: detailColor,
  oldPrice: detailColor,
  newPrice: detailColor,
});

const contactSchema = z
  .object(
    Object.fromEntries(
      APPEARANCE_CONTACT_KEYS.map((key) => [key, z.string().max(APPEARANCE_LINK_MAX).optional()]),
    ),
  )
  .strict()
  .superRefine((value, ctx) => {
    for (const key of APPEARANCE_CONTACT_KEYS) {
      const raw = value[key];
      if (raw !== undefined && raw.trim() && !appearanceContactHref(key, raw)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: "Enter a phone number, email address or social link this theme can open",
        });
      }
    }
  });

const sectionColorStateSchema = z.object(
  Object.fromEntries(
    APPEARANCE_SECTION_COLOR_FIELDS.map((field) => [field, z.string().nullable().optional()]),
  ),
);

const sectionStateSchema = sectionColorStateSchema.extend({
  hidden: z.boolean(),
  image: z
    .object({
      key: z.string(),
      url: z.string(),
      width: z.number().nullable(),
      height: z.number().nullable(),
    })
    .nullable(),
  text: z.string().nullable().optional(),
  accentColor: z.string().nullable().optional(),
});

const appearanceSchema = z.object({
  themeKey: z.string(),
  primaryLocale: z.enum(STORE_LOCALES),
  locales: z.array(z.enum(STORE_LOCALES)),
  colorSchemes: z.array(colorSchemeSchema),
  pageScheme: z.string(),
  hideLogo: z.boolean(),
  hideHeaderText: z.boolean(),
  hideMenu: z.boolean(),
  searchEnabled: z.boolean(),
  showHeaderHtml: z.boolean(),
  showContactLinks: z.boolean(),
  headerHtml: z.string(),
  logoAlignment: logoAlignmentSchema,
  contactAlignment: contactAlignmentSchema,
  contactLayout: contactLayoutSchema,
  sections: z.record(z.enum(SECTION_KEYS), sectionStateSchema),
  chromeColors: chromeColorsSchema,
  contact: contactSchema,
  detailColors: detailColorsSchema,
  texts: z.record(z.string(), z.record(z.string(), z.string())),
});

export const saveAppearanceSchema = z.object({
  colorSchemes: z.array(colorSchemeSchema).min(1).max(APPEARANCE_MAX_SCHEMES).optional(),
  pageScheme: z.string().optional(),
  hideLogo: z.boolean().optional(),
  hideHeaderText: z.boolean().optional(),
  hideMenu: z.boolean().optional(),
  searchEnabled: z.boolean().optional(),
  showHeaderHtml: z.boolean().optional(),
  showContactLinks: z.boolean().optional(),
  headerHtml: z.string().max(APPEARANCE_HEADER_HTML_MAX).optional(),
  logoAlignment: logoAlignmentSchema.optional(),
  contactAlignment: contactAlignmentSchema.optional(),
  contactLayout: contactLayoutSchema.optional(),
  sections: z.partialRecord(z.enum(SECTION_KEYS), sectionEditSchema).optional(),
  chromeColors: chromeColorsSchema.optional(),
  contact: contactSchema.optional(),
  detailColors: detailColorsSchema.optional(),
  texts: z
    .object({
      locale: z.enum(STORE_LOCALES),
      values: z.record(z.string(), z.string().max(400)),
    })
    .optional(),
});

type StoreRow = NonNullable<Awaited<ReturnType<typeof queries.getStore>>>;

async function appearanceOf(db: ReturnType<typeof getDb>, store: StoreRow, env: Env) {
  const stored = await getThemeSettings(db, store.id, store.themeId);
  const saved = appearanceThemeSettingsOf(stored);
  const colorSchemes = saved?.colorSchemes ?? APPEARANCE_DEFAULT_SCHEMES;
  const pageScheme = saved?.pageScheme ?? colorSchemes[0]!.id;
  const [localeRows, overrides] = await Promise.all([
    queries.listStoreLocales(db, store.id),
    listContentOverrides(db, store.id, store.themeId),
  ]);
  const locales = localeRows.map((row) => row.locale);
  const texts: Record<string, Record<string, string>> = {};
  for (const row of overrides) {
    if (!locales.includes(row.locale)) continue;
    if (!(APPEARANCE_TEXT_KEYS as readonly string[]).includes(row.key)) continue;
    (texts[row.locale] ??= {})[row.key] = row.value;
  }
  const delivery = mediaDeliveryOf(env);
  const sections = Object.fromEntries(
    APPEARANCE_HOME_SECTIONS.map((section) => {
      const edit = saved?.sections?.[section.key];
      const source = edit?.image;
      return [
        section.key,
        {
          hidden: edit?.hidden === true,
          image: source
            ? imageOf(source.key, delivery, { width: source.width, height: source.height })
            : null,
          color: edit?.color ?? null,
          backgroundColor: edit?.backgroundColor ?? null,
          buttonColor: edit?.buttonColor ?? null,
          ...(section.key === "marquee" ? { text: edit?.text ?? "", accentColor: edit?.accentColor ?? null } : {}),
        },
      ];
    }),
  );
  const chromeColors = Object.fromEntries(
    APPEARANCE_CHROME_KEYS.map((key) => [
      key,
      {
        color: saved?.chromeColors?.[key]?.color ?? null,
        backgroundColor: saved?.chromeColors?.[key]?.backgroundColor ?? null,
        buttonColor: saved?.chromeColors?.[key]?.buttonColor ?? null,
      },
    ]),
  );
  return {
    themeKey: store.themeId,
    primaryLocale: store.lang,
    locales,
    colorSchemes,
    pageScheme,
    hideLogo: saved?.hideLogo ?? false,
    hideHeaderText: saved?.hideHeaderText ?? false,
    hideMenu: saved?.hideMenu ?? false,
    searchEnabled: saved?.searchEnabled ?? true,
    showHeaderHtml: saved?.showHeaderHtml ?? true,
    showContactLinks: saved?.showContactLinks ?? true,
    headerHtml: sanitizeHeaderHtml(saved?.headerHtml ?? ""),
    logoAlignment: saved?.logoAlignment ?? "right",
    contactAlignment: normalizeContactAlignment(saved?.contactAlignment),
    contactLayout: saved?.contactLayout ?? "row",
    sections,
    chromeColors,
    contact: (saved?.contact ?? {}) as AppearanceContact,
    detailColors: (saved?.detailColors ?? {}) as AppearanceDetailColors,
    texts,
  };
}

export async function getAppearance(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const store = await queries.getStore(db);
  if (!store) throw new NotFoundError("Store");
  return c.json({ success: true, data: await appearanceOf(db, store, c.env) }, 200);
}

export async function saveAppearance(c: Context<AppContext>) {
  const db = getDb(c.env.DB);
  const store = await queries.getStore(db);
  if (!store) throw new NotFoundError("Store");

  const body = ((c.req as any).valid?.("json") ??
    saveAppearanceSchema.parse(await c.req.json())) as z.infer<typeof saveAppearanceSchema>;
  const stored = await getThemeSettings(db, store.id, store.themeId);
  const saved = appearanceThemeSettingsOf(stored);
  const colorSchemes = (body.colorSchemes ?? saved?.colorSchemes ?? APPEARANCE_DEFAULT_SCHEMES) as AppearanceColorScheme[];
  const pageScheme = body.pageScheme ?? saved?.pageScheme ?? colorSchemes[0]?.id;
  if (!pageScheme) throw new ValidationError("The colors cannot be saved", ERROR_CODES.VALIDATION_FAILED);
  const merged = mergeAppearance(saved, {
    colorSchemes,
    pageScheme,
    hideLogo: body.hideLogo ?? saved?.hideLogo ?? false,
    hideHeaderText: body.hideHeaderText ?? saved?.hideHeaderText ?? false,
    hideMenu: body.hideMenu ?? saved?.hideMenu ?? false,
    searchEnabled: body.searchEnabled ?? saved?.searchEnabled ?? true,
    showHeaderHtml: body.showHeaderHtml ?? saved?.showHeaderHtml ?? true,
    showContactLinks: body.showContactLinks ?? saved?.showContactLinks ?? true,
    headerHtml: sanitizeHeaderHtml(body.headerHtml ?? saved?.headerHtml ?? ""),
    logoAlignment: body.logoAlignment ?? saved?.logoAlignment ?? "right",
    contactAlignment: normalizeContactAlignment(body.contactAlignment ?? saved?.contactAlignment),
    contactLayout: body.contactLayout ?? saved?.contactLayout ?? "row",
    sections: body.sections as AppearanceSectionEdits | undefined,
    chromeColors: body.chromeColors,
    contact: body.contact as AppearanceContact | undefined,
    detailColors: body.detailColors as AppearanceDetailColors | undefined,
  });
  if (merged.error || !merged.settings) {
    throw new ValidationError(merged.error ?? "The colors cannot be saved", ERROR_CODES.VALIDATION_FAILED);
  }

  if (body.texts) {
    const localeRows = await queries.listStoreLocales(db, store.id);
    const localeProblem = appearanceLocaleProblem(
      body.texts.locale,
      localeRows.map((row) => row.locale),
    );
    if (localeProblem) throw new ValidationError(localeProblem, ERROR_CODES.VALIDATION_FAILED);
    for (const [key, value] of Object.entries(body.texts.values)) {
      const problem = appearanceTextProblem(key, value);
      if (problem) throw new ValidationError(problem, ERROR_CODES.VALIDATION_FAILED);
    }
  }

  const flat = {
    ...stored,
    ...appearanceSettingsToTheme(merged.settings),
  } as Record<string, unknown>;
  for (const key of appearanceSettingsToRemove(merged.settings)) delete flat[key];
  await saveThemeSettings(db, store.id, store.themeId, flat);
  if (body.texts) {
    await saveContentOverrides(
      db,
      store.id,
      store.themeId,
      body.texts.locale,
      Object.entries(body.texts.values).map(([key, value]) => ({ key, value })),
    );
  }

  return c.json({ success: true, data: await appearanceOf(db, store, c.env) }, 200);
}

// ─── Routes ───────────────────────────────────────────────────────────────────

const getAppearanceRoute = defineRoute({
  method: "get",
  path: "/me/appearance",
  auth: "admin",
  tags: ["Store Settings"],
  summary: "Get the storefront's appearance",
  description:
    "Returns the store's color schemes, the scheme its page wears, its storefront switches, safe contact links and a safe header HTML strip, and the theme text it edited, per language.",
  operationId: "getStoreAppearance",
  responses: {
    200: {
      description: "The storefront's appearance",
      content: jsonContent(SuccessResponseSchema(appearanceSchema)),
    },
  },
  handler: getAppearance,
});

const saveAppearanceRoute = defineRoute({
  method: "put",
  path: "/me/appearance",
  auth: "admin",
  tags: ["Store Settings"],
  summary: "Save the storefront's appearance",
  description:
    "Saves only the fields supplied: the colors of the store's existing schemes and the scheme the page wears, its storefront switches, safe contact links and a safe header HTML strip, or one language's theme text edits. Fields left out keep their saved values; an empty text deletes the edit.",
  operationId: "saveStoreAppearance",
  body: saveAppearanceSchema,
  responses: {
    200: {
      description: "The storefront's appearance after the save",
      content: jsonContent(SuccessResponseSchema(appearanceSchema)),
    },
  },
  handler: saveAppearance,
});

export function registerAppearanceRoutes(router: OpenAPIHono<AppContext>) {
  router.openapi(getAppearanceRoute.route, getAppearanceRoute.handler);
  router.openapi(saveAppearanceRoute.route, saveAppearanceRoute.handler);
}
