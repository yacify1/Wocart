import { ApiError, apiFetch } from "@/lib/api";
import type {
  AppearanceChromeColors,
  AppearanceColorScheme,
  AppearanceContact,
  AppearanceDetailColors,
  AppearanceLogoAlignment,
  AppearanceSectionEdits,
} from "../../../../cod-shared/stores/appearance";
import type { StoreLocale } from "../../../../cod-shared/i18n/locales";
import type { StoreAppearance, StoreConfig, UpdateStoreData } from "./types";
import type { StoreSummary } from "./store-summary";

interface DataEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

function json(init: RequestInit = {}): RequestInit {
  return {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  };
}

export async function getMyStore() {
  return (await apiFetch<DataEnvelope<StoreConfig>>("/api/stores/me")).data;
}

/** The store's name, domain and logo, which every signed-in member may read. */
export async function getStoreSummary() {
  return (await apiFetch<DataEnvelope<StoreSummary>>("/api/stores/me/summary")).data;
}

export async function updateMyStore(data: UpdateStoreData) {
  return (await apiFetch<DataEnvelope<StoreConfig>>("/api/stores/me", json({ method: "PATCH", body: JSON.stringify(data) }))).data;
}

export interface SaveAppearanceInput {
  colorSchemes?: AppearanceColorScheme[];
  pageScheme?: string;
  hideLogo?: boolean;
  hideHeaderText?: boolean;
  hideMenu?: boolean;
  searchEnabled?: boolean;
  headerHtml?: string;
  logoAlignment?: AppearanceLogoAlignment;
  sections?: AppearanceSectionEdits;
  chromeColors?: AppearanceChromeColors;
  contact?: AppearanceContact;
  detailColors?: AppearanceDetailColors;
  /** One language's text edits; an empty string removes that edit. */
  texts?: { locale: StoreLocale; values: Record<string, string> };
}

async function appearanceData(path: string, init?: RequestInit): Promise<StoreAppearance> {
  const envelope = (await apiFetch<unknown>(path, init)) as Partial<DataEnvelope<StoreAppearance>> | null;
  if (
    !envelope ||
    typeof envelope !== "object" ||
    envelope.success === false ||
    !envelope.data ||
    typeof envelope.data !== "object"
  ) {
    throw new ApiError("The appearance response was malformed", 500, "APPEARANCE_MALFORMED");
  }
  return envelope.data;
}

export async function getAppearance() {
  return appearanceData("/api/stores/me/appearance");
}

export async function saveAppearance(data: SaveAppearanceInput) {
  return appearanceData(
    "/api/stores/me/appearance",
    json({ method: "PUT", body: JSON.stringify(data) }),
  );
}
