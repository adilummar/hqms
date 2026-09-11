import { requireRole } from "@/lib/auth/helpers";
import { db } from "@/lib/db";
import { inventoryCustomFields } from "@/lib/db/schema";
import { desc, asc } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import { CustomFieldsManager } from "@/components/inventory/custom-fields-manager";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Stock Registration Settings | Admin" };

export default async function InventorySettingsPage() {
  await requireRole(["admin", "super_admin"]);

  const fields = await db.query.inventoryCustomFields.findMany({
    orderBy: [asc(inventoryCustomFields.displayOrder), desc(inventoryCustomFields.createdAt)],
  });

  return (
    <div>
      <PageHeader
        title="Stock Registration Settings"
        description="Configure custom fields and options for stock registration"
        breadcrumbs={[
          { label: "Admin" },
          { label: "Stock Registration", href: "/admin/inventory" },
          { label: "Settings" }
        ]}
      />

      <div className="bg-card border border-border rounded-lg p-5">
        <h3 className="font-playfair text-base font-semibold mb-1">Custom Fields</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Add custom fields like Serial Number, Brand, or Room to your stock items.
        </p>

        <CustomFieldsManager fields={fields} />
      </div>
    </div>
  );
}
