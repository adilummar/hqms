"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { initializeAcademicYearTargets, recalculateStudentTarget, manualOverrideStudentTarget } from "@/lib/actions/hifz-targets";
import { Button } from "@/components/ui/button";

export function TargetAdminControls({ 
  academicYearId,
  students 
}: { 
  academicYearId: string;
  students: {
    id: string;
    name: string;
    targetId: string | null;
    targetJuzAmount: string | null;
    calculatedTotalPages: number | null;
    startingJuzNumber: number | null;
    startingPage: number | null;
    isManualOverride: boolean;
  }[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [overrideStudentId, setOverrideStudentId] = useState<string | null>(null);
  const [overridePages, setOverridePages] = useState("");
  const [overrideJuz, setOverrideJuz] = useState("");

  async function handleInit() {
    setLoading(true);
    try {
      const res = await initializeAcademicYearTargets(academicYearId);
      if (res.success) {
        alert(`Initialized ${res.count} new targets.`);
        router.refresh();
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRecalc(studentId: string) {
    if (!confirm("This will recalculate the student's target baseline from their historical starting position. Continue?")) return;
    setLoading(true);
    try {
      const res = await recalculateStudentTarget(studentId, academicYearId);
      if (res.success) {
        alert("Target recalculated.");
        router.refresh();
      } else {
        alert("Error: " + res.error);
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleOverrideSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!overrideStudentId) return;
    setLoading(true);
    try {
      const res = await manualOverrideStudentTarget(
        overrideStudentId,
        academicYearId,
        Number(overrideJuz),
        Number(overridePages)
      );
      if (res.success) {
        alert("Target overridden.");
        setOverrideStudentId(null);
        router.refresh();
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-card border border-border p-5 rounded-lg shadow-sm">
        <div>
          <h3 className="text-lg font-playfair font-semibold">Automatic Target Initialization</h3>
          <p className="text-sm text-muted-foreground mt-1">Generates baselines for students missing an annual target.</p>
        </div>
        <Button onClick={handleInit} disabled={loading}>
          {loading ? "Processing..." : "Initialize Missing Targets"}
        </Button>
      </div>

      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-playfair font-semibold">Student Annual Targets</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Student</th>
                <th className="px-4 py-3 text-left font-medium">Annual Target</th>
                <th className="px-4 py-3 text-left font-medium">Calculated Pages</th>
                <th className="px-4 py-3 text-left font-medium">Starting Pos</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {students.map(s => (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3">{s.targetJuzAmount ? `${s.targetJuzAmount} Juz` : "Not Set"}</td>
                  <td className="px-4 py-3">{s.calculatedTotalPages ? `${s.calculatedTotalPages} pages` : "—"}</td>
                  <td className="px-4 py-3">
                    {s.startingJuzNumber ? `Juz ${s.startingJuzNumber}, Pg ${s.startingPage}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {s.targetId ? (
                      s.isManualOverride ? (
                        <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-md font-medium">MANUAL OVERRIDE</span>
                      ) : (
                        <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded-md font-medium">AUTOMATIC TARGET</span>
                      )
                    ) : (
                      <span className="text-muted-foreground text-xs">PENDING</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Button variant="outline" size="sm" onClick={() => handleRecalc(s.id)} disabled={loading}>
                      Recalculate
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => {
                      setOverrideStudentId(s.id);
                      setOverrideJuz(s.targetJuzAmount || "1");
                      setOverridePages(s.calculatedTotalPages?.toString() || "");
                    }} disabled={loading}>
                      Override
                    </Button>
                  </td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No active students found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {overrideStudentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border p-6 rounded-xl shadow-lg w-full max-w-sm">
            <h3 className="font-playfair text-lg font-semibold mb-4">Manual Target Override</h3>
            <form onSubmit={handleOverrideSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Target Juz Amount</label>
                <input 
                  type="number" step="0.1" required
                  className="w-full mt-1 px-3 py-2 border border-border rounded-md bg-background"
                  value={overrideJuz} onChange={e => setOverrideJuz(e.target.value)} 
                />
              </div>
              <div>
                <label className="text-sm font-medium">Calculated Target Pages</label>
                <input 
                  type="number" required
                  className="w-full mt-1 px-3 py-2 border border-border rounded-md bg-background"
                  value={overridePages} onChange={e => setOverridePages(e.target.value)} 
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" type="button" onClick={() => setOverrideStudentId(null)}>Cancel</Button>
                <Button type="submit" disabled={loading}>Save Override</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
