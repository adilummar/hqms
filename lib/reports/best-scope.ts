// Scope of the Best Student / Best Class reports: ONLY the three Hifz classes HA, HB, HC.
// Class records are looked up by their real name + Hifz track (names are not unique across
// academic years, so this can return several rows; ids are never assumed).
import { db } from "@/lib/db";
import { classes } from "@/lib/db/schema";
import { and, asc, eq, inArray } from "drizzle-orm";

export const BEST_REPORT_CLASS_NAMES = ["HA", "HB", "HC"] as const;

/** Active Hifz classes named HA / HB / HC. Used for BOTH reports and for the class filter. */
export async function getBestReportClasses() {
  return db.query.classes.findMany({
    where: and(
      inArray(classes.name, [...BEST_REPORT_CLASS_NAMES]),
      eq(classes.track, "hifz"),
      eq(classes.isActive, true)
    ),
    orderBy: [asc(classes.displayOrder), asc(classes.name)],
  });
}
