"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { updateStudentProfile, type UpdateProfileInput } from "@/lib/actions/student-profile";
import { updateJuzProgress } from "@/lib/actions/hifz";
import { toast } from "sonner";
import { Loader2, User, MapPin, GraduationCap, Phone, ArrowLeft, BookOpen } from "lucide-react";
import Link from "next/link";

const schema = z.object({
  studentId: z.string(),
  firstName: z.string().min(1, "Required"),
  lastName: z.string().optional(),
  dateOfBirth: z.string().min(1, "Required"),
  gender: z.enum(["male", "female"]),
  bloodGroup: z.string().optional(),
  nationality: z.string().optional(),
  religion: z.string().optional(),
  admissionDate: z.string().min(1, "Required"),
  photoUrl: z.string().optional(),
  medicalNotes: z.string().optional(),
  fatherName: z.string().min(1, "Required"),
  fatherOccupation: z.string().optional(),
  motherName: z.string().optional(),
  guardianName: z.string().optional(),
  guardianRelation: z.string().optional(),
  primaryPhone: z.string().min(10, "Required"),
  whatsappNumber: z.string().optional(),
  email: z.string().optional(),
  houseName: z.string().optional(),
  place: z.string().optional(),
  postOffice: z.string().optional(),
  pincode: z.string().optional(),
  district: z.string().optional(),
  state: z.string().optional(),
  aadhaarNumber: z.string().optional(),
  identificationMark: z.string().optional(),
  schoolName: z.string().optional(),
  schoolClass: z.string().optional(),
  madrasaName: z.string().optional(),
  madrasaAffiliationNumber: z.string().optional(),
  madrasaClass: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

type JuzStatus = "not_started" | "in_progress" | "completed";

interface JuzRow {
  juzNumber: number;
  status: JuzStatus;
  startDate: string | null;
  completionDate: string | null;
}

interface Props {
  studentId: string;
  defaultValues: Partial<FormData>;
  studentName: string;
  juzRows?: JuzRow[];
}

const inp = "w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none";
const lbl = "block text-sm font-medium text-foreground mb-1";
const sel = "w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none";

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border">
      <span className="text-primary">{icon}</span>
      <h3 className="font-playfair text-base font-semibold">{title}</h3>
    </div>
  );
}

