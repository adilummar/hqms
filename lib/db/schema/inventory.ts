import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  boolean,
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
  purchasingDate: timestamp("purchasing_date"),
  repairingDate: timestamp("repairing_date"),
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

export const inventoryItemsRelations = relations(inventoryItems, ({ one, many }) => ({
  category: one(inventoryCategories, {
    fields: [inventoryItems.categoryId],
    references: [inventoryCategories.id],
  }),
  lastUpdatedByUser: one(users, {
    fields: [inventoryItems.lastUpdatedBy],
    references: [users.id],
  }),
  customValues: many(inventoryCustomValues),
}));

// ── Custom Fields ────────────────────────────────────────────────────────────

export const inventoryCustomFields = pgTable("inventory_custom_fields", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 150 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(), // text, number, date, boolean, select
  options: text("options").array(), // for select
  isRequired: boolean("is_required").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  displayOrder: integer("display_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const inventoryCustomValues = pgTable("inventory_custom_values", {
  id: uuid("id").defaultRandom().primaryKey(),
  itemId: uuid("item_id")
    .notNull()
    .references(() => inventoryItems.id, { onDelete: "cascade" }),
  fieldId: uuid("field_id")
    .notNull()
    .references(() => inventoryCustomFields.id, { onDelete: "cascade" }),
  value: text("value"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const inventoryCustomValuesRelations = relations(inventoryCustomValues, ({ one }) => ({
  item: one(inventoryItems, {
    fields: [inventoryCustomValues.itemId],
    references: [inventoryItems.id],
  }),
  field: one(inventoryCustomFields, {
    fields: [inventoryCustomValues.fieldId],
    references: [inventoryCustomFields.id],
  }),
}));
