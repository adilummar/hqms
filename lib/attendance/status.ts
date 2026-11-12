// Student attendance statuses and the pure rules shared by the roster UI and the reports.
// "friday" / "holiday" are OFF-DAY statuses: the session was not a working session, so it is
// excluded from attendance % (like unmarked) and is never treated as present or absent.

export type RosterStatus = "present" | "absent" | "friday" | "holiday" | "unmarked";

export const isOffStatus = (s: string | null | undefined): s is "friday" | "holiday" => s === "friday" || s === "holiday";

/** Sets every student of ONE session to `status`. Returns a new object; other sessions are separate state and never touched. */
export function applyToAll(entries: Record<string, RosterStatus>, status: RosterStatus): Record<string, RosterStatus> {
  const next: Record<string, RosterStatus> = {};
  for (const id of Object.keys(entries)) next[id] = status;
  return next;
}

/**
 * Day view of FN + AN with off-days taken out:
 *  - both sessions off  → the day is an off day ("friday" / "holiday", "holiday" if they differ)
 *  - one session off    → the worked session decides (it counts as the whole working day)
 *  - neither off        → unchanged
 */
export function collapseOffSessions<T extends string>(
  fn: T,
  an: T
): { fn: T; an: T; offDay: "friday" | "holiday" | null } {
  const fnOff = isOffStatus(fn);
  const anOff = isOffStatus(an);
  if (fnOff && anOff) return { fn, an, offDay: fn === an ? (fn as "friday" | "holiday") : "holiday" };
  if (fnOff) return { fn: an, an, offDay: null };
  if (anOff) return { fn, an: fn, offDay: null };
  return { fn, an, offDay: null };
}
