/**
 * Theme-00's global settings: what a merchant chooses once for the whole
 * store — its color schemes and which one the page wears, the faces for
 * headings and text, the corners, and the shape of a product card's photo —
 * read from `StoreConfig.themeSettings` against this declaration
 * (`resolveThemeSettings`). Every setting has a default, so a store that saved
 * nothing renders exactly as designed. The merchant edits them in the theme
 * editor (CodFlow Cloud); this theme only reads them.
 *
 * The header and the footer — their menus, the announcement — are sections of
 * the store's header and footer areas, edited where they are seen. The home
 * section hide/photo switches are written by the dashboard's Appearance tab;
 * declaring them here lets the same renderer read and validate them.
 */
import type { LocalizedText, SettingsGroup } from "@wocart/theme";
import { BODY_FONT, CARD_RATIOS, CORNERS, DEFAULT_SCHEMES, FONT_FAMILIES, HEADING_FONT, PAGE_SCHEME } from "./appearance";
import { HOME_SETTING, OPTION, SETTING, SETTINGS_GROUP } from "./catalog/labels";

const colorField = (key: string, label: LocalizedText) => ({ key, kind: "color" as const, label });
const sectionColorFields = (
  prefix: string,
  labels: { color: LocalizedText; backgroundColor: LocalizedText; buttonColor: LocalizedText },
  colorKey = `${prefix}TextColor`,
) => [
  colorField(colorKey, labels.color),
  colorField(`${prefix}BackgroundColor`, labels.backgroundColor),
  colorField(`${prefix}ButtonColor`, labels.buttonColor),
];

