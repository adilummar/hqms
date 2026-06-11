import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { users } from "./users";
import { relations } from "drizzle-orm";

// ── Inventory Categories ───────────────────────────────────────────────────────
// e.g. "Stationery", "Cleaning Supplies", "Kitchen", "Sports Equipment"

export const inventoryCategories = pgTable("inventory_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  icon: varchar("icon", { length: 10 }).default("📦"), // emoji icon
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Inventory Items ────────────────────────────────────────────────────────────

export const inventoryItems = pgTable("inventory_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => inventoryCategories.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 150 }).notNull(),
  description: text("description"),
  quantity: integer("quantity").notNull().default(0),
  unit: varchar("unit", { length: 30 }).default("pcs"), // pcs, kg, litres, boxes…
  minStockAlert: integer("min_stock_alert").default(0), // 0 = no alert
  notes: text("notes"),
  lastUpdatedBy: uuid("last_updated_by")
    .references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Relations ─────────────────────────────────────────────────────────────────

export const inventoryCategoriesRelations = relations(
  inventoryCategories,
  ({ one, many }) => ({
    createdByUser: one(users, {
      fields: [inventoryCategories.createdBy],
      references: [users.id],
    }),
    items: many(inventoryItems),
  })
);

export const inventoryItemsRelations = relations(inventoryItems, ({ one }) => ({
  category: one(inventoryCategories, {
    fields: [inventoryItems.categoryId],
    references: [inventoryCategories.id],
  }),
  lastUpdatedByUser: one(users, {
    fields: [inventoryItems.lastUpdatedBy],
    references: [users.id],
  }),
}));
