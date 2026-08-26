"use client";

import { useState, useTransition } from "react";
import { promoteStudent, bulkPromoteByClass } from "@/lib/actions/academic-year";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle, ArrowRight } from "lucide-react";

interface PendingStudent {
  id: string; // enrollment id
  studentId: string;
  studentCode: string;
  name: string;
  classId: string;
  className: string;
  yearOfStudy: string | null;
}

interface Props {
  pendingStudents: PendingStudent[];
  newAcademicYearId: string;
  yearLabel: string;
}

function nextYos(current: string | null) {
  const map: Record<string, string> = { "1st": "2nd", "2nd": "3rd", "3rd": "3rd" };
  return map[current ?? "1st"] ?? "2nd";
}

export function PromoteStudentsClient({ pendingStudents, newAcademicYearId, yearLabel }: Props) {
  const router = useRouter();
  const [promoting, setPromoting] = useState<Set<string>>(new Set());
  const [promoted, setPromoted] = useState<Set<string>>(new Set());
  const [isBulkPending, startBulkTransition] = useTransition();

  // Group by class
  const byClass = pendingStudents.reduce<Record<string, PendingStudent[]>>((acc, s) => {
    if (!acc[s.classId]) acc[s.classId] = [];
    acc[s.classId].push(s);
    return acc;
  }, {});

  async function handlePromote(studentId: string) {
    setPromoting((prev) => new Set([...prev, studentId]));
    const res = await promoteStudent(studentId, newAcademicYearId);
    setPromoting((prev) => { const n = new Set(prev); n.delete(studentId); return n; });

    if (res.success) {
      setPromoted((prev) => new Set([...prev, studentId]));
      toast.success("Student promoted successfully!");
    } else {
      toast.error(res.error ?? "Failed to promote student");
    }
  }

  function handleBulkClass(classId: string) {
    startBulkTransition(async () => {
      const res = await bulkPromoteByClass(classId, newAcademicYearId);
      if (res.success) {
        const classStudents = byClass[classId] ?? [];
        setPromoted((prev) => new Set([...prev, ...classStudents.map((s) => s.studentId)]));
        toast.success(`Promoted ${res.succeeded} student(s)${res.failed ? `, ${res.failed} failed` : ""}`);
      } else {
        toast.error("Bulk promotion failed");
      }
    });
  }

  const remaining = pendingStudents.filter((s) => !promoted.has(s.studentId));

  if (remaining.length === 0) {
    return (
      <div className="border border-green-200 bg-green-50 rounded-lg p-10 text-center">
        <CheckCircle className="mx-auto text-green-500 mb-3" size={40} />
        <p className="font-playfair text-lg font-semibold text-green-800">
          All students promoted to {yearLabel}!
        </p>
        <p className="text-sm text-green-600 mt-1">
          Every active student now has an enrollment in the new academic year.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          <span className="font-jetbrains font-semibold text-foreground">{remaining.length}</span> student(s) pending promotion to{" "}
          <span className="font-medium">{yearLabel}</span>
        </p>
      </div>

      {Object.entries(byClass).map(([classId, classStudents]) => {
        const pendingInClass = classStudents.filter((s) => !promoted.has(s.studentId));
        if (pendingInClass.length === 0) return null;
        const className = pendingInClass[0].className;

        return (
          <div key={classId} className="border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b border-border">
              <h3 className="font-playfair font-semibold text-sm text-foreground">
                Class {className}
                <span className="ml-2 text-xs font-jetbrains text-muted-foreground font-normal">
                  ({pendingInClass.length} pending)
                </span>
              </h3>
              <button
                onClick={() => handleBulkClass(classId)}
                disabled={isBulkPending}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-foreground text-background rounded-sm hover:bg-foreground/80 transition-colors disabled:opacity-50"
              >
                {isBulkPending ? <Loader2 size={12} className="animate-spin" /> : null}
                Promote All in Class
              </button>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
                    Student
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
                    Current Year
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
                    Will Become
                  </th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pendingInClass.map((s) => {
                  const isLoading = promoting.has(s.studentId);
                  const isDone = promoted.has(s.studentId);
                  return (
                    <tr key={s.studentId} className={isDone ? "bg-green-50/50" : "hover:bg-muted/20"}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground text-sm">{s.name}</p>
                        <p className="text-xs text-muted-foreground font-jetbrains">{s.studentCode}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-sm">
                        {s.yearOfStudy ?? "1st"} Year
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-sm text-foreground">
                          <ArrowRight size={14} className="text-muted-foreground" />
                          {nextYos(s.yearOfStudy)} Year
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isDone ? (
                          <span className="text-xs text-green-600 font-medium flex items-center justify-end gap-1">
                            <CheckCircle size={13} /> Promoted
                          </span>
                        ) : (
                          <button
                            onClick={() => handlePromote(s.studentId)}
                            disabled={isLoading}
                            className="flex items-center gap-1.5 text-xs px-3 py-1.5 border border-border rounded-sm hover:bg-muted transition-colors disabled:opacity-50 ml-auto"
                          >
                            {isLoading ? <Loader2 size={12} className="animate-spin" /> : null}
                            Promote
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
