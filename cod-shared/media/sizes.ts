import { inArray } from "drizzle-orm";
import { media } from "../db/schema";
import type { AppDb } from "../db/client";
import type { MediaSize } from "./views";

const MAX_KEYS = 90;

/** The stored dimensions of these media keys, for callers that show a MediaImage by key. */
export async function loadMediaSizes(db: AppDb, keys: readonly (string | null | undefined)[]): Promise<Map<string, MediaSize>> {
  const unique = [...new Set(keys.filter((key): key is string => Boolean(key)))];
  const sizes = new Map<string, MediaSize>();
  for (let i = 0; i < unique.length; i += MAX_KEYS) {
    const rows = await db
      .select({ key: media.key, width: media.width, height: media.height })
      .from(media)
      .where(inArray(media.key, unique.slice(i, i + MAX_KEYS)))
      .all();
    for (const row of rows) sizes.set(row.key, { width: row.width, height: row.height });
  }
  return sizes;
}
