import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { classTrackEnum } from "./enums";
import { users } from "./users";
import { academicYears } from "./settings";
import { relations } from "drizzle-orm";

export const classes = pgTable("classes", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 20 }).notNull(), // "HA", "HB", "Class 4", "M1"
  track: classTrackEnum("track").notNull(),
  tutorId: uuid("tutor_id").references(() => users.id, {
    onDelete: "set null",
  }),
  academicYearId: uuid("academic_year_id")
    .notNull()
    .references(() => academicYears.id, { onDelete: "restrict" }),
  capacity: integer("capacity").default(30),
  isActive: boolean("is_active").default(true).notNull(),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const classesRelations = relations(classes, ({ one }) => ({
  tutor: one(users, { fields: [classes.tutorId], references: [users.id] }),
  academicYear: one(academicYears, {
    fields: [classes.academicYearId],
    references: [academicYears.id],
  }),
}));
