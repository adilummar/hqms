"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createExamination } from "@/lib/actions/examinations";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

const schema = z.object({
  name: z.string().min(1, "Required"),
  tracks: z.array(z.enum(["school", "madrasa", "hifz"])).min(1, "Select at least one track"),
  academicYearId: z.string().min(1, "Required"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  tutorMarkEntryOnly: z.boolean(),
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
    defaultValues: { tracks: ["school", "madrasa", "hifz"], academicYearId: currentYear?.id ?? "", tutorMarkEntryOnly: false },
  });

  function onSubmit(data: FormData) {
    startTransition(async () => {
      const result = await createExamination(data);
      if (result.success && "id" in result) {
        toast.success("Examination created");
        router.push(`/admin/exams/${result.id}`);
      } else {
        toast.error("error" in result ? result.error : "Failed to create examination");
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
        <label className={lbl}>Tracks Included *</label>
        <div className="flex gap-4 items-center">
          {(["school", "madrasa", "hifz"] as const).map(track => (
            <label key={track} className="flex items-center gap-2 text-sm">
              <input type="checkbox" value={track} {...register("tracks")} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
              <span className="capitalize">{track}</span>
            </label>
          ))}
        </div>
        {errors.tracks && <p className="text-xs text-red-500 mt-1">{errors.tracks.message}</p>}
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

      <div className="flex items-center space-x-2 pt-2">
        <input 
          type="checkbox" 
          id="tutorMarkEntryOnly" 
          {...register("tutorMarkEntryOnly")} 
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" 
        />
        <label htmlFor="tutorMarkEntryOnly" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          Restrict mark entry to assigned class tutors only
        </label>
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
