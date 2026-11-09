"use client";

import { useState, useTransition, useMemo } from "react";
import { saveBulkExamMarks, saveHifzExamResults } from "@/lib/actions/exams";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Save, AlertCircle } from "lucide-react";

type Subject = {
  id: string;
  name: string;
  totalMarks: number;
  passMarks: number;
};

type Student = {
  id: string;
  firstName: string;
  lastName: string | null;
  studentCode: string;
};

type Mark = {
  examSubjectId: string;
  studentId: string;
  marksObtained: string | null;
  isAbsent: boolean;
  remarks: string | null;
};

/** Exam-specific Hifz values, shown only for Hifz exam sessions. */
type HifzJuzRow = { studentId: string; juzToObtain: number | null; juzMemorized: number | null; remarks: string | null };

interface MarkEntryGridProps {
  examSession: {
    id: string;
    name: string;
    resultStatus: string;
  };
  examClass: {
    id: string;
    name: string;
  };
  subjects: Subject[];
  students: Student[];
  initialMarks: Mark[];
  /** Present only for Hifz exams. `ready` is false until migration 0010 is applied. */
  hifzJuz?: { ready: boolean; initial: HifzJuzRow[] };
}

export function MarkEntryGrid({
  examSession,
  examClass,
  subjects,
  students,
  initialMarks,
  hifzJuz,
}: MarkEntryGridProps) {
  const [isPending, startTransition] = useTransition();
  const isPublished = examSession.resultStatus === "published";

  // Create a fast lookup structure for marks
  // Map key: `${studentId}-${subjectId}`
  const initialMarksMap = useMemo(() => {
    const map = new Map<string, Mark>();
    initialMarks.forEach((m) => {
      map.set(`${m.studentId}-${m.examSubjectId}`, m);
    });
    return map;
  }, [initialMarks]);

  const [marksState, setMarksState] = useState<Map<string, Mark>>(initialMarksMap);
  const [hasChanges, setHasChanges] = useState(false);

  // Hifz Juz values (to be obtained / memorized / remarks) per student
  const juzEnabled = !!hifzJuz?.ready;
  type JuzCell = { obtain: string; memorized: string; remarks: string };
  const [juzState, setJuzState] = useState<Map<string, JuzCell>>(() => {
    const m = new Map<string, JuzCell>();
    hifzJuz?.initial.forEach((r) =>
      m.set(r.studentId, { obtain: r.juzToObtain?.toString() ?? "", memorized: r.juzMemorized?.toString() ?? "", remarks: r.remarks ?? "" })
    );
    return m;
  });
  const [juzDirty, setJuzDirty] = useState<Set<string>>(new Set());
  const getJuz = (studentId: string): JuzCell => juzState.get(studentId) ?? { obtain: "", memorized: "", remarks: "" };
  const handleJuzChange = (studentId: string, field: keyof JuzCell, value: string) => {
    if (isPublished) return;
    if (field !== "remarks" && value !== "" && !/^\d{0,2}(\.\d?)?$/.test(value)) return;
    // functional update: always builds on the latest state, so quick successive edits never overwrite each other
    setJuzState((prev) => {
      const cur = prev.get(studentId) ?? { obtain: "", memorized: "", remarks: "" };
      return new Map(prev).set(studentId, { ...cur, [field]: value });
    });
    setJuzDirty((prev) => new Set(prev).add(studentId));
  };

  const getMark = (studentId: string, subjectId: string): Mark => {
    const key = `${studentId}-${subjectId}`;
    return (
      marksState.get(key) || {
        examSubjectId: subjectId,
        studentId,
        marksObtained: null,
        isAbsent: false,
        remarks: null,
      }
    );
  };

  const handleMarkChange = (studentId: string, subjectId: string, value: string) => {
    if (isPublished) return;
    const key = `${studentId}-${subjectId}`;
    const current = getMark(studentId, subjectId);
    
    // Only allow valid numbers
    if (value !== "" && isNaN(Number(value))) return;

    const newMarksState = new Map(marksState);
    newMarksState.set(key, {
      ...current,
      marksObtained: value === "" ? null : value,
    });
    
    setMarksState(newMarksState);
    setHasChanges(true);
  };

  const handleAbsentChange = (studentId: string, subjectId: string, checked: boolean) => {
    if (isPublished) return;
    const key = `${studentId}-${subjectId}`;
    const current = getMark(studentId, subjectId);
    
    const newMarksState = new Map(marksState);
    newMarksState.set(key, {
      ...current,
      isAbsent: checked,
      marksObtained: checked ? null : current.marksObtained, // Clear marks if absent
    });
    
    setMarksState(newMarksState);
    setHasChanges(true);
  };

  const handleSave = () => {
    if (isPublished || (!hasChanges && juzDirty.size === 0)) return;

    startTransition(async () => {
      // Include rows that have marks entered OR are marked absent
      const marksArray = Array.from(marksState.values()).filter(
        (m) => m.marksObtained !== null || m.isAbsent
      );

      if (marksArray.length === 0 && juzDirty.size === 0) {
        toast.info("No marks to save yet.");
        return;
      }

      if (marksArray.length > 0 && hasChanges) {
        const res = await saveBulkExamMarks({ marks: marksArray });
        if (!res.success) {
          const errMsg = "error" in res && typeof (res as any).error === "string" ? (res as any).error : "Failed to save marks";
          toast.error(errMsg);
          return;
        }
      }

      if (juzEnabled && juzDirty.size > 0) {
        const jr = await saveHifzExamResults({
          examSessionId: examSession.id,
          rows: [...juzDirty].map((studentId) => {
            const j = getJuz(studentId);
            return { studentId, juzToObtain: j.obtain, juzMemorized: j.memorized, remarks: j.remarks.trim() || null };
          }),
        });
        if (!jr.success) {
          toast.error(jr.error ?? "Marks saved, but Juz values failed to save");
          setHasChanges(false);
          return;
        }
        setJuzDirty(new Set());
      }

      toast.success("Saved successfully");
      setHasChanges(false);
    });
  };

  if (subjects.length === 0) {
    return (
      <div className="rounded-md border bg-destructive/10 text-destructive px-4 py-3 flex gap-3">
        <AlertCircle className="h-5 w-5 mt-0.5" />
        <div>
          <h5 className="font-medium leading-none mb-1">No Subjects</h5>
          <p className="text-sm">
            There are no subjects assigned to this class for this exam. 
            Please contact the administrator to assign subjects first.
          </p>
        </div>
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="rounded-md border bg-card text-card-foreground px-4 py-3 flex gap-3">
        <AlertCircle className="h-5 w-5 mt-0.5 text-muted-foreground" />
        <div>
          <h5 className="font-medium leading-none mb-1">No Students</h5>
          <p className="text-sm text-muted-foreground">
            There are no active students enrolled in this class.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isPublished && (
        <div className="rounded-md border bg-destructive/10 text-destructive px-4 py-3 flex gap-3">
          <AlertCircle className="h-5 w-5 mt-0.5" />
          <div>
            <h5 className="font-medium leading-none mb-1">Results Published</h5>
            <p className="text-sm">
              These exam results have been published. Mark entry is locked and cannot be modified.
            </p>
          </div>
        </div>
      )}

      {hifzJuz && !hifzJuz.ready && (
        <div className="rounded-md border bg-amber-50 text-amber-800 border-amber-200 px-4 py-3 text-sm">
          Juz to be Obtained / Juz Memorized entry needs a one-time database update (migration 0010). Marks can still be entered.
        </div>
      )}

      <div className="flex justify-between items-center bg-card p-4 rounded-lg border shadow-sm">
        <div>
          <h3 className="font-semibold">{examClass.name} — Mark Entry</h3>
          <p className="text-sm text-muted-foreground">
            {students.length} students • {subjects.length} subjects
          </p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={isPublished || (!hasChanges && juzDirty.size === 0) || isPending}
        >
          <Save className="w-4 h-4 mr-2" />
          {isPending ? "Saving..." : juzEnabled ? "Save Marks & Juz" : "Save Marks"}
        </Button>
      </div>

      <div className="rounded-md border bg-card overflow-x-auto shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="px-4 py-3 text-left font-medium w-[250px] sticky left-0 bg-muted/50 z-10">
                Student
              </th>
              {subjects.map((sub) => (
                <th key={sub.id} className="px-4 py-3 text-center font-medium min-w-[150px]">
                  <div>{sub.name}</div>
                  <div className="text-xs text-muted-foreground font-normal">
                    Max: {sub.totalMarks} | Pass: {sub.passMarks}
                  </div>
                </th>
              ))}
              {juzEnabled && (
                <>
                  <th className="px-4 py-3 text-center font-medium min-w-[120px]">Juz to be Obtained<div className="text-xs text-muted-foreground font-normal">0 – 30</div></th>
                  <th className="px-4 py-3 text-center font-medium min-w-[120px]">Juz Memorized<div className="text-xs text-muted-foreground font-normal">0 – 30</div></th>
                  <th className="px-4 py-3 text-center font-medium min-w-[200px]">Remarks</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y">
            {students.map((student) => (
              <tr key={student.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 sticky left-0 bg-card z-10 font-medium">
                  <div>{student.firstName} {student.lastName}</div>
                  <div className="text-xs text-muted-foreground font-normal">{student.studentCode}</div>
                </td>
                {subjects.map((sub) => {
                  const mark = getMark(student.id, sub.id);
                  const isInvalid = mark.marksObtained !== null && Number(mark.marksObtained) > sub.totalMarks;
                  
                  return (
                    <td key={sub.id} className="px-4 py-3">
                      <div className="flex flex-col items-center gap-2">
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={mark.marksObtained || ""}
                          onChange={(e) => handleMarkChange(student.id, sub.id, e.target.value)}
                          disabled={isPublished || mark.isAbsent}
                          className={`w-20 text-center ${isInvalid ? 'border-destructive focus-visible:ring-destructive' : ''} ${mark.isAbsent ? 'opacity-50' : ''}`}
                          placeholder="-"
                        />
                        <div className="flex items-center space-x-1.5">
                          <Checkbox
                            id={`absent-${student.id}-${sub.id}`}
                            checked={mark.isAbsent}
                            onCheckedChange={(checked) => handleAbsentChange(student.id, sub.id, checked === true)}
                            disabled={isPublished}
                            className="h-3.5 w-3.5"
                          />
                          <label 
                            htmlFor={`absent-${student.id}-${sub.id}`}
                            className="text-[10px] font-medium leading-none cursor-pointer text-muted-foreground select-none"
                          >
                            Absent
                          </label>
                        </div>
                      </div>
                    </td>
                  );
                })}
                {juzEnabled && (
                  <>
                    <td className="px-4 py-3 text-center">
                      <Input type="text" inputMode="decimal" value={getJuz(student.id).obtain} onChange={(e) => handleJuzChange(student.id, "obtain", e.target.value)} disabled={isPublished} className="w-20 text-center mx-auto" placeholder="-" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Input type="text" inputMode="decimal" value={getJuz(student.id).memorized} onChange={(e) => handleJuzChange(student.id, "memorized", e.target.value)} disabled={isPublished} className="w-20 text-center mx-auto" placeholder="-" />
                    </td>
                    <td className="px-4 py-3">
                      <Input type="text" maxLength={300} value={getJuz(student.id).remarks} onChange={(e) => handleJuzChange(student.id, "remarks", e.target.value)} disabled={isPublished} placeholder="Optional" />
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
