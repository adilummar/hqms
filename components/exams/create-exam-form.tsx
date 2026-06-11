"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createExamSession } from "@/lib/actions/exams";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

const schema = z.object({
  name: z.string().min(1, "Required"),
  track: z.enum(["school", "madrasa", "hifz"]),
  academicYearId: z.string().min(1, "Required"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const inp = "w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all";
const lbl = "block text-sm font-medium text-foreground mb-1";
const sel = "w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none";

interface Props {
  academicYears: { id: string; label: string; isCurrent: boolean }[];
}

export function CreateExamForm({ academicYears }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const currentYear = academicYears.find(y => y.isCurrent);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { track: "madrasa", academicYearId: currentYear?.id ?? "" },
  });

  function onSubmit(data: FormData) {
    startTransition(async () => {
      const result = await createExamSession(data);
      if (result.success && result.data) {
        toast.success("Exam session created");
        router.push(`/admin/exams/${result.data.id}`);
      } else {
        toast.error("Failed to create exam");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-xl space-y-5">
      <div>
        <label className={lbl}>Exam Name *</label>
        <input {...register("name")} className={inp} placeholder="e.g. First Term Exam 2025" />
        {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
      </div>

      <div>
        <label className={lbl}>Track *</label>
        <select {...register("track")} className={sel}>
          <option value="school">School</option>
          <option value="madrasa">Madrasa</option>
          <option value="hifz">Hifz</option>
        </select>
      </div>

      <div>
        <label className={lbl}>Academic Year *</label>
        <select {...register("academicYearId")} className={sel}>
          <option value="">Select year</option>
          {academicYears.map(y => (
            <option key={y.id} value={y.id}>
              {y.label} {y.isCurrent ? "(Current)" : ""}
            </option>
          ))}
        </select>
        {errors.academicYearId && <p className="text-xs text-red-500 mt-1">{errors.academicYearId.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={lbl}>Start Date</label>
          <input type="date" {...register("startDate")} className={inp} />
        </div>
        <div>
          <label className={lbl}>End Date</label>
          <input type="date" {...register("endDate")} className={inp} />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="px-6 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center gap-2"
        >
          {isPending ? <><Loader2 size={14} className="animate-spin" />Creating...</> : "Create & Set Up Subjects →"}
        </button>
        <a href="/admin/exams" className="px-4 py-2 border border-border text-sm rounded-md hover:bg-muted transition-colors">
          Cancel
        </a>
      </div>
    </form>
  );
}