export function StudentProfileEditForm({ studentId, defaultValues, studentName, juzRows: initialJuzRows = [] }: Props) {
  const [isPending, startTransition] = useTransition();
  const [isJuzPending, startJuzTransition] = useTransition();

  // Build a full 30-juz state (fill missing juz with not_started)
  const [juzState, setJuzState] = useState<JuzRow[]>(() => {
    return Array.from({ length: 30 }, (_, i) => {
      const n = i + 1;
      const existing = initialJuzRows.find((r) => r.juzNumber === n);
      return existing ?? { juzNumber: n, status: "not_started", startDate: null, completionDate: null };
    });
  });

  const { register, handleSubmit, formState: { errors, isDirty } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { studentId, ...defaultValues },
  });

  function onSubmit(data: FormData) {
    startTransition(async () => {
      const result = await updateStudentProfile(data as UpdateProfileInput);
      if (result.success) {
        toast.success("Profile updated successfully");
      } else {
        toast.error("Failed to update profile");
        console.error(result.error);
      }
    });
  }

  // Cycle juz status: not_started → in_progress → completed → not_started
  function cycleJuzStatus(juzNumber: number) {
    setJuzState((prev) =>
      prev.map((row) => {
        if (row.juzNumber !== juzNumber) return row;
        const next: Record<JuzStatus, JuzStatus> = {
          not_started: "in_progress",
          in_progress: "completed",
          completed: "not_started",
        };
        const newStatus = next[row.status];
        const today = new Date().toISOString().split("T")[0];
        return {
          ...row,
          status: newStatus,
          startDate: newStatus === "in_progress" && !row.startDate ? today : row.startDate,
          completionDate: newStatus === "completed" ? (row.completionDate ?? today) : null,
        };
      })
    );
  }

  function saveJuzProgress() {
    startJuzTransition(async () => {
      const result = await updateJuzProgress({ studentId, juzRows: juzState });
      if (result.success) {
        toast.success("Juz progress saved");
      } else {
        toast.error("Failed to save juz progress");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <input type="hidden" {...register("studentId")} />

      {/* Personal Details */}
      <div className="bg-card border border-border rounded-lg p-6">
        <SectionTitle icon={<User size={16} />} title="Personal Details" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={lbl}>First Name *</label>
            <input {...register("firstName")} className={inp} placeholder="First name" />
            {errors.firstName && <p className="text-xs text-red-500 mt-1">{errors.firstName.message}</p>}
          </div>
          <div>
            <label className={lbl}>Last Name</label>
            <input {...register("lastName")} className={inp} placeholder="Last name" />
          </div>
          <div>
            <label className={lbl}>Date of Birth *</label>
            <input type="date" {...register("dateOfBirth")} className={inp} />
            {errors.dateOfBirth && <p className="text-xs text-red-500 mt-1">{errors.dateOfBirth.message}</p>}
          </div>
          <div>
            <label className={lbl}>Gender *</label>
            <select {...register("gender")} className={sel}>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <div>
            <label className={lbl}>Blood Group</label>
            <input {...register("bloodGroup")} className={inp} placeholder="e.g. O+" />
          </div>
          <div>
            <label className={lbl}>Nationality</label>
            <input {...register("nationality")} className={inp} placeholder="e.g. Indian" />
          </div>
          <div>
            <label className={lbl}>Religion</label>
            <input {...register("religion")} className={inp} placeholder="e.g. Islam" />
          </div>
          <div>
            <label className={lbl}>Admission Date *</label>
            <input type="date" {...register("admissionDate")} className={inp} />
          </div>
          <div>
            <label className={lbl}>Identification Mark</label>
            <input {...register("identificationMark")} className={inp} placeholder="e.g. Mole on right cheek" />
          </div>
          <div>
            <label className={lbl}>Aadhaar Number</label>
            <input {...register("aadhaarNumber")} className={inp} placeholder="12-digit Aadhaar" maxLength={12} />
          </div>
          <div className="md:col-span-2">
            <label className={lbl}>Medical Notes</label>
            <textarea {...register("medicalNotes")} rows={2} className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none resize-none" placeholder="Any medical conditions or notes" />
          </div>
        </div>
      </div>

      {/* Address Details */}
      <div className="bg-card border border-border rounded-lg p-6">
        <SectionTitle icon={<MapPin size={16} />} title="Address Details" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className={lbl}>House Name</label>
            <input {...register("houseName")} className={inp} placeholder="House / Building name" />
          </div>
          <div>
            <label className={lbl}>Place</label>
            <input {...register("place")} className={inp} placeholder="Locality / Village" />
          </div>
          <div>
            <label className={lbl}>Post Office</label>
            <input {...register("postOffice")} className={inp} placeholder="Post office name" />
          </div>
          <div>
            <label className={lbl}>Pincode</label>
            <input {...register("pincode")} className={inp} placeholder="6-digit pincode" maxLength={6} />
          </div>
          <div>
            <label className={lbl}>District</label>
            <input {...register("district")} className={inp} placeholder="District" />
          </div>
          <div className="md:col-span-2">
            <label className={lbl}>State</label>
            <input {...register("state")} className={inp} placeholder="State" />
          </div>
        </div>
      </div>

      {/* Educational Details */}
      <div className="bg-card border border-border rounded-lg p-6">
        <SectionTitle icon={<GraduationCap size={16} />} title="Educational Details" />
        <div className="space-y-4">
          <div className="bg-muted/50 rounded-md p-4 border border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">School</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className={lbl}>Name of School</label>
                <input {...register("schoolName")} className={inp} placeholder="Full school name" />
              </div>
              <div>
                <label className={lbl}>Present Class (School)</label>
                <input {...register("schoolClass")} className={inp} placeholder="e.g. 4th Standard" />
              </div>
            </div>
          </div>
          <div className="bg-muted/50 rounded-md p-4 border border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Madrasa</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className={lbl}>Name of Madrasa</label>
                <input {...register("madrasaName")} className={inp} placeholder="Full madrasa name" />
              </div>
              <div>
                <label className={lbl}>Affiliation Number</label>
                <input {...register("madrasaAffiliationNumber")} className={inp} placeholder="Affiliation No." />
              </div>
              <div>
                <label className={lbl}>Present Class (Madrasa)</label>
                <input {...register("madrasaClass")} className={inp} placeholder="e.g. 4th" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hifz Juz Progress */}
      <div className="bg-card border border-border rounded-lg p-6">
        <SectionTitle icon={<BookOpen size={16} />} title="Hifz Juz Progress" />

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mb-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-muted border border-border inline-block" />
            Not started
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-amber-400 inline-block" />
            In progress
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />
            Completed
          </span>
        </div>
        <p className="text-xs text-muted-foreground mb-4">Click a juz to cycle its status. Click &ldquo;Save Juz Progress&rdquo; to apply.</p>

        {/* 30-Juz Grid */}
        <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-10 gap-2 mb-5">
          {juzState.map((row) => {
            const colorMap: Record<JuzStatus, string> = {
              not_started: "bg-muted border-border text-muted-foreground hover:bg-muted/70",
              in_progress: "bg-amber-100 border-amber-400 text-amber-800 hover:bg-amber-200",
              completed: "bg-emerald-100 border-emerald-500 text-emerald-800 hover:bg-emerald-200",
            };
            const dotMap: Record<JuzStatus, string> = {
              not_started: "bg-muted-foreground/30",
              in_progress: "bg-amber-500",
              completed: "bg-emerald-500",
            };
            return (
              <button
                key={row.juzNumber}
                type="button"
                onClick={() => cycleJuzStatus(row.juzNumber)}
                title={`Juz ${row.juzNumber} — ${row.status.replace("_", " ")}`}
                className={`relative flex flex-col items-center justify-center gap-1 h-14 rounded-md border text-xs font-semibold transition-all select-none ${colorMap[row.status]}`}
              >
                <span className={`w-2 h-2 rounded-full ${dotMap[row.status]}`} />
                <span>{row.juzNumber}</span>
              </button>
            );
          })}
        </div>

        {/* Summary */}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-4">
          <span className="font-medium text-emerald-600">
            {juzState.filter((r) => r.status === "completed").length} completed
          </span>
          <span className="font-medium text-amber-600">
            {juzState.filter((r) => r.status === "in_progress").length} in progress
          </span>
          <span>
            {juzState.filter((r) => r.status === "not_started").length} not started
          </span>
        </div>

        <button
          type="button"
          onClick={saveJuzProgress}
          disabled={isJuzPending}
          className="px-5 py-2 bg-emerald-600 text-white text-sm font-medium rounded-md hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
        >
          {isJuzPending ? <><Loader2 size={14} className="animate-spin" />Saving...</> : "Save Juz Progress"}
        </button>
      </div>

      {/* Parent & Guardian Details */}
      <div className="bg-card border border-border rounded-lg p-6">
        <SectionTitle icon={<Phone size={16} />} title="Parent & Guardian Details" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Father&apos;s Name *</label>
            <input {...register("fatherName")} className={inp} placeholder="Father's full name" />
            {errors.fatherName && <p className="text-xs text-red-500 mt-1">{errors.fatherName.message}</p>}
          </div>
          <div>
            <label className={lbl}>Father&apos;s Occupation</label>
            <input {...register("fatherOccupation")} className={inp} placeholder="e.g. Business, Teacher" />
          </div>
          <div>
            <label className={lbl}>Mother&apos;s Name</label>
            <input {...register("motherName")} className={inp} placeholder="Mother's full name" />
          </div>
          <div>
            <label className={lbl}>Guardian&apos;s Name</label>
            <input {...register("guardianName")} className={inp} placeholder="Guardian's full name" />
          </div>
          <div>
            <label className={lbl}>Relation with Guardian</label>
            <input {...register("guardianRelation")} className={inp} placeholder="e.g. Father, Uncle" />
          </div>
          <div>
            <label className={lbl}>Phone Number *</label>
            <input {...register("primaryPhone")} type="tel" className={inp} placeholder="10-digit number" />
            {errors.primaryPhone && <p className="text-xs text-red-500 mt-1">{errors.primaryPhone.message}</p>}
          </div>
          <div>
            <label className={lbl}>WhatsApp Number</label>
            <input {...register("whatsappNumber")} type="tel" className={inp} placeholder="WhatsApp number" />
          </div>
          <div>
            <label className={lbl}>Email</label>
            <input {...register("email")} type="email" className={inp} placeholder="Email address" />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <Link
          href={`/admin/students/${studentId}`}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md border border-border hover:bg-muted transition-colors"
        >
          <ArrowLeft size={14} /> Back to Profile
        </Link>
        <div className="flex items-center gap-3">
          {isDirty && <p className="text-xs text-muted-foreground">Unsaved changes</p>}
          <button
            type="submit"
            disabled={isPending || !isDirty}
            className="px-6 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
          >
            {isPending ? <><Loader2 size={14} className="animate-spin" />Saving...</> : "Save Changes"}
          </button>
        </div>
      </div>
    </form>
  );
}
