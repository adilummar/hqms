"use client";

import { useState, useTransition } from "react";
import { createCustomField, updateCustomField, toggleCustomFieldActive } from "@/lib/actions/inventory";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, Check, GripVertical, Power, PowerOff } from "lucide-react";

type FieldType = "text" | "number" | "date" | "boolean" | "select";

interface CustomField {
  id: string;
  name: string;
  type: string;
  options: string[] | null;
  isRequired: boolean;
  isActive: boolean;
  displayOrder: number;
}

interface Props {
  fields: CustomField[];
}

export function CustomFieldsManager({ fields }: Props) {
  const [isPending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState<{
    name: string;
    type: FieldType;
    options: string;
    isRequired: boolean;
    isActive: boolean;
  }>({ name: "", type: "text", options: "", isRequired: false, isActive: true });

  const resetForm = () => {
    setForm({ name: "", type: "text", options: "", isRequired: false, isActive: true });
    setShowAdd(false);
    setEditingId(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    startTransition(async () => {
      const optionsArr = form.type === "select" ? form.options.split(",").map(s => s.trim()).filter(Boolean) : null;
      const res = await createCustomField({
        name: form.name,
        type: form.type,
        options: optionsArr,
        isRequired: form.isRequired,
        isActive: form.isActive,
        displayOrder: fields.length,
      });

      if (!res.success) {
        toast.error("Failed to add custom field");
      } else {
        toast.success("Custom field added");
        resetForm();
      }
    });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !form.name.trim()) return;

    startTransition(async () => {
      const optionsArr = form.type === "select" ? form.options.split(",").map(s => s.trim()).filter(Boolean) : null;
      const res = await updateCustomField(editingId, {
        name: form.name,
        type: form.type,
        options: optionsArr,
        isRequired: form.isRequired,
        isActive: form.isActive,
      });

      if (!res.success) {
        toast.error("Failed to update custom field");
      } else {
        toast.success("Custom field updated");
        resetForm();
      }
    });
  };

  const handleToggle = (id: string, current: boolean) => {
    startTransition(async () => {
      const res = await toggleCustomFieldActive(id, !current);
      if (!res.success) {
        toast.error("Failed to toggle status");
      } else {
        toast.success(current ? "Field disabled" : "Field enabled");
      }
    });
  };

  return (
    <div className="space-y-4">
      {fields.length === 0 && !showAdd ? (
        <div className="text-center py-8 bg-muted/20 border border-dashed border-border rounded-lg">
          <p className="text-sm text-muted-foreground mb-3">No custom fields created yet.</p>
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-foreground text-background text-sm font-medium rounded hover:bg-foreground/90 transition-colors"
          >
            <Plus size={14} /> Add First Custom Field
          </button>
        </div>
      ) : (
        <div className="flex justify-end">
          {!showAdd && !editingId && (
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-foreground text-background text-xs font-medium rounded hover:bg-foreground/90 transition-colors"
            >
              <Plus size={12} /> Add Field
            </button>
          )}
        </div>
      )}

      {(showAdd || editingId) && (
        <form
          onSubmit={editingId ? handleUpdate : handleCreate}
          className="p-4 bg-muted/30 border border-border rounded-lg space-y-4"
        >
          <h4 className="text-sm font-semibold">{editingId ? "Edit Custom Field" : "New Custom Field"}</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Field Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Serial Number"
                required
                className="w-full h-9 px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
              />
            </div>
            
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Field Type *</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as FieldType })}
                className="w-full h-9 px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
              >
                <option value="text">Text (Short input)</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
                <option value="boolean">Yes/No Checkbox</option>
                <option value="select">Dropdown Select</option>
              </select>
            </div>

            {form.type === "select" && (
              <div className="md:col-span-2">
                <label className="block text-xs text-muted-foreground mb-1">Dropdown Options (comma-separated) *</label>
                <input
                  value={form.options}
                  onChange={(e) => setForm({ ...form, options: e.target.value })}
                  placeholder="e.g. New, Good, Damaged"
                  required={form.type === "select"}
                  className="w-full h-9 px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-6 pt-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.isRequired}
                onChange={(e) => setForm({ ...form, isRequired: e.target.checked })}
                className="rounded border-gray-300 text-foreground focus:ring-foreground"
              />
              Required field
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="rounded border-gray-300 text-foreground focus:ring-foreground"
              />
              Active
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={resetForm}
              className="px-3 py-1.5 text-xs border border-border rounded-sm hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !form.name.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-foreground text-background text-xs font-medium rounded-sm disabled:opacity-50"
            >
              {isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              {editingId ? "Save Changes" : "Add Field"}
            </button>
          </div>
        </form>
      )}

      {fields.length > 0 && (
        <div className="divide-y divide-border border border-border rounded-lg overflow-hidden bg-background">
          {fields.map((field) => (
            <div key={field.id} className={`flex items-center justify-between p-3 ${!field.isActive ? "bg-muted/30 opacity-70" : ""}`}>
              <div className="flex items-center gap-3">
                <GripVertical size={14} className="text-muted-foreground cursor-grab opacity-30" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{field.name}</span>
                    {!field.isActive && (
                      <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-semibold">INACTIVE</span>
                    )}
                    {field.isRequired && (
                      <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold">REQUIRED</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <span className="capitalize">{field.type}</span>
                    {field.type === "select" && field.options && (
                      <span>· Options: {field.options.join(", ")}</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleToggle(field.id, field.isActive)}
                  disabled={isPending}
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                  title={field.isActive ? "Disable" : "Enable"}
                >
                  {field.isActive ? <PowerOff size={14} /> : <Power size={14} />}
                </button>
                <button
                  onClick={() => {
                    setEditingId(field.id);
                    setForm({
                      name: field.name,
                      type: field.type as FieldType,
                      options: field.options ? field.options.join(", ") : "",
                      isRequired: field.isRequired,
                      isActive: field.isActive,
                    });
                  }}
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                >
                  <Pencil size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
