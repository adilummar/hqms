"use client";

import { useMemo, useState } from "react";
import { Search, UserPlus, X, Users, Globe2 } from "lucide-react";
import {
  CATEGORY_LABELS,
  MEETING_CATEGORIES,
  CUSTOM_CATEGORY_MAX,
  externalParticipantSchema,
  externalKey,
  type MeetingCategory,
} from "@/lib/staff-meetings/participants";

const inputCls =
  "w-full px-3 py-2 rounded-lg border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-teal font-dm-sans";
const labelCls = "block text-xs font-semibold text-foreground mb-1 font-dm-sans";

// ── Category ─────────────────────────────────────────────────────────────────

export interface CategoryValue {
  category: MeetingCategory | "";
  customCategory: string;
}

export function MeetingCategoryField({
  value,
  onChange,
  showError,
}: {
  value: CategoryValue;
  onChange: (v: CategoryValue) => void;
  showError?: boolean;
}) {
  const customMissing = value.category === "custom" && !value.customCategory.trim();
  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>
          Meeting Category <span className="text-red-500">*</span>
        </label>
        <select
          required
          value={value.category}
          onChange={(e) =>
            // Switching away from Custom clears the custom text so it can never stay active.
            onChange({ category: e.target.value as MeetingCategory | "", customCategory: "" })
          }
          className={inputCls}
        >
          <option value="" disabled>
            Select category…
          </option>
          {MEETING_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        {showError && !value.category && (
          <p className="text-[11px] text-red-600 mt-1">Select a meeting category.</p>
        )}
      </div>

      {value.category === "custom" && (
        <div>
          <label className={labelCls}>
            Specify Meeting Category <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            maxLength={CUSTOM_CATEGORY_MAX}
            placeholder="e.g. Parent Coordination Meeting, Special Committee Meeting"
            value={value.customCategory}
            onChange={(e) => onChange({ ...value, customCategory: e.target.value })}
            className={inputCls}
          />
          {showError && customMissing && (
            <p className="text-[11px] text-red-600 mt-1">Enter the meeting category.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Participants ─────────────────────────────────────────────────────────────

export interface StaffCandidate {
  id: string;
  username: string;
  email?: string | null;
  role?: string;
}

export interface ExternalDraft {
  tempKey: string;
  id?: string; // set when it already exists on a saved meeting
  name: string;
  designation: string;
  contactNumber: string;
}

export function newTempKey() {
  return Math.random().toString(36).slice(2);
}

export function MeetingParticipantsPicker({
  candidates,
  selected,
  onSelectedChange,
  externals,
  onExternalsChange,
}: {
  candidates: StaffCandidate[];
  selected: string[];
  onSelectedChange: (ids: string[]) => void;
  externals: ExternalDraft[];
  onExternalsChange: (list: ExternalDraft[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", designation: "", contactNumber: "" });
  const [error, setError] = useState<string | null>(null);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const q = search.trim().toLowerCase();
  const visible = candidates.filter(
    (c) => !q || c.username.toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q)
  );
  const staffCount = candidates.filter((c) => selectedSet.has(c.id)).length;

  function toggle(id: string) {
    onSelectedChange(selectedSet.has(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  }
  function selectAll() {
    onSelectedChange([...new Set([...selected, ...visible.map((c) => c.id)])]);
  }
  function deselectAll() {
    const hide = new Set(visible.map((c) => c.id));
    onSelectedChange(selected.filter((s) => !hide.has(s)));
  }

  function addExternal() {
    const parsed = externalParticipantSchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid participant");
      return;
    }
    const key = externalKey(parsed.data);
    if (externals.some((e) => externalKey(e) === key)) {
      setError("This external participant is already added.");
      return;
    }
    onExternalsChange([
      ...externals,
      {
        tempKey: newTempKey(),
        name: parsed.data.name,
        designation: parsed.data.designation ?? "",
        contactNumber: parsed.data.contactNumber ?? "",
      },
    ]);
    setDraft({ name: "", designation: "", contactNumber: "" });
    setError(null);
    setAdding(false);
  }

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center justify-between gap-2 mb-1">
          <label className="text-xs font-semibold text-foreground font-dm-sans flex items-center gap-1">
            <Users size={12} className="text-muted-foreground" />
            Meeting Participants
          </label>
          <div className="flex items-center gap-2 text-[11px] font-semibold font-dm-sans">
            <button type="button" onClick={selectAll} className="text-teal-700 hover:underline cursor-pointer">
              Select All
            </button>
            <span className="text-border">|</span>
            <button type="button" onClick={deselectAll} className="text-muted-foreground hover:underline cursor-pointer">
              Deselect All
            </button>
          </div>
        </div>

        <div className="relative mb-2">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search staff by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputCls} pl-8`}
          />
        </div>

        <div className="max-h-48 overflow-y-auto rounded-lg border border-border divide-y divide-border">
          {candidates.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">No eligible staff found.</p>
          ) : visible.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">No staff match your search.</p>
          ) : (
            visible.map((c) => (
              <label
                key={c.id}
                className="flex items-center gap-2.5 px-3 py-2 text-xs cursor-pointer hover:bg-muted/50 font-dm-sans"
              >
                <input
                  type="checkbox"
                  checked={selectedSet.has(c.id)}
                  onChange={() => toggle(c.id)}
                  className="accent-teal-600"
                />
                <span className="font-medium text-foreground">{c.username}</span>
                {c.email && <span className="text-[11px] text-muted-foreground truncate">{c.email}</span>}
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  HQMS staff
                </span>
              </label>
            ))
          )}
        </div>
      </div>

      {/* External participants */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold text-foreground font-dm-sans flex items-center gap-1">
            <Globe2 size={12} className="text-muted-foreground" />
            External Participants
          </p>
          {!adding && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:underline cursor-pointer font-dm-sans"
            >
              <UserPlus size={12} /> Add External Participant
            </button>
          )}
        </div>

        {adding && (
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
            <div>
              <label className={labelCls}>
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                maxLength={120}
                placeholder="e.g. Abdul Rahman"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className={inputCls}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Designation / Role (Optional)</label>
                <input
                  type="text"
                  maxLength={120}
                  placeholder="e.g. Guest Lecturer"
                  value={draft.designation}
                  onChange={(e) => setDraft({ ...draft, designation: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Contact Number (Optional)</label>
                <input
                  type="tel"
                  maxLength={40}
                  value={draft.contactNumber}
                  onChange={(e) => setDraft({ ...draft, contactNumber: e.target.value })}
                  className={inputCls}
                />
              </div>
            </div>
            {error && <p className="text-[11px] text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setError(null);
                  setDraft({ name: "", designation: "", contactNumber: "" });
                }}
                className="px-3 py-1 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={addExternal}
                className="px-3 py-1 rounded-lg bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 cursor-pointer"
              >
                Add
              </button>
            </div>
          </div>
        )}

        {externals.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {externals.map((e) => (
              <li
                key={e.tempKey}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-dm-sans"
              >
                <span className="font-medium text-foreground">{e.name}</span>
                {e.designation && <span className="text-muted-foreground">· {e.designation}</span>}
                {e.contactNumber && <span className="text-muted-foreground">· {e.contactNumber}</span>}
                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                  External
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${e.name}`}
                  onClick={() => onExternalsChange(externals.filter((x) => x.tempKey !== e.tempKey))}
                  className="text-muted-foreground hover:text-red-600 cursor-pointer"
                >
                  <X size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground font-dm-sans">
        <strong className="text-foreground">{staffCount}</strong> registered staff +{" "}
        <strong className="text-foreground">{externals.length}</strong> external ={" "}
        <strong className="text-foreground">{staffCount + externals.length}</strong> total participants
      </p>
    </div>
  );
}