export const THEME_SETTINGS = [
  {
    key: "colors",
    label: SETTINGS_GROUP.colors,
    fields: [
      { key: "colorSchemes", kind: "colorSchemes", label: SETTING.colorSchemes, default: DEFAULT_SCHEMES },
      { key: "pageScheme", kind: "colorScheme", label: SETTING.pageScheme, default: PAGE_SCHEME },
      { key: "secondaryButtonColor", kind: "color", label: SETTING.secondaryButtonColor },
      { key: "offerColor", kind: "color", label: SETTING.offerColor },
      { key: "priceOldColor", kind: "color", label: SETTING.priceOldColor },
      { key: "priceNewColor", kind: "color", label: SETTING.priceNewColor },
    ],
  },
  {
    key: "typography",
    label: SETTINGS_GROUP.typography,
    fields: [
      { key: "headingFont", kind: "select", label: SETTING.headingFont, options: FONT_FAMILIES, default: HEADING_FONT },
      { key: "font", kind: "select", label: SETTING.font, options: FONT_FAMILIES, default: BODY_FONT },
    ],
  },
  {
    key: "shape",
    label: SETTINGS_GROUP.shape,
    fields: [
      {
        key: "corners",
        kind: "select",
        label: SETTING.corners,
        options: CORNERS,
        optionLabels: { sharp: OPTION.sharp, soft: OPTION.soft, round: OPTION.round },
        default: "soft",
        display: "segmented",
      },
    ],
  },
  {
    key: "product-cards",
    label: SETTINGS_GROUP.productCards,
    fields: [
      {
        key: "cardImageRatio",
        kind: "select",
        label: SETTING.cardImageRatio,
        options: CARD_RATIOS,
        optionLabels: { square: OPTION.square, portrait: OPTION.portrait, landscape: OPTION.landscape },
        default: "portrait",
        display: "segmented",
      },
      { key: "cardButton", kind: "boolean", label: SETTING.cardButton, default: true },
    ],
  },
  {
    key: "storefront",
    label: SETTINGS_GROUP.storefront,
    fields: [
      { key: "hideLogo", kind: "boolean", label: SETTING.hideLogo, default: false },
      { key: "hideHeaderText", kind: "boolean", label: SETTING.hideHeaderText, default: false },
      { key: "hideMenu", kind: "boolean", label: SETTING.hideMenu, default: false },
      { key: "searchEnabled", kind: "boolean", label: SETTING.searchEnabled, default: true },
      { key: "hideHeroImages", kind: "boolean", label: SETTING.hideHeroImages, default: false },
      { key: "headerHtml", kind: "textarea", label: SETTING.headerHtml, default: "" },
      { key: "showHeaderHtml", kind: "boolean", label: SETTING.showHeaderHtml, default: true },
      { key: "showContactLinks", kind: "boolean", label: SETTING.showContactLinks, default: true },
      { key: "contactPhone", kind: "url", label: SETTING.contactPhone },
      { key: "contactEmail", kind: "url", label: SETTING.contactEmail },
      { key: "instagramUrl", kind: "url", label: SETTING.instagramUrl },
      { key: "facebookUrl", kind: "url", label: SETTING.facebookUrl },
      { key: "tiktokUrl", kind: "url", label: SETTING.tiktokUrl },
      colorField("announcementTextColor", SETTING.announcementTextColor),
      colorField("announcementBackgroundColor", SETTING.announcementBackgroundColor),
      colorField("announcementButtonColor", SETTING.announcementButtonColor),
      colorField("headerTextColor", SETTING.headerTextColor),
      colorField("headerBackgroundColor", SETTING.headerBackgroundColor),
      colorField("headerButtonColor", SETTING.headerButtonColor),
      colorField("headerHtmlTextColor", SETTING.headerHtmlTextColor),
      colorField("headerHtmlBackgroundColor", SETTING.headerHtmlBackgroundColor),
      colorField("headerHtmlButtonColor", SETTING.headerHtmlButtonColor),
      {
        key: "logoAlignment",
        kind: "select",
        label: SETTING.logoAlignment,
        options: ["right", "left", "center"],
        optionLabels: { right: OPTION.right, left: OPTION.left, center: OPTION.center },
        default: "right",
        display: "segmented",
      },
      {
        key: "contactAlignment",
        kind: "select",
        label: SETTING.contactAlignment,
        options: ["left", "right"],
        optionLabels: { left: OPTION.left, right: OPTION.right },
        default: "right",
        display: "segmented",
      },
    ],
  },
  {
    key: "home-sections",
    label: SETTINGS_GROUP.homeSections,
    fields: [
      { key: "homeHeroHidden", kind: "boolean", label: HOME_SETTING.hero.hidden, default: false },
      { key: "homeHeroImage", kind: "image", label: HOME_SETTING.hero.image },
      ...sectionColorFields("homeHero", HOME_SETTING.hero),
      { key: "homeMarqueeHidden", kind: "boolean", label: HOME_SETTING.marquee.hidden, default: false },
      { key: "homeMarqueeImage", kind: "image", label: HOME_SETTING.marquee.image },
      { key: "homeMarqueeText", kind: "textarea", label: HOME_SETTING.marquee.text, default: "" },
      ...sectionColorFields("homeMarquee", HOME_SETTING.marquee, "homeMarqueeColor"),
      { key: "homeMarqueeAccentColor", kind: "color", label: HOME_SETTING.marquee.accentColor },
      { key: "homeCategoryCardsHidden", kind: "boolean", label: HOME_SETTING["category-cards"].hidden, default: false },
      { key: "homeCategoryCardsImage", kind: "image", label: HOME_SETTING["category-cards"].image },
      ...sectionColorFields("homeCategoryCards", HOME_SETTING["category-cards"]),
      { key: "homeProductTabsHidden", kind: "boolean", label: HOME_SETTING["product-tabs"].hidden, default: false },
      { key: "homeProductTabsImage", kind: "image", label: HOME_SETTING["product-tabs"].image },
      ...sectionColorFields("homeProductTabs", HOME_SETTING["product-tabs"]),
      { key: "homeImageBannerHidden", kind: "boolean", label: HOME_SETTING["image-banner"].hidden, default: false },
      { key: "homeImageBannerImage", kind: "image", label: HOME_SETTING["image-banner"].image },
      ...sectionColorFields("homeImageBanner", HOME_SETTING["image-banner"]),
      { key: "homeHowItWorksHidden", kind: "boolean", label: HOME_SETTING["how-it-works"].hidden, default: false },
      { key: "homeHowItWorksImage", kind: "image", label: HOME_SETTING["how-it-works"].image },
      ...sectionColorFields("homeHowItWorks", HOME_SETTING["how-it-works"]),
      { key: "homeCustomerTestimonialsHidden", kind: "boolean", label: HOME_SETTING["customer-testimonials"].hidden, default: false },
      { key: "homeCustomerTestimonialsImage", kind: "image", label: HOME_SETTING["customer-testimonials"].image },
      ...sectionColorFields("homeCustomerTestimonials", HOME_SETTING["customer-testimonials"]),
      { key: "homeFeaturesBarHidden", kind: "boolean", label: HOME_SETTING["features-bar"].hidden, default: false },
      { key: "homeFeaturesBarImage", kind: "image", label: HOME_SETTING["features-bar"].image },
      ...sectionColorFields("homeFeaturesBar", HOME_SETTING["features-bar"]),
    ],
  },
] as const satisfies readonly SettingsGroup[];
