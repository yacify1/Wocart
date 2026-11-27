import type { StoreContext } from "./store";
import { settingsOf } from "./settings";

export type SectionColors = {
  color: string | null;
  backgroundColor: string | null;
  buttonColor: string | null;
};

const HEX = /^#[0-9a-f]{6}$/i;

const hex = (value: unknown): string | null =>
  typeof value === "string" && HEX.test(value) ? value : null;

export function sectionColorsOf(
  store: StoreContext,
  prefix: string,
  textColorKey = `${prefix}TextColor`,
): SectionColors {
  const values = settingsOf(store) as unknown as Record<string, unknown>;
  return {
    color: hex(values[textColorKey]),
    backgroundColor: hex(values[`${prefix}BackgroundColor`]),
    buttonColor: hex(values[`${prefix}ButtonColor`]),
  };
}

export function sectionColorStyle(colors: SectionColors): string {
  const declarations: string[] = [];
  if (colors.color) declarations.push(`--clr-ink: ${colors.color}`, `--clr-text: ${colors.color}`);
  if (colors.backgroundColor) {
    declarations.push(
      `--clr-bg: ${colors.backgroundColor}`,
      `--clr-surface: ${colors.backgroundColor}`,
      `--clr-plate: ${colors.backgroundColor}`,
    );
  }
  if (colors.buttonColor) declarations.push(`--clr-primary: ${colors.buttonColor}`);
  return declarations.join("; ");
}
