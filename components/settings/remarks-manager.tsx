"use client";

import { useState } from "react";
import { addRemarkOption, deleteRemarkOption, toggleRemarkStatus, updateRemarkOption } from "@/app/(dashboard)/admin/settings/remarks/actions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Trash2, Pencil, Check, X } from "lucide-react";

interface RemarkOption {
  id: string;
  category: "sabaq" | "sabaq_juz" | "daura" | "attendance";
  label: string;
  isActive: boolean;
}

interface Props {
  initialRemarks: RemarkOption[];
}

const CATEGORIES = [
  { id: "sabaq", label: "Sabaq Remarks" },
  { id: "sabaq_juz", label: "Sabaq Juz Remarks" },
  { id: "daura", label: "Daura Remarks" },
  { id: "attendance", label: "Attendance Remarks" },
] as const;

export function RemarksManager({ initialRemarks }: Props) {
  const [activeTab, setActiveTab] = useState<"sabaq" | "sabaq_juz" | "daura" | "attendance">("sabaq");
  const [isPending, setIsPending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");

  const filteredRemarks = initialRemarks.filter(r => r.category === activeTab);

  function startEdit(id: string, label: string) {
    setEditingId(id);
    setEditingLabel(label);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingLabel("");
  }

  async function handleUpdate(id: string) {
    if (editingLabel.trim() === "") {
      toast.error("Label cannot be empty");
      return;
    }
    const res = await updateRemarkOption(id, editingLabel);
    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success("Remark updated");
      cancelEdit();
    }
  }

  async function handleAdd(formData: FormData) {
    setIsPending(true);
    formData.append("category", activeTab);
    
    try {
      const res = await addRemarkOption(formData);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success("Remark added successfully");
        const form = document.getElementById("add-remark-form") as HTMLFormElement;
        form?.reset();
      }
    } finally {
      setIsPending(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this remark option?")) return;
    
    const res = await deleteRemarkOption(id);
    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success("Remark deleted");
    }
  }

  async function handleToggle(id: string, currentStatus: boolean) {
    const res = await toggleRemarkStatus(id, !currentStatus);
    if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success("Status updated");
    }
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-border">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveTab(cat.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === cat.id
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* List */}
        <div className="lg:col-span-2 bg-card border border-border rounded-lg shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-muted/20">
            <h3 className="font-playfair text-lg font-semibold capitalize">
              {activeTab.replace('_', ' ')} Options
            </h3>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Label</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-right px-5 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredRemarks.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-5 py-8 text-center text-muted-foreground">
                    No options found for this category. Add one to get started.
                  </td>
                </tr>
              ) : (
                filteredRemarks.map((remark) => (
                  <tr key={remark.id} className="hover:bg-muted/30">
                    <td className="px-5 py-3 font-medium">
                      {editingId === remark.id ? (
                        <input
                          autoFocus
                          value={editingLabel}
                          onChange={(e) => setEditingLabel(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleUpdate(remark.id);
                            if (e.key === "Escape") cancelEdit();
                          }}
                          className="w-full h-9 px-2 rounded-md border border-border bg-background"
                        />
                      ) : (
                        remark.label
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => handleToggle(remark.id, remark.isActive)}
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                          remark.isActive
                            ? "text-emerald-700 bg-emerald-500/10 hover:bg-emerald-500/20"
                            : "text-muted-foreground bg-muted hover:bg-muted/80"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${remark.isActive ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
                        {remark.isActive ? "Active" : "Disabled"}
                      </button>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {editingId === remark.id ? (
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleUpdate(remark.id)}
                            className="text-emerald-600 hover:text-emerald-800 p-1.5 rounded-md hover:bg-emerald-50 transition-colors"
                            title="Save"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-muted transition-colors"
                            title="Cancel"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => startEdit(remark.id, remark.label)}
                            className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-muted transition-colors"
                            title="Edit option"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(remark.id)}
                            className="text-red-500 hover:text-red-700 p-1.5 rounded-md hover:bg-red-50 transition-colors"
                            title="Delete option"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>

        {/* Add Form */}
        <div className="bg-card border border-border rounded-lg shadow-sm h-fit">
          <div className="px-5 py-4 border-b border-border bg-muted/20">
            <h3 className="font-playfair text-lg font-semibold">Add New Option</h3>
          </div>
          <form id="add-remark-form" action={handleAdd} className="p-5 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Option Label</label>
              <input 
                required 
                name="label" 
                type="text" 
                placeholder="e.g. Needs Improvement"
                className="w-full h-10 px-3 rounded-md border border-border bg-background" 
              />
            </div>
            <Button type="submit" disabled={isPending} className="w-full bg-foreground text-background hover:bg-foreground/90">
              {isPending ? "Adding..." : "Add Option"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
