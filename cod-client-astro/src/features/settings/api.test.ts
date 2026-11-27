import { beforeEach, describe, expect, it, vi } from "vitest";

const seam = vi.hoisted(() => {
  class ApiError extends Error {
    constructor(message: string, public status: number, public code?: string) {
      super(message);
    }
  }
  return { apiFetch: vi.fn(), ApiError };
});
vi.mock("@/lib/api", () => ({ apiFetch: seam.apiFetch, ApiError: seam.ApiError }));

import { getAppearance, getMyStore, saveAppearance, updateMyStore } from "./api";

describe("settings API adapters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("unwraps the store config detail envelope", async () => {
    const store = { id: "store-1", name: "My Store" };
    seam.apiFetch.mockResolvedValue({ success: true, data: store });
    await expect(getMyStore()).resolves.toEqual(store);
    expect(seam.apiFetch).toHaveBeenCalledWith("/api/stores/me");
  });

  it("patches the store and unwraps the updated config", async () => {
    const store = { id: "store-1", name: "Renamed" };
    seam.apiFetch.mockResolvedValue({ success: true, data: store });
    await expect(updateMyStore({ name: "Renamed", cartEnabled: true })).resolves.toEqual(store);
    expect(seam.apiFetch).toHaveBeenCalledWith("/api/stores/me", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ name: "Renamed", cartEnabled: true }) }));
  });

  it("unwraps the appearance envelope and sends only the supplied save fields", async () => {
    const appearance = { themeKey: "theme-00", sections: {} };
    seam.apiFetch.mockResolvedValue({ success: true, data: appearance });

    await expect(getAppearance()).resolves.toEqual(appearance);
    await expect(saveAppearance({ sections: { hero: { hidden: true } } })).resolves.toEqual(appearance);
    expect(seam.apiFetch).toHaveBeenCalledWith("/api/stores/me/appearance", expect.objectContaining({
      method: "PUT",
      body: JSON.stringify({ sections: { hero: { hidden: true } } }),
    }));
  });

  it.each([
    ["a missing data object", { success: true }],
    ["a null data object", { success: true, data: null }],
    ["an unsuccessful envelope", { success: false, data: { themeKey: "theme-00" } }],
  ])("refuses %s before it can reach the Settings island", async (_label, envelope) => {
    seam.apiFetch.mockResolvedValue(envelope);
    await expect(getAppearance()).rejects.toMatchObject({ code: "APPEARANCE_MALFORMED" });
  });
});
