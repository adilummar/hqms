"use client";

import { useState, useTransition } from "react";
import { createItem, updateItem, deleteItem, adjustQuantity } from "@/lib/actions/inventory";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, Check, Minus, AlertTriangle, ChevronDown, ChevronRight, Settings } from "lucide-react";
import Link from "next/link";

const UNITS = ["pcs", "kg", "g", "litres", "ml", "boxes", "packets", "reams", "rolls", "pairs", "sets"];

export interface CustomField {
  id: string;
  name: string;
  type: string;
  options: string[] | null;
  isRequired: boolean;
  isActive: boolean;
}

type FormData = {
  name: string;
  description: string;
  quantity: string;
  unit: string;
  minStockAlert: string;
  notes: string;
  purchasingDate: string;
  repairingDate: string;
  customValues: Record<string, string>;
};

function ItemForm({
  data,
  setData,
  customFields,
  onSubmit,
  onCancel,
  submitLabel,
  isPending,
}: {
  data: FormData;
  setData: (d: FormData) => void;
  customFields: CustomField[];
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  submitLabel: string;
  isPending: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4 p-5 bg-muted/20 border border-border rounded-lg">
      <h4 className="text-sm font-semibold border-b border-border pb-2">Standard Information</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Item Name *</label>
          <input
            value={data.name}
            onChange={(e) => setData({ ...data, name: e.target.value })}
            placeholder="e.g. A4 Paper"
            required
            className="w-full h-9 px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Description</label>
          <input
            value={data.description}
            onChange={(e) => setData({ ...data, description: e.target.value })}
            placeholder="Optional details"
            className="w-full h-9 px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Quantity *</label>
            <input
              type="number"
              min="0"
              value={data.quantity}
              onChange={(e) => setData({ ...data, quantity: e.target.value })}
              required
              className="w-full h-9 px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Unit</label>
            <select
              value={data.unit}
              onChange={(e) => setData({ ...data, unit: e.target.value })}
              className="w-full h-9 px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
            >
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Low Stock Alert (0 = off)</label>
          <input
            type="number"
            min="0"
            value={data.minStockAlert}
            onChange={(e) => setData({ ...data, minStockAlert: e.target.value })}
            className="w-full h-9 px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Purchasing Date (Optional)</label>
          <input
            type="date"
            value={data.purchasingDate}
            onChange={(e) => setData({ ...data, purchasingDate: e.target.value })}
            className="w-full h-9 px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Repairing Date (Optional)</label>
          <input
            type="date"
            value={data.repairingDate}
            onChange={(e) => setData({ ...data, repairingDate: e.target.value })}
            className="w-full h-9 px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs text-muted-foreground mb-1">Notes</label>
          <input
            value={data.notes}
            onChange={(e) => setData({ ...data, notes: e.target.value })}
            placeholder="Any extra notes"
            className="w-full h-9 px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
          />
        </div>
      </div>

      {customFields.length > 0 && (
        <>
          <h4 className="text-sm font-semibold border-b border-border pb-2 mt-6 pt-2">Additional Information</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {customFields.map(field => {
              const val = data.customValues[field.id] ?? "";
              return (
                <div key={field.id}>
                  <label className="block text-xs text-muted-foreground mb-1">
                    {field.name} {field.isRequired && "*"}
                  </label>
                  {field.type === "select" && field.options ? (
                    <select
                      value={val}
                      onChange={(e) => setData({ ...data, customValues: { ...data.customValues, [field.id]: e.target.value }})}
                      required={field.isRequired}
                      className="w-full h-9 px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
                    >
                      <option value="">-- Select --</option>
                      {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : field.type === "boolean" ? (
                    <select
                      value={val}
                      onChange={(e) => setData({ ...data, customValues: { ...data.customValues, [field.id]: e.target.value }})}
                      required={field.isRequired}
                      className="w-full h-9 px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
                    >
                      <option value="">-- Select --</option>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  ) : (
                    <input
                      type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"}
                      value={val}
                      onChange={(e) => setData({ ...data, customValues: { ...data.customValues, [field.id]: e.target.value }})}
                      required={field.isRequired}
                      className="w-full h-9 px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="flex gap-2 justify-end pt-4 border-t border-border mt-6">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs border border-border rounded-sm hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending || !data.name}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-foreground text-background text-xs font-medium rounded-sm disabled:opacity-50"
        >
          {isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

interface Item {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  quantity: number;
  unit: string | null;
  minStockAlert: number | null;
  notes: string | null;
  purchasingDate: string | null;
  repairingDate: string | null;
  customValues: Record<string, string>;
}

interface Props {
  categoryId: string;
  categoryName: string;
  items: Item[];
  customFields: CustomField[];
}

const BLANK_FORM: FormData = { 
  name: "", description: "", quantity: "0", unit: "pcs", minStockAlert: "0", notes: "",
  purchasingDate: "", repairingDate: "", customValues: {}
};

export function ItemsManager({ categoryId, categoryName, items: initial, customFields }: Props) {
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<FormData>(BLANK_FORM);
  const [editForm, setEditForm] = useState<FormData & { id: string }>({ id: "", ...BLANK_FORM });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function startEdit(item: Item) {
    setEditingId(item.id);
    setEditForm({
      id: item.id,
      name: item.name,
      description: item.description ?? "",
      quantity: String(item.quantity),
      unit: item.unit ?? "pcs",
      minStockAlert: String(item.minStockAlert ?? 0),
      notes: item.notes ?? "",
      purchasingDate: item.purchasingDate ?? "",
      repairingDate: item.repairingDate ?? "",
      customValues: item.customValues ?? {},
    });
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createItem({
        categoryId,
        name: form.name,
        description: form.description,
        quantity: Number(form.quantity),
        unit: form.unit,
        minStockAlert: Number(form.minStockAlert),
        notes: form.notes,
        purchasingDate: form.purchasingDate || null,
        repairingDate: form.repairingDate || null,
        customValues: form.customValues,
      });
      if (result.success && result.data) {
        setItems((prev) => [...prev, { ...result.data, purchasingDate: form.purchasingDate || null, repairingDate: form.repairingDate || null, customValues: form.customValues }]);
        setForm(BLANK_FORM);
        setShowAdd(false);
        toast.success(`"${result.data.name}" added`);
      } else {
        toast.error("Failed to add item");
      }
    });
  }

  function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await updateItem({
        id: editForm.id,
        name: editForm.name,
        description: editForm.description,
        quantity: Number(editForm.quantity),
        unit: editForm.unit,
        minStockAlert: Number(editForm.minStockAlert),
        notes: editForm.notes,
        purchasingDate: editForm.purchasingDate || null,
        repairingDate: editForm.repairingDate || null,
        customValues: editForm.customValues,
      });
      if (result.success && result.data) {
        setItems((prev) => prev.map((i) => (i.id === editForm.id ? { ...result.data, purchasingDate: editForm.purchasingDate || null, repairingDate: editForm.repairingDate || null, customValues: editForm.customValues } : i)));
        setEditingId(null);
        toast.success("Item updated");
      } else {
        toast.error("Failed to update");
      }
    });
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`Remove "${name}" from stock?`)) return;
    startTransition(async () => {
      await deleteItem(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast.success("Item removed");
    });
  }

  function handleAdjust(id: string, delta: number) {
    startTransition(async () => {
      const result = await adjustQuantity(id, delta);
      if (result.success && result.data) {
        setItems((prev) =>
          prev.map((i) => (i.id === id ? { ...i, quantity: result.data!.quantity } : i))
        );
      }
    });
  }

  return (
    <div className="space-y-2">
      {items.length === 0 && !showAdd && (
        <p className="text-xs text-muted-foreground text-center py-4">
          No items yet. Add your first item below.
        </p>
      )}

      {items.map((item) => {
        const isLow =
          item.minStockAlert && item.minStockAlert > 0 && item.quantity <= item.minStockAlert;
        
        const hasExtraInfo = Boolean(item.purchasingDate || item.repairingDate || Object.keys(item.customValues).length > 0 || item.notes);
        const isExpanded = expandedId === item.id;

        if (editingId === item.id) {
          return (
            <ItemForm
              key={`edit-${item.id}`}
              data={editForm}
              setData={(d) => setEditForm({ ...d, id: editForm.id })}
              customFields={customFields}
              onSubmit={handleUpdate}
              onCancel={() => setEditingId(null)}
              submitLabel="Save Changes"
              isPending={isPending}
            />
          );
        }

        return (
          <div
            key={item.id}
            className={`flex flex-col border rounded-lg group transition-colors overflow-hidden ${
              isLow ? "border-amber-300 bg-amber-50/40" : "border-border hover:bg-muted/10 bg-card"
            }`}
          >
            <div className="flex items-center gap-3 px-3 py-3">
              <div className="w-8 flex justify-center shrink-0">
                {isLow ? <AlertTriangle size={14} className="text-amber-500" /> : <div className="w-3.5 h-3.5 bg-border rounded-full opacity-20" />}
              </div>

              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => hasExtraInfo && setExpandedId(isExpanded ? null : item.id)}>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{item.name}</p>
                  {item.description && (
                    <p className="text-xs text-muted-foreground hidden md:block truncate">— {item.description}</p>
                  )}
                </div>
                {hasExtraInfo && (
                  <p className="text-[10px] text-primary/70 font-medium flex items-center gap-1 mt-1">
                    {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                    {isExpanded ? "Hide Details" : "View Details"}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleAdjust(item.id, -1)}
                  disabled={isPending || item.quantity === 0}
                  className="w-6 h-6 rounded-sm border border-border flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-30"
                >
                  <Minus size={10} />
                </button>
                <div className="text-center min-w-[60px]">
                  <span className={`text-sm font-jetbrains font-semibold ${isLow ? "text-amber-700" : "text-foreground"}`}>
                    {item.quantity}
                  </span>
                  <span className="text-xs text-muted-foreground ml-1">{item.unit}</span>
                </div>
                <button
                  onClick={() => handleAdjust(item.id, 1)}
                  disabled={isPending}
                  className="w-6 h-6 rounded-sm border border-border flex items-center justify-center hover:bg-muted transition-colors"
                >
                  <Plus size={10} />
                </button>
              </div>

              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                <button
                  onClick={() => startEdit(item)}
                  className="p-1.5 hover:bg-muted rounded-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => handleDelete(item.id, item.name)}
                  disabled={isPending}
                  className="p-1.5 hover:bg-red-50 rounded-sm text-muted-foreground hover:text-red-600 transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {/* Expanded details */}
            {isExpanded && hasExtraInfo && (
              <div className="px-12 py-3 border-t border-border/50 bg-muted/10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6">
                {item.purchasingDate && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Purchasing Date</p>
                    <p className="text-xs font-medium">{new Date(item.purchasingDate).toLocaleDateString("en-IN")}</p>
                  </div>
                )}
                {item.repairingDate && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Repairing Date</p>
                    <p className="text-xs font-medium">{new Date(item.repairingDate).toLocaleDateString("en-IN")}</p>
                  </div>
                )}
                {Object.entries(item.customValues).map(([fieldId, val]) => {
                  const fieldDef = customFields.find(f => f.id === fieldId);
                  if (!fieldDef || !val) return null;
                  return (
                    <div key={fieldId}>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{fieldDef.name}</p>
                      <p className="text-xs font-medium">{val}</p>
                    </div>
                  );
                })}
                {item.notes && (
                  <div className="sm:col-span-2 md:col-span-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Notes</p>
                    <p className="text-xs italic text-muted-foreground">{item.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {showAdd ? (
        <ItemForm
          data={form}
          setData={setForm}
          customFields={customFields}
          onSubmit={handleCreate}
          onCancel={() => setShowAdd(false)}
          submitLabel="Add Item"
          isPending={isPending}
        />
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-border rounded-lg text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
        >
          <Plus size={12} /> Add Item
        </button>
      )}
    </div>
  );
}
