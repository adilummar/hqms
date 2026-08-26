"use client";

import { useState, useTransition } from "react";
import { createItem, updateItem, deleteItem, adjustQuantity } from "@/lib/actions/inventory";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, Check, Minus, AlertTriangle } from "lucide-react";

const UNITS = ["pcs", "kg", "g", "litres", "ml", "boxes", "packets", "reams", "rolls", "pairs", "sets"];

type FormData = {
  name: string;
  description: string;
  quantity: string;
  unit: string;
  minStockAlert: string;
  notes: string;
};

// ── Extracted to module level so React never remounts it on parent re-render ──
function ItemForm({
  data,
  setData,
  onSubmit,
  onCancel,
  submitLabel,
  isPending,
}: {
  data: FormData;
  setData: (d: FormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  submitLabel: string;
  isPending: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-3 p-4 bg-muted/20 border border-border rounded-lg">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
          <label className="block text-xs text-muted-foreground mb-1">Notes</label>
          <input
            value={data.notes}
            onChange={(e) => setData({ ...data, notes: e.target.value })}
            placeholder="Any extra notes"
            className="w-full h-9 px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
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

// ─────────────────────────────────────────────────────────────────────────────

interface Item {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  quantity: number;
  unit: string | null;
  minStockAlert: number | null;
  notes: string | null;
}

interface Props {
  categoryId: string;
  categoryName: string;
  items: Item[];
}

const BLANK_FORM: FormData = { name: "", description: "", quantity: "0", unit: "pcs", minStockAlert: "0", notes: "" };

export function ItemsManager({ categoryId, categoryName, items: initial }: Props) {
  const [isPending, startTransition] = useTransition();
  const [items, setItems] = useState(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<FormData>(BLANK_FORM);
  const [editForm, setEditForm] = useState<FormData & { id: string }>({ id: "", ...BLANK_FORM });

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
      });
      if (result.success && result.data) {
        setItems((prev) => [...prev, result.data!]);
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
      });
      if (result.success && result.data) {
        setItems((prev) => prev.map((i) => (i.id === editForm.id ? result.data! : i)));
        setEditingId(null);
        toast.success("Item updated");
      } else {
        toast.error("Failed to update");
      }
    });
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`Remove "${name}" from inventory?`)) return;
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

      {/* Item rows */}
      {items.map((item) => {
        const isLow =
          item.minStockAlert && item.minStockAlert > 0 && item.quantity <= item.minStockAlert;

        if (editingId === item.id) {
          return (
            <ItemForm
              key={`edit-${item.id}`}
              data={editForm}
              setData={(d) => setEditForm({ ...d, id: editForm.id })}
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
            className={`flex items-center gap-3 px-3 py-3 border rounded-lg group transition-colors ${
              isLow ? "border-amber-300 bg-amber-50/40" : "border-border hover:bg-muted/20"
            }`}
          >
            {/* Low stock icon */}
            <div className="w-8 flex justify-center">
              {isLow && <AlertTriangle size={14} className="text-amber-500 shrink-0" />}
            </div>

            {/* Item info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground">{item.name}</p>
                {item.description && (
                  <p className="text-xs text-muted-foreground hidden md:block">— {item.description}</p>
                )}
              </div>
              {item.notes && (
                <p className="text-xs text-muted-foreground truncate">{item.notes}</p>
              )}
            </div>

            {/* Quantity controls */}
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

            {/* Actions */}
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
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
        );
      })}

      {/* Add item form */}
      {showAdd ? (
        <ItemForm
          data={form}
          setData={setForm}
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
