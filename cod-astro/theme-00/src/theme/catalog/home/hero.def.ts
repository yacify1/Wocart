import { defineComponent } from "@wocart/theme";
import { FIELD, GROUP, OPTION, SECTION } from "../labels";
import Hero from "@/theme/components/home/Hero.astro";
import { SCHEME_OF } from "@/theme/appearance";
import { copyOverrides, schemeField, styleField } from "../shared";

/**
 * The page's first view: a large photo — the merchant's or the editor's — beside
 * the store's promise and two actions. Without one, the promise stands alone.
 */
export const hero = defineComponent({
  type: "hero",
  capabilities: { insertable: true, surfaces: ["home"] },
  component: Hero,
  label: SECTION.hero,
  group: GROUP.home,
  placement: "section",
  fields: [
    { key: "heroTitle", kind: "text", label: FIELD.title, contentKey: "heroTitle" },
    { key: "heroSubtitle", kind: "textarea", label: FIELD.subtitle, contentKey: "heroSubtitle" },
    { key: "heroCtaPrimary", kind: "text", label: FIELD.primaryButton, contentKey: "heroCtaPrimary" },
    { key: "ctaPrimaryHref", kind: "url", label: FIELD.primaryButtonLink, default: "/products" },
    { key: "heroCtaSecondary", kind: "text", label: FIELD.secondaryButton, contentKey: "heroCtaSecondary" },
    { key: "ctaSecondaryHref", kind: "url", label: FIELD.secondaryButtonLink, default: "#best-sellers" },
    { key: "image", kind: "image", label: FIELD.photo },
    {
      key: "photoSide",
      kind: "select",
      label: FIELD.photoSide,
      options: ["end", "start"],
      optionLabels: { end: OPTION.end, start: OPTION.start },
      default: "end",
      display: "segmented",
    },
    schemeField(SCHEME_OF.sand),
    styleField({ size: { width: { base: "full" } } }),
  ],
  load: async ({ context, props }) => ({ content: copyOverrides(context.content, props) }),
});
