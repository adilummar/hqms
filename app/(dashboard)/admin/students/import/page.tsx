"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { bulkImportStudents, type RawImportRow, type BulkImportResult } from "@/lib/actions/bulk-import";
import { updateAdmissionNumber } from "@/lib/actions/bulk-import";
import type { BulkImportRowResult } from "@/lib/validators/bulk-import.schema";
import { toast } from "sonner";
import * as XLSX from "xlsx";

// ── CSV header → RawImportRow field mapping ──────────────────────────────────
const HEADER_MAP: Record<string, keyof RawImportRow> = {
  "ad no":       "adNo",
  "ad_no":       "adNo",
  "adno":        "adNo",
  "first_name":  "firstName",
  "firstname":   "firstName",
  "father_name": "fatherName",
  "fathername":  "fatherName",
  "phone":         "phone",
  "mobile":         "phone",
  "primary_phone":  "phone",
  "primaryphone":   "phone",
  "contact":        "phone",
  "phone_number":   "phone",
  "house name":  "houseName",
  "house_name":  "houseName",
  "housename":   "houseName",
  "post":        "post",
  "dist":        "district",
  "district":    "district",
  "state":       "state",
  "pin":         "pin",
  "pincode":     "pin",
  "date_of_birth": "dateOfBirth",
  "dob":         "dateOfBirth",
  "blood_group": "bloodGroup",
  "bloodgroup":  "bloodGroup",
  "blood group": "bloodGroup",
  "hifz_class":  "hifzClass",
  "hifz class":  "hifzClass",
  "hifzclass":   "hifzClass",
  "school_class": "schoolClass",
  "school class": "schoolClass",
  "schoolclass":  "schoolClass",
  "madrasa_class": "madrasaClass",
  "madrasa class": "madrasaClass",
  "madrasaclass":  "madrasaClass",
  "batch":       "batch",
};

// ── Shared: convert any cell value to a clean string ────────────────────────
// When xlsx reads with cellDates:true, date cells become JS Date objects.
// We always convert them to DD-MM-YYYY so the validator is happy.
function formatValue(val: unknown): string {
  if (val instanceof Date) {
    const dd   = String(val.getDate()).padStart(2, "0");
    const mm   = String(val.getMonth() + 1).padStart(2, "0");
    const yyyy = val.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }
  return String(val).trim();
}

// ── Shared: map a raw object’s keys using HEADER_MAP ────────────────────────
function mapRowKeys(raw: Record<string, unknown>): RawImportRow {
  const row: Partial<RawImportRow> = {};
  for (const [key, val] of Object.entries(raw)) {
    // Normalise: lowercase + strip all surrounding whitespace + collapse inner spaces
    const normalised = key.trim().toLowerCase().replace(/\s+/g, " ");
    const field = HEADER_MAP[normalised];
    const formatted = formatValue(val);
    if (field && formatted !== "" && formatted !== "undefined" && formatted !== "null") {
      (row as Record<string, string>)[field] = formatted;
    }
  }
  return row as RawImportRow;
}

// ── Parse XLSX file (reads first sheet) ──────────────────────────────────────
function parseXLSX(buffer: ArrayBuffer): RawImportRow[] {
  const workbook = XLSX.read(buffer, {
    type: "array",
    cellDates: true,  // parse date cells as JS Date objects (not serial numbers)
    cellNF: false,
    cellText: false,
  });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: true,        // keep Date objects intact (not re-formatted as strings)
  });
  return raw.map(mapRowKeys).filter((r) => r.adNo || r.firstName);
}

// ── Parse CSV text ────────────────────────────────────────────────────────────
function parseCSV(text: string): RawImportRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
  const fieldMap = headers.map((h) => HEADER_MAP[h] ?? null);

  return lines.slice(1).map((line) => {
    // Handle quoted CSV values properly
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === "," && !inQuotes) { values.push(current.trim()); current = ""; }
      else { current += ch; }
    }
    values.push(current.trim());

    const row: Partial<RawImportRow> = {};
    fieldMap.forEach((field, idx) => {
      if (field && values[idx] !== undefined) {
        (row as Record<string, string>)[field] = values[idx];
      }
    });
    return row as RawImportRow;
  }).filter((r) => r.adNo || r.firstName);
}

// ── Download template as XLSX (so user can open directly in Excel) ────────────
function downloadTemplate() {
  const headers = ["AD_NO","FIRST_NAME","FATHER_NAME","PHONE","HOUSE_NAME","POST","DIST","STATE","PIN","DOB","BLOOD_GROUP","HIFZ_CLASS","SCHOOL_CLASS","MADRASA_CLASS","BATCH"];
  const sample  = ["150","Mohammed Irshad","Abdul Rahman","9876543210","Al-Ameen Manzil","Perinthalmanna","Malappuram","Kerala","679321","14-05-2012","B+","HA","Class 5","M1","1"];

  const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
  // Auto-size columns
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 2, 14) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Students");
  XLSX.writeFile(wb, "student_import_template.xlsx");
}

