import { requireRole } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { inventoryCategories, inventoryItems } from "@/lib/db/schema";
import { desc, eq, count, sum, lte, and, gt } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import { CategoryManager } from "@/components/inventory/category-manager";
import { ItemsManager } from "@/components/inventory/items-manager";
import { AlertTriangle, Package, Tag } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Inventory | Admin" };

export default async function InventoryPage() {
  await requireRole(["admin", "super_admin"]);

  const categories = await db.query.inventoryCategories.findMany({
    orderBy: [desc(inventoryCategories.createdAt)],
    with: {
      items: {
        orderBy: [desc(inventoryItems.updatedAt)],
      },
    },
  });

  // Summary stats
  const totalItems = categories.reduce((acc, c) => acc + c.items.length, 0);
  const totalCategories = categories.length;
  const lowStockItems = categories.flatMap((c) =>
    c.items.filter((i) => i.minStockAlert && i.minStockAlert > 0 && i.quantity <= i.minStockAlert)
  );

  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Track stock, supplies and equipment across the institution"
        breadcrumbs={[{ label: "Admin" }, { label: "Inventory" }]}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
            <Tag size={18} className="text-muted-foreground" />
          </div>
          <div>
            <p className="text-2xl font-playfair font-bold text-foreground">{totalCategories}</p>
            <p className="text-xs text-muted-foreground">Categories</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
            <Package size={18} className="text-muted-foreground" />
          </div>
          <div>
            <p className="text-2xl font-playfair font-bold text-foreground">{totalItems}</p>
            <p className="text-xs text-muted-foreground">Total Items</p>
          </div>
        </div>
        <div className={`border rounded-lg p-4 flex items-center gap-3 ${lowStockItems.length > 0 ? "bg-amber-50 border-amber-200" : "bg-card border-border"}`}>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${lowStockItems.length > 0 ? "bg-amber-100" : "bg-muted"}`}>
            <AlertTriangle size={18} className={lowStockItems.length > 0 ? "text-amber-600" : "text-muted-foreground"} />
          </div>
          <div>
            <p className={`text-2xl font-playfair font-bold ${lowStockItems.length > 0 ? "text-amber-700" : "text-foreground"}`}>
              {lowStockItems.length}
            </p>
            <p className={`text-xs ${lowStockItems.length > 0 ? "text-amber-600" : "text-muted-foreground"}`}>Low Stock Alerts</p>
          </div>
        </div>
      </div>

      {/* Low stock banner */}
      {lowStockItems.length > 0 && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm font-medium text-amber-800 mb-2 flex items-center gap-2">
            <AlertTriangle size={14} /> Low Stock Items
          </p>
          <div className="flex flex-wrap gap-2">
            {lowStockItems.map((item) => (
              <span key={item.id} className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 rounded-full">
                {item.name} — {item.quantity} {item.unit} left
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Category manager */}
        <div className="lg:col-span-1">
          <div className="bg-card border border-border rounded-lg p-5">
            <h3 className="font-playfair text-base font-semibold mb-4">Categories</h3>
            <CategoryManager
              categories={categories.map((c) => ({
                id: c.id,
                name: c.name,
                description: c.description,
                icon: c.icon,
              }))}
            />
          </div>
        </div>

        {/* Right: Items per category */}
        <div className="lg:col-span-2 space-y-4">
          {categories.length === 0 ? (
            <div className="bg-card border border-dashed border-border rounded-lg p-12 text-center">
              <Package size={32} className="mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground font-medium">No categories yet</p>
              <p className="text-xs text-muted-foreground mt-1">Add a category on the left to get started.</p>
            </div>
          ) : (
            categories.map((cat) => (
              <div key={cat.id} className="bg-card border border-border rounded-lg overflow-hidden">
                {/* Category header */}
                <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-3">
                  <span className="text-xl">{cat.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm">{cat.name}</p>
                    {cat.description && (
                      <p className="text-xs text-muted-foreground">{cat.description}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {cat.items.length} item{cat.items.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Items */}
                <div className="p-4">
                  <ItemsManager
                    categoryId={cat.id}
                    categoryName={cat.name}
                    items={cat.items.map((i) => ({
                      id: i.id,
                      categoryId: i.categoryId,
                      name: i.name,
                      description: i.description,
                      quantity: i.quantity,
                      unit: i.unit,
                      minStockAlert: i.minStockAlert,
                      notes: i.notes,
                    }))}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
