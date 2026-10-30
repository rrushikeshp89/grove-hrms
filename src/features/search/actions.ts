"use server";

import { getCurrentUser } from "@/server/session";

import { searchAll, type SearchHit } from "./queries";

/**
 * Search for the command palette. Not a mutation, so it skips createAction;
 * it still answers only for a signed-in person and applies their visibility.
 */
export async function searchEverything(q: string): Promise<SearchHit[]> {
  const user = await getCurrentUser();
  if (!user || typeof q !== "string") return [];
  return searchAll(user, q);
}
