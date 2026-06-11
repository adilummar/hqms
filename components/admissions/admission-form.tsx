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

interface Props {
  hifzClasses: ClassType[];
  madrasaClasses: ClassType[];
  schoolClasses: ClassType[];
  academicYearId: string;
}

export function AdmissionForm({ hifzClasses, madrasaClasses, schoolClasses, academicYearId }: Props) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setIsPending(true);
    formData.append("academicYearId", academicYearId);
    
    try {
      const result = await submitAdmissionForm(formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Student admitted successfully!");
        router.push("/admin/students");
      }
    } catch {
      toast.error("An unexpected error occurred.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form action={onSubmit} className="space-y-8">
      {/* Student Details */}
      <div>
        <h3 className="text-lg font-playfair font-semibold mb-4 text-foreground border-b border-border pb-2">
          Student Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">First Name *</label>
            <input required name="firstName" type="text" className="w-full h-10 px-3 rounded-md border border-border bg-background" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">Last Name</label>
            <input name="lastName" type="text" className="w-full h-10 px-3 rounded-md border border-border bg-background" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">Date of Birth *</label>
            <input required name="dateOfBirth" type="date" className="w-full h-10 px-3 rounded-md border border-border bg-background" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">Gender *</label>
            <select required name="gender" className="w-full h-10 px-3 rounded-md border border-border bg-background">
              <option value="">Select Gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">Blood Group</label>
            <input name="bloodGroup" type="text" placeholder="e.g. O+" className="w-full h-10 px-3 rounded-md border border-border bg-background" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">Admission Date *</label>
            <input required name="admissionDate" type="date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full h-10 px-3 rounded-md border border-border bg-background" />
          </div>
          <div className="col-span-1 md:col-span-2 space-y-1">
            <label className="text-sm font-medium text-muted-foreground">Address *</label>
            <textarea required name="address" rows={3} className="w-full p-3 rounded-md border border-border bg-background resize-none" />
          </div>
        </div>
      </div>

      {/* Parent Details */}
      <div>
        <h3 className="text-lg font-playfair font-semibold mb-4 text-foreground border-b border-border pb-2">
          Parent/Guardian Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">Father&apos;s Name *</label>
            <input required name="fatherName" type="text" className="w-full h-10 px-3 rounded-md border border-border bg-background" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">Mother&apos;s Name</label>
            <input name="motherName" type="text" className="w-full h-10 px-3 rounded-md border border-border bg-background" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">Primary Phone *</label>
            <input required name="primaryPhone" type="tel" className="w-full h-10 px-3 rounded-md border border-border bg-background" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">Secondary Phone</label>
            <input name="secondaryPhone" type="tel" className="w-full h-10 px-3 rounded-md border border-border bg-background" />
          </div>
        </div>
      </div>

      {/* Class Assignment */}
      <div>
        <h3 className="text-lg font-playfair font-semibold mb-4 text-foreground border-b border-border pb-2">
          Class Assignment
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">Hifz Class *</label>
            <select required name="hifzClassId" className="w-full h-10 px-3 rounded-md border border-border bg-background">
              <option value="">Select Hifz Class</option>
              {hifzClasses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">Madrasa Class *</label>
            <select required name="madrasaClassId" className="w-full h-10 px-3 rounded-md border border-border bg-background">
              <option value="">Select Madrasa Class</option>
              {madrasaClasses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-muted-foreground">School Class *</label>
            <select required name="schoolClassId" className="w-full h-10 px-3 rounded-md border border-border bg-background">
              <option value="">Select School Class</option>
              {schoolClasses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <Button type="submit" disabled={isPending} className="bg-foreground text-background hover:bg-foreground/90">
          {isPending ? "Submitting..." : "Submit Admission"}
        </Button>
      </div>
    </form>
  );
}
