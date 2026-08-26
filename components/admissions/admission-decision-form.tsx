"use client";

import { useState } from "react";
import { admitApplicationFromForm } from "@/lib/actions/admissions";

interface ClassItem {
  id: string;
  name: string;
  track: "school" | "madrasa" | "hifz";
  academicYearId: string;
}

interface AcademicYear {
  id: string;
  label: string;
  isCurrent: boolean;
}

interface Props {
  applicationId: string;
  academicYears: AcademicYear[];
  classes: ClassItem[];
}

export function AdmissionDecisionForm({ applicationId, academicYears, classes }: Props) {
  const defaultYear = academicYears.find((y) => y.isCurrent)?.id ?? academicYears[0]?.id ?? "";
  const [selectedYear, setSelectedYear] = useState(defaultYear);

  const filteredClasses = classes.filter((c) => c.academicYearId === selectedYear);
  const hifzClasses = filteredClasses.filter((c) => c.track === "hifz");
  const madrasaClasses = filteredClasses.filter((c) => c.track === "madrasa");
  const schoolClasses = filteredClasses.filter((c) => c.track === "school");

  const canAdmit = hifzClasses.length > 0 && madrasaClasses.length > 0 && schoolClasses.length > 0;

  return (
    <form action={admitApplicationFromForm} className="space-y-3 border border-green-200 bg-green-50/60 rounded-sm p-3">
      <input type="hidden" name="applicationId" value={applicationId} />

      <div>
        <label className="block text-xs text-muted-foreground mb-1">Academic Year</label>
        <select
          required
          name="academicYearId"
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
          className="w-full h-9 px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
        >
          <option value="">Select Academic Year</option>
          {academicYears.map((year) => (
            <option key={year.id} value={year.id}>
              {year.label} {year.isCurrent ? "(Current)" : ""}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs text-muted-foreground mb-1">Hifz Class</label>
        <select
          required
          name="hifzClassId"
          defaultValue={hifzClasses[0]?.id ?? ""}
          className="w-full h-9 px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground disabled:opacity-50"
          disabled={hifzClasses.length === 0}
        >
          <option value="">Select Hifz Class</option>
          {hifzClasses.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs text-muted-foreground mb-1">Madrasa Class</label>
        <select
          required
          name="madrasaClassId"
          defaultValue={madrasaClasses[0]?.id ?? ""}
          className="w-full h-9 px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground disabled:opacity-50"
          disabled={madrasaClasses.length === 0}
        >
          <option value="">Select Madrasa Class</option>
          {madrasaClasses.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs text-muted-foreground mb-1">School Class</label>
        <select
          required
          name="schoolClassId"
          defaultValue={schoolClasses[0]?.id ?? ""}
          className="w-full h-9 px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground disabled:opacity-50"
          disabled={schoolClasses.length === 0}
        >
          <option value="">Select School Class</option>
          {schoolClasses.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Year</label>
          <select name="yearOfStudy" defaultValue="1st" className="w-full h-9 px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground">
            <option value="1st">1st</option>
            <option value="2nd">2nd</option>
            <option value="3rd">3rd</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Admission Date</label>
          <input
            required
            name="admissionDate"
            type="date"
            defaultValue={new Date().toISOString().split("T")[0]}
            className="w-full h-9 px-3 text-sm border border-border rounded-sm bg-background focus:outline-none focus:ring-1 focus:ring-foreground"
          />
        </div>
      </div>

      {!canAdmit && selectedYear && (
        <p className="text-[11px] text-red-600 font-medium">
          The selected academic year is missing active classes in one or more tracks (Hifz/Madrasa/School).
        </p>
      )}

      <button
        disabled={!canAdmit}
        className="w-full h-9 bg-green-700 text-white text-sm font-medium rounded-sm hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Give Admission
      </button>
    </form>
  );
}
