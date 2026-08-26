"use client";

import { useState, useTransition } from "react";
import { createCategory, updateCategory, deleteCategory } from "@/lib/actions/inventory";
import { toast } from "sonner";
import { Loader2, Pencil, Trash2, Check, X, Plus } from "lucide-react";

interface Category {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
}

interface Props {
  categories: Category[];
}

const EMOJI_OPTIONS = ["📦", "✏️", "🧹", "🍽️", "⚽", "📚", "🔧", "💡", "🛒", "🏫", "🧴", "🖥️"];

export function CategoryManager({ categories: initial }: Props) {
  const [isPending, startTransition] = useTransition();
  const [categories, setCategories] = useState(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  // New category form state
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newIcon, setNewIcon] = useState("📦");

  // Edit state
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editIcon, setEditIcon] = useState("");

  function startEdit(cat: Category) {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditDesc(cat.description ?? "");
    setEditIcon(cat.icon ?? "📦");
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createCategory({ name: newName, description: newDesc, icon: newIcon });
      if (result.success && result.data) {
        setCategories((prev) => [...prev, result.data!]);
        setNewName(""); setNewDesc(""); setNewIcon("📦");
        setShowAdd(false);
        toast.success(`Category "${result.data.name}" created`);
      } else { toast.error("Failed to create category"); }
    });
  }

  function handleUpdate(id: string) {
    startTransition(async () => {
      const result = await updateCategory(id, { name: editName, description: editDesc, icon: editIcon });
      if (result.success && result.data) {
        setCategories((prev) => prev.map((c) => (c.id === id ? result.data! : c)));
        setEditingId(null);
        toast.success("Category updated");
      } else { toast.error("Failed to update"); }
    });
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`Delete category "${name}"? All items inside will also be deleted.`)) return;
    startTransition(async () => {
      await deleteCategory(id);
      setCategories((prev) => prev.filter((c) => c.id !== id));
      toast.success("Category deleted");
    });
  }

  return (
    <div className="space-y-2">
      {categories.map((cat) =>
        editingId === cat.id ? (
          <div key={cat.id} className="border border-foreground/20 rounded-lg p-3 bg-muted/30 space-y-2">
            <div className="flex gap-2 flex-wrap">
              {EMOJI_OPTIONS.map((e) => (
                <button key={e} type="button" onClick={() => setEditIcon(e)}
                  className={`text-xl p-1 rounded transition-all ${editIcon === e ? "ring-2 ring-foreground scale-110" : "opacity-60 hover:opacity-100"}`}>
                  {e}
                </button>
              ))}
            </div>
            <input value={editName} onChange={(e) => setEditName(e.target.value)}
              className="w-full h-9 px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground" />
            <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)}
              placeholder="Description (optional)"
              className="w-full h-9 px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditingId(null)} className="p-1.5 hover:bg-muted rounded-sm"><X size={14} /></button>
              <button onClick={() => handleUpdate(cat.id)} disabled={isPending || !editName}
                className="flex items-center gap-1 px-3 py-1.5 bg-foreground text-background text-xs rounded-sm disabled:opacity-50">
                {isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Save
              </button>
            </div>
          </div>
        ) : (
          <div key={cat.id} className="flex items-center gap-3 px-3 py-2.5 border border-border rounded-lg hover:bg-muted/30 transition-colors group">
            <span className="text-xl">{cat.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{cat.name}</p>
              {cat.description && <p className="text-xs text-muted-foreground truncate">{cat.description}</p>}
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => startEdit(cat)} className="p-1.5 hover:bg-muted rounded-sm text-muted-foreground hover:text-foreground transition-colors"><Pencil size={13} /></button>
              <button onClick={() => handleDelete(cat.id, cat.name)} disabled={isPending}
                className="p-1.5 hover:bg-red-50 rounded-sm text-muted-foreground hover:text-red-600 transition-colors"><Trash2 size={13} /></button>
            </div>
          </div>
        )
      )}

      {showAdd ? (
        <form onSubmit={handleCreate} className="border border-dashed border-border rounded-lg p-3 space-y-2 mt-2">
          <div className="flex gap-2 flex-wrap">
            {EMOJI_OPTIONS.map((e) => (
              <button key={e} type="button" onClick={() => setNewIcon(e)}
                className={`text-xl p-1 rounded transition-all ${newIcon === e ? "ring-2 ring-foreground scale-110" : "opacity-60 hover:opacity-100"}`}>
                {e}
              </button>
            ))}
          </div>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Category name *" required
            className="w-full h-9 px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground" />
          <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Description (optional)"
            className="w-full h-9 px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground" />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-xs border border-border rounded-sm hover:bg-muted">Cancel</button>
            <button type="submit" disabled={isPending || !newName}
              className="flex items-center gap-1 px-3 py-1.5 bg-foreground text-background text-xs rounded-sm disabled:opacity-50">
              {isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Add Category
            </button>
          </div>
        </form>
      ) : (
        <button onClick={() => setShowAdd(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors mt-1">
          <Plus size={14} /> Add Category
        </button>
      )}
    </div>
  );
}