type Step = "upload" | "preview" | "importing" | "done";

export default function BulkImportPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [rows, setRows] = useState<RawImportRow[]>([]);
  const [result, setResult] = useState<BulkImportResult | null>(null);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [editingConflict, setEditingConflict] = useState<BulkImportRowResult | null>(null);
  const [newAdNo, setNewAdNo] = useState("");
  const [editingStudentId, setEditingStudentId] = useState<string>("");

  // ── File handling — accepts .xlsx and .csv ────────────────────────────────
  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const name = file.name.toLowerCase();
    const isXLSX = name.endsWith(".xlsx") || name.endsWith(".xls");
    const isCSV  = name.endsWith(".csv");

    if (!isXLSX && !isCSV) {
      toast.error("Please upload an Excel (.xlsx) or CSV (.csv) file.");
      // Reset input so same file can be re-selected after fix
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    const reader = new FileReader();

    if (isXLSX) {
      reader.onload = (ev) => {
        const buffer = ev.target?.result as ArrayBuffer;
        const parsed = parseXLSX(buffer);
        if (parsed.length === 0) {
          toast.error("No valid rows found. Make sure the first row contains the column headers.");
          if (fileRef.current) fileRef.current.value = "";
          return;
        }
        toast.success(`Parsed ${parsed.length} rows from ${file.name}`);
        setRows(parsed);
        setStep("preview");
      };
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        const parsed = parseCSV(text);
        if (parsed.length === 0) {
          toast.error("No valid rows found. Check that the CSV headers match the template.");
          if (fileRef.current) fileRef.current.value = "";
          return;
        }
        toast.success(`Parsed ${parsed.length} rows from ${file.name}`);
        setRows(parsed);
        setStep("preview");
      };
      reader.readAsText(file);
    }
  }

  // ── Run import ────────────────────────────────────────────────────────────────
  async function runImport() {
    setStep("importing");
    try {
      const importResult = await bulkImportStudents(rows);
      setResult(importResult);
      setStep("done");
      if (importResult.conflicts.length > 0) {
        setShowConflictModal(true);
      }
    } catch (err) {
      toast.error("Import failed: " + (err instanceof Error ? err.message : "Unknown error"));
      setStep("preview");
    }
  }

  // ── Status badge ─────────────────────────────────────────────────────────────
  function StatusBadge({ status }: { status: BulkImportRowResult["status"] }) {
    const map = {
      inserted: "bg-green-100 text-green-800 border-green-200",
      updated:  "bg-blue-100 text-blue-800 border-blue-200",
      conflict: "bg-amber-100 text-amber-800 border-amber-200",
      error:    "bg-red-100 text-red-800 border-red-200",
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${map[status]}`}>
        {status}
      </span>
    );
  }

  // ── Row row preview badge ─────────────────────────────────────────────────────
  function previewRowClass(row: RawImportRow) {
    if (!row.adNo || !row.firstName || !row.fatherName || !row.phone) return "bg-red-50";
    if (!row.hifzClass || !row.schoolClass || !row.madrasaClass || !row.batch) return "bg-amber-50";
    return "";
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-playfair text-2xl font-bold text-foreground">Bulk Student Import</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload your student Excel/CSV file to import multiple students at once.
        </p>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-2 mb-8">
        {(["upload", "preview", "importing", "done"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
              step === s
                ? "bg-foreground text-background border-foreground"
                : ["done", "importing"].includes(step) && i < ["upload","preview","importing","done"].indexOf(step)
                  ? "bg-green-500 text-white border-green-500"
                  : "border-border text-muted-foreground"
            }`}>
              {i + 1}
            </div>
            <span className={`text-xs font-medium capitalize ${step === s ? "text-foreground" : "text-muted-foreground"}`}>
              {s === "importing" ? "Importing" : s.charAt(0).toUpperCase() + s.slice(1)}
            </span>
            {i < 3 && <div className="w-8 h-px bg-border" />}
          </div>
        ))}
      </div>

      {/* ── Step 1: Upload ──────────────────────────────────────────────────── */}
      {step === "upload" && (
        <div className="space-y-6">
          {/* Instructions */}
          <div className="border border-border rounded-lg p-5 bg-card">
            <h2 className="font-semibold text-base mb-3">Before you upload</h2>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li>✅ Upload your <strong>Excel (.xlsx)</strong> file directly — no need to convert to CSV</li>
              <li>✅ CSV files are also accepted if you prefer</li>
              <li>✅ Dates must be in <strong>DD-MM-YYYY</strong> format (e.g. 14-05-2012)</li>
              <li>✅ Batch column must have the <strong>batch number</strong> (e.g. 1, 2, 3)</li>
              <li>✅ Class names must exactly match what is set up in the system (e.g. HA, M1, Class 5)</li>
              <li>✅ If AD NO already exists → that student&apos;s data will be <strong>updated</strong></li>
              <li>✅ If AD NO is new → student will be <strong>inserted</strong></li>
            </ul>
            <div className="mt-4 pt-4 border-t border-border">
              <h3 className="text-sm font-medium mb-2">Required columns:</h3>
              <div className="flex flex-wrap gap-1.5">
                {["AD_NO", "FIRST_NAME", "FATHER_NAME", "PHONE", "HOUSE_NAME", "POST", "DIST", "STATE", "PIN", "DOB", "BLOOD_GROUP", "HIFZ_CLASS", "SCHOOL_CLASS", "MADRASA_CLASS", "BATCH"].map((col) => (
                  <span key={col} className="px-2 py-0.5 bg-muted rounded text-xs font-mono">{col}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={downloadTemplate}
              className="px-4 py-2 border border-border text-sm font-medium rounded-sm hover:bg-muted transition-colors"
            >
              ⬇ Download Excel Template
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="px-5 py-2 bg-foreground text-background text-sm font-medium rounded-sm hover:bg-foreground/90 transition-colors"
            >
              📂 Choose Excel or CSV File
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={onFileChange}
            />
            <p className="text-xs text-muted-foreground w-full mt-1">
              Supported formats: <span className="font-mono">.xlsx</span> (Excel) and <span className="font-mono">.csv</span>
            </p>
          </div>
        </div>
      )}

      {/* ── Step 2: Preview ─────────────────────────────────────────────────── */}
      {step === "preview" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-base">{rows.length} rows parsed</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                🟥 Red = missing required field &nbsp;|&nbsp; 🟨 Amber = class/batch may not match
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setRows([]); setStep("upload"); }}
                className="px-3 py-1.5 border border-border text-sm rounded-sm hover:bg-muted transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={runImport}
                className="px-5 py-2 bg-foreground text-background text-sm font-medium rounded-sm hover:bg-foreground/90 transition-colors"
              >
                ✓ Confirm Import ({rows.length} rows)
              </button>
            </div>
          </div>

          <div className="border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/90 backdrop-blur-sm">
                  <tr className="border-b border-border">
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">#</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">AD NO</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">First Name</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Father</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Phone</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">DOB</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Blood</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">House Name</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Post</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">District</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">State</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">PIN</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Hifz</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">School</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Madrasa</th>
                    <th className="text-left px-3 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Batch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row, i) => (
                    <tr key={i} className={`transition-colors ${previewRowClass(row)}`}>
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{i + 1}</td>
                      <td className="px-3 py-2 font-mono font-medium whitespace-nowrap">{row.adNo || <span className="text-red-500">MISSING</span>}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{row.firstName || <span className="text-red-500">MISSING</span>}</td>
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{row.fatherName || <span className="text-red-500">MISSING</span>}</td>
                      <td className="px-3 py-2 font-mono whitespace-nowrap">{row.phone || <span className="text-red-500">MISSING</span>}</td>
                      <td className="px-3 py-2 font-mono whitespace-nowrap">{row.dateOfBirth || <span className="text-red-500">MISSING</span>}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{row.bloodGroup || <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{row.houseName || <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{row.post || <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{row.district || <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{row.state || <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-3 py-2 font-mono whitespace-nowrap">{row.pin || <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{row.hifzClass || <span className="text-amber-600">?</span>}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{row.schoolClass || <span className="text-amber-600">?</span>}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{row.madrasaClass || <span className="text-amber-600">?</span>}</td>
                      <td className="px-3 py-2 font-mono whitespace-nowrap">{row.batch || <span className="text-amber-600">?</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 3: Importing ───────────────────────────────────────────────── */}
      {step === "importing" && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-12 h-12 border-4 border-foreground border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-foreground">Importing {rows.length} students…</p>
          <p className="text-xs text-muted-foreground">This may take a moment. Please don&apos;t close this page.</p>
        </div>
      )}

      {/* ── Step 4: Done ────────────────────────────────────────────────────── */}
      {step === "done" && result && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Inserted", value: result.inserted, color: "text-green-600", bg: "bg-green-50 border-green-200" },
              { label: "Updated", value: result.updated, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
              { label: "Conflicts", value: result.conflicts.length, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
              { label: "Errors", value: result.errors.length, color: "text-red-600", bg: "bg-red-50 border-red-200" },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={`border rounded-lg p-4 text-center ${bg}`}>
                <p className={`text-2xl font-bold font-jetbrains ${color}`}>{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Auto-created batches notice */}
          {result.autoBatches.length > 0 && (
            <div className="border border-green-200 bg-green-50 rounded-lg p-4">
              <p className="font-semibold text-green-900 text-sm">
                ✅ {result.autoBatches.length} new batch{result.autoBatches.length > 1 ? "es" : ""} auto-created: {result.autoBatches.map(n => `Batch ${n}`).join(", ")}
              </p>
              <p className="text-xs text-green-700 mt-0.5">
                These batches have no dates set. You can add dates in <strong>Settings → Batch Management</strong>.
              </p>
            </div>
          )}

          {/* Conflict notice */}
          {result.conflicts.length > 0 && (
            <div className="border border-amber-300 bg-amber-50 rounded-lg p-4 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-amber-900 text-sm">
                  ⚠️ {result.conflicts.length} AD NO conflict{result.conflicts.length > 1 ? "s" : ""} detected
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  These rows were imported with suggested new AD NOs. Review and reassign if needed.
                </p>
              </div>
              <button
                onClick={() => setShowConflictModal(true)}
                className="shrink-0 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-sm hover:bg-amber-700 transition-colors"
              >
                Review Conflicts →
              </button>
            </div>
          )}

          {/* Error list */}
          {result.errors.length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-red-50 border-b border-border">
                <h3 className="text-sm font-semibold text-red-700">Failed Rows</h3>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Row</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">AD NO</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Name</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {result.errors.map((e) => (
                    <tr key={e.rowIndex} className="bg-red-50/40">
                      <td className="px-4 py-2 font-mono text-muted-foreground">{e.rowIndex}</td>
                      <td className="px-4 py-2 font-mono">{e.adNo}</td>
                      <td className="px-4 py-2">{e.firstName}</td>
                      <td className="px-4 py-2 text-red-700">{e.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/admin/students")}
              className="px-5 py-2 bg-foreground text-background text-sm font-medium rounded-sm hover:bg-foreground/90 transition-colors"
            >
              View Students →
            </button>
            <button
              onClick={() => { setStep("upload"); setRows([]); setResult(null); }}
              className="px-4 py-2 border border-border text-sm rounded-sm hover:bg-muted transition-colors"
            >
              Import Another File
            </button>
          </div>
        </div>
      )}

      {/* ── Conflict Modal ──────────────────────────────────────────────────── */}
      {showConflictModal && result && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="font-playfair font-semibold text-lg">AD NO Conflicts</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  These students were assigned new AD NOs due to conflicts. Review and update if needed.
                </p>
              </div>
              <button
                onClick={() => setShowConflictModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-3">
              {result.conflicts.map((conflict) => (
                <div key={conflict.rowIndex} className="border border-amber-200 bg-amber-50 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-sm text-foreground">{conflict.firstName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{conflict.message}</p>
                      {conflict.suggestedAdNo && (
                        <p className="text-xs text-amber-700 mt-1 font-mono">
                          Assigned AD NO: <strong>{conflict.suggestedAdNo}</strong>
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setEditingConflict(conflict);
                        setNewAdNo(conflict.suggestedAdNo ?? "");
                      }}
                      className="shrink-0 text-xs px-3 py-1.5 border border-amber-300 rounded-sm hover:bg-amber-100 transition-colors"
                    >
                      Edit AD NO
                    </button>
                  </div>

                  {/* Inline edit form */}
                  {editingConflict?.rowIndex === conflict.rowIndex && (
                    <div className="mt-3 pt-3 border-t border-amber-200 flex items-center gap-2">
                      <input
                        type="text"
                        value={newAdNo}
                        onChange={(e) => setNewAdNo(e.target.value)}
                        placeholder="New AD NO"
                        className="h-8 px-2 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground font-mono w-32"
                      />
                      <button
                        onClick={async () => {
                          if (!newAdNo.trim()) return;
                          const res = await updateAdmissionNumber(editingStudentId, newAdNo.trim());
                          if (res.success) {
                            toast.success(`Updated to AD NO ${newAdNo}`);
                            setEditingConflict(null);
                          } else {
                            toast.error(res.error ?? "Update failed");
                          }
                        }}
                        className="h-8 px-3 text-sm bg-foreground text-background rounded-sm hover:bg-foreground/90 transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingConflict(null)}
                        className="h-8 px-2 text-sm border border-border rounded-sm hover:bg-muted transition-colors text-muted-foreground"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="px-6 py-4 border-t border-border flex justify-end">
              <button
                onClick={() => setShowConflictModal(false)}
                className="px-4 py-2 bg-foreground text-background text-sm font-medium rounded-sm hover:bg-foreground/90 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
