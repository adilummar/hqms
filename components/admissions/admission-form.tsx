"use client";

import { useState } from "react";
import { submitAdmissionForm } from "@/app/(dashboard)/admin/admissions/new/actions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface ClassType {
  id: string;
  name: string;
}

interface BatchType {
  id: string;
  batchNumber: number;
  label: string;
}

interface Props {
  hifzClasses: ClassType[];
  madrasaClasses: ClassType[];
  schoolClasses: ClassType[];
  academicYearId: string;
  /** Next suggested admission number — shown as placeholder */
  nextAdmissionNumber: string;
  /** All available batches for manual selection */
  allBatches: BatchType[];
  /** The latest batch id — used as default */
  defaultBatchId: string;
}

export function AdmissionForm({
  hifzClasses,
  madrasaClasses,
  schoolClasses,
  academicYearId,
  nextAdmissionNumber,
  allBatches,
  defaultBatchId,
}: Props) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setIsPending(true);
    formData.append("academicYearId", academicYearId);

    try {
      const result = await submitAdmissionForm(formData);
      if ("error" in result && result.error) {
        toast.error(result.error);
      } else if ("success" in result && result.success) {
        const r = result as { admissionNumber: string; parentUsername: string; parentPassword: string };
        toast.success(
          `Student admitted! AD No: ${r.admissionNumber} | Parent: ${r.parentUsername} / ${r.parentPassword}`
        );
        router.push("/admin/students");
      }
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsPending(false);
    }
  }

  const inputClass = "w-full h-10 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20";
  const labelClass = "text-sm font-medium text-muted-foreground";

  return (
    <form action={onSubmit} className="space-y-8">

      {/* ── Student Details ─────────────────────────────── */}
      <div>
        <h3 className="text-lg font-playfair font-semibold mb-4 text-foreground border-b border-border pb-2">
          Student Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Admission Number */}
          <div className="space-y-1">
            <label className={labelClass}>
              Admission Number
              <span className="ml-1 text-xs text-muted-foreground font-normal">
                (leave blank to auto-assign)
              </span>
            </label>
            <input
              name="admissionNumber"
              type="text"
              placeholder={`Next: ${nextAdmissionNumber}`}
              className={inputClass}
            />
          </div>

          {/* Admission Date */}
          <div className="space-y-1">
            <label className={labelClass}>Admission Date *</label>
            <input
              required
              name="admissionDate"
              type="date"
              defaultValue={new Date().toISOString().split("T")[0]}
              className={inputClass}
            />
          </div>

          {/* First Name */}
          <div className="space-y-1">
            <label className={labelClass}>First Name *</label>
            <input required name="firstName" type="text" className={inputClass} />
          </div>

          {/* Last Name */}
          <div className="space-y-1">
            <label className={labelClass}>Last Name</label>
            <input name="lastName" type="text" className={inputClass} />
          </div>

          {/* Date of Birth */}
          <div className="space-y-1">
            <label className={labelClass}>Date of Birth *</label>
            <input required name="dateOfBirth" type="date" className={inputClass} />
          </div>

          {/* Blood Group */}
          <div className="space-y-1">
            <label className={labelClass}>Blood Group</label>
            <input name="bloodGroup" type="text" placeholder="e.g. O+" className={inputClass} />
          </div>

          {/* Batch — manual selection, defaults to latest */}
          <div className="space-y-1 md:col-span-2">
            <label className={labelClass}>
              Batch *
              <span className="ml-1 text-xs text-muted-foreground font-normal">
                (default: latest batch — change only for historical data entry)
              </span>
            </label>
            {allBatches.length === 0 ? (
              <div className="h-10 px-3 flex items-center rounded-md border border-red-200 bg-red-50 text-sm text-red-600">
                No batches found — please create a batch first in Settings → Batch Management.
              </div>
            ) : (
              <select
                name="batchId"
                required
                defaultValue={defaultBatchId}
                className={inputClass}
              >
                {allBatches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                    {b.id === defaultBatchId ? " (current)" : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Gender note */}
          <div className="md:col-span-2 px-3 py-2 rounded-md bg-muted/40 border border-border text-sm text-muted-foreground">
            ℹ️ All students are enrolled as <strong>Male</strong> (boys-only institution)
          </div>
        </div>
      </div>

      {/* ── Address ─────────────────────────────────────── */}
      <div>
        <h3 className="text-lg font-playfair font-semibold mb-4 text-foreground border-b border-border pb-2">
          Address
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1 md:col-span-2">
            <label className={labelClass}>House Name / Building</label>
            <input name="houseName" type="text" placeholder="e.g. Al-Ameen Manzil" className={inputClass} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Post / Place</label>
            <input name="post" type="text" placeholder="e.g. Perinthalmanna" className={inputClass} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>District</label>
            <input name="district" type="text" placeholder="e.g. Malappuram" className={inputClass} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>State</label>
            <input name="state" type="text" placeholder="e.g. Kerala" className={inputClass} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>PIN Code</label>
            <input name="pin" type="text" maxLength={6} placeholder="e.g. 679321" className={inputClass} />
          </div>
        </div>
      </div>

      {/* ── Parent / Guardian ─────────────────────────── */}
      <div>
        <h3 className="text-lg font-playfair font-semibold mb-4 text-foreground border-b border-border pb-2">
          Parent / Guardian Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className={labelClass}>Father&apos;s Name *</label>
            <input required name="fatherName" type="text" className={inputClass} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Mother&apos;s Name</label>
            <input name="motherName" type="text" className={inputClass} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Primary Phone *</label>
            <input required name="primaryPhone" type="tel" className={inputClass} />
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Secondary Phone</label>
            <input name="secondaryPhone" type="tel" className={inputClass} />
          </div>
        </div>
      </div>

      {/* ── Class Assignment ────────────────────────────── */}
      <div>
        <h3 className="text-lg font-playfair font-semibold mb-4 text-foreground border-b border-border pb-2">
          Class Assignment
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className={labelClass}>Hifz Class *</label>
            <select required name="hifzClassId" className={inputClass}>
              <option value="">Select Hifz Class</option>
              {hifzClasses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className={labelClass}>Madrasa Class *</label>
            <select required name="madrasaClassId" className={inputClass}>
              <option value="">Select Madrasa Class</option>
              {madrasaClasses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className={labelClass}>School Class *</label>
            <select required name="schoolClassId" className={inputClass}>
              <option value="">Select School Class</option>
              {schoolClasses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-border">
        <Button
          type="submit"
          disabled={isPending || allBatches.length === 0}
          className="bg-foreground text-background hover:bg-foreground/90 min-w-[160px]"
        >
          {isPending ? "Submitting..." : "Submit Admission"}
        </Button>
      </div>
    </form>
  );
}
