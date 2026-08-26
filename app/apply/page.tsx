"use client";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { applicationFormSchema, type ApplicationFormInput } from "@/lib/validators/admission.schema";
import { submitApplication } from "@/lib/actions/admissions";
import { uploadFile } from "@/lib/actions/upload";
import { toast } from "sonner";
import { Loader2, CheckCircle, UploadCloud, AlertCircle, GraduationCap } from "lucide-react";

const STEPS = ["Instructions","Personal Details","Address Details","Educational Details","Guardian & Contact","Payment & Submit"];
const inp = "w-full h-11 px-4 rounded-md border border-input bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none text-sm";
const lbl = "block text-sm font-medium text-foreground mb-1.5";
const err = "text-xs text-red-500 mt-1";

export default function ApplyPage() {
  const [step, setStep] = useState(0);
  const [submittedApp, setSubmittedApp] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [photoUploading, setPhotoUploading] = useState(false);
  const [paymentUploading, setPaymentUploading] = useState(false);

  const { register, handleSubmit, trigger, setValue, control, formState: { errors } } =
    useForm<ApplicationFormInput>({ resolver: zodResolver(applicationFormSchema) });

  const photoUrl = useWatch({ control, name: "photoUrl" });
  const paymentScreenshotUrl = useWatch({ control, name: "paymentScreenshotUrl" });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: "photoUrl" | "paymentScreenshotUrl") => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) { toast.error("File too large (max 100MB)"); return; }
    if (field === "photoUrl") setPhotoUploading(true); else setPaymentUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await uploadFile(fd);
      if (res.success && res.url) { setValue(field, res.url, { shouldValidate: true }); toast.success("Uploaded!"); }
      else toast.error(res.error || "Upload failed");
    } catch { toast.error("Upload error"); }
    finally { if (field === "photoUrl") setPhotoUploading(false); else setPaymentUploading(false); }
  };

  const fieldsPerStep: (keyof ApplicationFormInput)[][] = [
    [],
    ["applicantName","fatherName","fatherOccupation","motherName","dateOfBirth","photoUrl","identificationMark"],
    ["houseName","place","postOffice","pincode","district","state"],
    ["aadhaarNumber","schoolName","schoolClass","madrasaName","madrasaAffiliationNumber","madrasaClass"],
    ["guardianName","guardianRelation","guardianPhone","alternatePhone"],
    ["paymentScreenshotUrl"],
  ];

  async function nextStep() {
    const valid = await trigger(fieldsPerStep[step]);
    if (valid) { setStep(s => Math.min(s + 1, STEPS.length - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }
    else toast.error("Please fill all required fields.");
  }

  function onSubmit(data: ApplicationFormInput) {
    startTransition(async () => {
      const result = await submitApplication(data);
      if (result.success && result.data && "applicationNumber" in result.data) {
        setSubmittedApp(result.data.applicationNumber);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else toast.error("Submission failed. Please try again.");
    });
  }

  if (submittedApp) return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card border border-border rounded-xl p-8 text-center shadow-lg">
        <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center mx-auto mb-5"><CheckCircle size={32} /></div>
        <h1 className="font-playfair text-2xl font-semibold mb-2">Application Submitted!</h1>
        <p className="text-muted-foreground mb-6 text-sm">Jazakallah Khair. We have received your application.</p>
        <div className="bg-muted border border-border rounded-lg p-5 mb-6">
          <p className="text-xs text-muted-foreground mb-1">Application Number</p>
          <p className="font-jetbrains text-2xl font-bold tracking-wider">{submittedApp}</p>
        </div>
        <p className="text-xs text-muted-foreground">Keep this number safe. We will contact you regarding the interview.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/30 pb-24">
      {/* Header */}
      <div className="bg-primary text-primary-foreground py-10 px-4 shadow-md relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
        <div className="max-w-3xl mx-auto relative z-10 text-center">
          <h2 className="text-base md:text-lg font-medium mb-1 text-primary-foreground/90 font-amiri" dir="rtl">കോളേജ് തഹ്ഫീളുൽ ഖുർആൻ മമ്പാട് ഇസ്ലാമിക്</h2>
          <h1 className="text-2xl md:text-3xl font-bold font-playfair tracking-tight mb-3">MIC THAHFEEZUL QUR&apos;AN COLLEGE</h1>
          <p className="text-xs md:text-sm text-primary-foreground/80">Udma West, Udma P.O., Kasaragod, Pin: 671319, Kerala<br className="hidden md:block" />Cell: +919744313222 | Email: mictqc@gmail.com</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 -mt-5 relative z-20">
        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
          {/* Progress */}
          <div className="flex h-1.5 bg-muted">
            {STEPS.map((_, i) => <div key={i} className={"flex-1 transition-all duration-500 " + (i <= step ? "bg-primary" : "bg-transparent")} />)}
          </div>
          <div className="p-6 md:p-10">
            {/* Step indicators */}
            <div className="hidden sm:flex items-center justify-between mb-10">
              {STEPS.map((label, i) => (
                <div key={label} className="flex flex-col items-center flex-1">
                  <div className={"w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mb-1.5 transition-colors " + (i < step ? "bg-primary text-primary-foreground" : i === step ? "border-2 border-primary text-primary" : "border-2 border-muted-foreground/30 text-muted-foreground/50")}>
                    {i < step ? "✓" : i + 1}
                  </div>
                  <span className={"text-[10px] font-medium text-center " + (i <= step ? "text-foreground" : "text-muted-foreground/50")}>{label}</span>
                </div>
              ))}
            </div>
            {/* Mobile step indicator */}
            <div className="sm:hidden mb-6 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">{step + 1}</div>
              <div><p className="text-xs text-muted-foreground">Step {step + 1} of {STEPS.length}</p><p className="text-sm font-semibold">{STEPS[step]}</p></div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)}>
              <input type="hidden" {...register("photoUrl")} />
              <input type="hidden" {...register("paymentScreenshotUrl")} />

              {/* Step 0: Instructions */}
              {step === 0 && (
                <div className="space-y-5 animate-in slide-in-from-right-4 duration-500">
                  <div className="bg-primary/5 rounded-lg p-5 border border-primary/10">
                    <h2 className="text-lg font-semibold mb-3 text-primary">Course Details</h2>
                    <h3 className="font-medium text-base mb-1">എം.ഐ.സി തഹ്ഫീളുൽ ഖുർആൻ കോളേജ്, ഉദുമ ഹിഫ്ള് കോഴ്സ്</h3>
                    <p className="text-muted-foreground text-sm mb-3">(9ാം വയസ്സ് കഴിയാത്ത ആൺകുട്ടികൾക്ക്)</p>
                    <p className="text-sm text-foreground/80 mb-4 leading-relaxed">കഴിഞ്ഞ 15 വർഷക്കാലമായി കാസർഗോഡ് ജില്ലയിലെ ഉദുമയിൽ പ്രവർത്തിച്ചു വരുന്ന ഹിഫ്ള് കോളേജാണ് MIC തഹ്ഫീളുൽ ഖുർആൻ കോളേജ്. 60-ലധികം ഹാഫിളീങ്ങൾ ഇതുവരെ ഇവിടെ നിന്ന് പുറത്തിറങ്ങിയിട്ടുണ്ട്.</p>
                    <h4 className="font-semibold text-sm mb-2">പ്രത്യേകതകൾ :-</h4>
                    <ul className="space-y-1 text-sm text-foreground/80 list-disc list-inside">
                      <li>വ്യവസ്ഥാപിതമായ സ്കൂൾ - മദ്റസ പഠനത്തോടൊപ്പം ഹിഫ്ള് പഠിക്കാൻ അവസരം</li>
                      <li>A/c ക്ലാസ് റൂം, പ്രഗൽഭരായ ഹാഫിളുകളുടെ നേതൃത്വം</li>
                      <li>ദേശീയ - അന്തർദേശീയ മത്സരങ്ങൾക്കായി മികച്ച പരിശീലനം</li>
                      <li>കോഴ്സ് പൂർത്തിയാക്കുന്നവർക്ക് ഡിഗ്രിയോടെ തുടർ പഠനത്തിന് അവസരം</li>
                    </ul>
                  </div>
                  <div className="bg-orange-500/5 rounded-lg p-5 border border-orange-500/20">
                    <h2 className="text-base font-semibold mb-3 flex items-center gap-2 text-orange-600"><AlertCircle size={18} />Important Instructions</h2>
                    <ul className="space-y-3 text-sm text-foreground/80">
                      <li className="flex gap-2"><span className="font-bold shrink-0">1.</span><div><p>Enter all names and address correctly in English.</p><p className="text-xs text-muted-foreground mt-0.5">അപ്ലിക്കേഷൻ ഫോം ഇംഗ്ലീഷിൽ പൂരിപ്പിക്കുക.</p></div></li>
                      <li className="flex gap-2"><span className="font-bold shrink-0">2.</span><div><p>All fields are mandatory and must be filled.</p><p className="text-xs text-muted-foreground mt-0.5">എല്ലാ ചോദ്യങ്ങൾക്കും ഉത്തരം രേഖപ്പെടുത്തേണ്ടതാണ്.</p></div></li>
                      <li className="flex gap-2"><span className="font-bold shrink-0">3.</span><div><p>Upload a passport-size photo of the student (max 100MB).</p><p className="text-xs text-muted-foreground mt-0.5">പാസ്സ്പോർട്ട് സൈസ് ഫോട്ടോ അപ്‌ലോഡ് ചെയ്യുക.</p></div></li>
                      <li className="flex gap-2"><span className="font-bold shrink-0">4.</span><div><p>Pay interview fee ₹500 to +91 97475 52134 (GPay/PhonePe) and upload screenshot.</p><p className="text-xs text-muted-foreground mt-0.5">ഇന്റർവ്യൂ ഫീ 500 രൂപ +91 97475 52134 ലേക്ക് അയച്ച് സ്ക്രീൻഷോട്ട് അപ്‌ലോഡ് ചെയ്യുക.</p></div></li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Step 1: Personal Details */}
              {step === 1 && (
                <div className="space-y-5 animate-in slide-in-from-right-4 duration-500">
                  <h2 className="font-playfair text-2xl font-semibold">Personal Details <span className="text-muted-foreground text-sm font-normal">വ്യക്തിഗത വിവരങ്ങൾ</span></h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div><label className={lbl}>Name of Student * <span className="text-xs text-muted-foreground">വിദ്യാർത്ഥിയുടെ പേര്</span></label><input {...register("applicantName")} className={inp} placeholder="Full name in English" />{errors.applicantName && <p className={err}>{errors.applicantName.message}</p>}</div>
                    <div><label className={lbl}>Date of Birth * <span className="text-xs text-muted-foreground">ജനന തീയതി</span></label><input type="date" {...register("dateOfBirth")} className={inp} />{errors.dateOfBirth && <p className={err}>{errors.dateOfBirth.message}</p>}</div>
                    <div><label className={lbl}>Father&apos;s Name * <span className="text-xs text-muted-foreground">പിതാവിന്റെ പേര്</span></label><input {...register("fatherName")} className={inp} placeholder="Father's full name" />{errors.fatherName && <p className={err}>{errors.fatherName.message}</p>}</div>
                    <div><label className={lbl}>Father&apos;s Occupation * <span className="text-xs text-muted-foreground">ജോലി</span></label><input {...register("fatherOccupation")} className={inp} placeholder="e.g. Business, Teacher" />{errors.fatherOccupation && <p className={err}>{errors.fatherOccupation.message}</p>}</div>
                    <div className="md:col-span-2"><label className={lbl}>Mother&apos;s Name * <span className="text-xs text-muted-foreground">മാതാവിന്റെ പേര്</span></label><input {...register("motherName")} className={inp} placeholder="Mother's full name" />{errors.motherName && <p className={err}>{errors.motherName.message}</p>}</div>
                    <div className="md:col-span-2"><label className={lbl}>Identification Mark * <span className="text-xs text-muted-foreground">തിരിച്ചറിയൽ അടയാളം</span></label><input {...register("identificationMark")} className={inp} placeholder="e.g. Mole on right cheek" />{errors.identificationMark && <p className={err}>{errors.identificationMark.message}</p>}</div>
                    <div className="md:col-span-2">
                      <label className={lbl}>Photo of Student * <span className="text-xs text-muted-foreground">ഫോട്ടോ</span></label>
                      <div className={"border-2 border-dashed rounded-lg p-6 text-center transition-colors " + (photoUrl ? "border-green-500 bg-green-500/5" : "border-input hover:border-primary/50")}>
                        {photoUrl ? (
                          <div className="flex flex-col items-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={photoUrl} alt="Student" className="w-24 h-32 object-cover rounded shadow mb-2" />
                            <span className="flex items-center gap-1 text-sm text-green-600 font-medium"><CheckCircle size={14} />Photo uploaded</span>
                            <label className="mt-3 text-xs text-primary hover:underline cursor-pointer">Change photo<input type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, "photoUrl")} /></label>
                          </div>
                        ) : (
                          <label className="cursor-pointer flex flex-col items-center">
                            <UploadCloud size={28} className="text-muted-foreground mb-2" />
                            <span className="text-sm font-medium">Click to upload photo</span>
                            <span className="text-xs text-muted-foreground mt-1">Passport size, max 100MB</span>
                            <input type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, "photoUrl")} disabled={photoUploading} />
                          </label>
                        )}
                        {photoUploading && <p className="text-xs text-primary mt-2 flex items-center justify-center gap-1"><Loader2 size={12} className="animate-spin" />Uploading...</p>}
                      </div>
                      {errors.photoUrl && <p className={err}>{errors.photoUrl.message}</p>}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Address Details */}
              {step === 2 && (
                <div className="space-y-5 animate-in slide-in-from-right-4 duration-500">
                  <h2 className="font-playfair text-2xl font-semibold">Address Details <span className="text-muted-foreground text-sm font-normal">വിലാസ വിവരങ്ങൾ</span></h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="md:col-span-2"><label className={lbl}>House Name * <span className="text-xs text-muted-foreground">വീടിന്റെ പേര്</span></label><input {...register("houseName")} className={inp} placeholder="House / Building name" />{errors.houseName && <p className={err}>{errors.houseName.message}</p>}</div>
                    <div><label className={lbl}>Place * <span className="text-xs text-muted-foreground">സ്ഥലം</span></label><input {...register("place")} className={inp} placeholder="Locality / Village" />{errors.place && <p className={err}>{errors.place.message}</p>}</div>
                    <div><label className={lbl}>Post Office * <span className="text-xs text-muted-foreground">പോസ്റ്റ് ഓഫീസ്</span></label><input {...register("postOffice")} className={inp} placeholder="Post office name" />{errors.postOffice && <p className={err}>{errors.postOffice.message}</p>}</div>
                    <div><label className={lbl}>Pincode * <span className="text-xs text-muted-foreground">പിൻകോഡ്</span></label><input {...register("pincode")} className={inp} placeholder="6-digit pincode" maxLength={6} />{errors.pincode && <p className={err}>{errors.pincode.message}</p>}</div>
                    <div><label className={lbl}>District * <span className="text-xs text-muted-foreground">ജില്ല</span></label><input {...register("district")} className={inp} placeholder="District" />{errors.district && <p className={err}>{errors.district.message}</p>}</div>
                    <div className="md:col-span-2"><label className={lbl}>State * <span className="text-xs text-muted-foreground">സംസ്ഥാനം</span></label><input {...register("state")} className={inp} placeholder="State" defaultValue="Kerala" />{errors.state && <p className={err}>{errors.state.message}</p>}</div>
                  </div>
                </div>
              )}

              {/* Step 3: Educational Details */}
              {step === 3 && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                  <h2 className="font-playfair text-2xl font-semibold">Educational Details <span className="text-muted-foreground text-sm font-normal">വിദ്യാഭ്യാസ വിവരങ്ങൾ</span></h2>
                  <div>
                    <label className={lbl}>Student&apos;s Aadhaar Number * <span className="text-xs text-muted-foreground">ആധാർ നമ്പർ</span></label>
                    <input {...register("aadhaarNumber")} className={inp} placeholder="12-digit Aadhaar number" maxLength={12} />
                    {errors.aadhaarNumber && <p className={err}>{errors.aadhaarNumber.message}</p>}
                  </div>
                  <div className="bg-muted/50 rounded-lg p-5 border border-border space-y-4">
                    <h3 className="font-semibold text-sm flex items-center gap-2"><GraduationCap size={16} className="text-primary" />School Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2"><label className={lbl}>Name of School * <span className="text-xs text-muted-foreground">സ്കൂളിന്റെ പേര്</span></label><input {...register("schoolName")} className={inp} placeholder="Full school name" />{errors.schoolName && <p className={err}>{errors.schoolName.message}</p>}</div>
                      <div><label className={lbl}>Present Class * <span className="text-xs text-muted-foreground">നിലവിലെ ക്ലാസ്</span></label><input {...register("schoolClass")} className={inp} placeholder="e.g. 4th Standard" />{errors.schoolClass && <p className={err}>{errors.schoolClass.message}</p>}</div>
                    </div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-5 border border-border space-y-4">
                    <h3 className="font-semibold text-sm flex items-center gap-2"><GraduationCap size={16} className="text-primary" />Madrasa Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2"><label className={lbl}>Name of Madrasa * <span className="text-xs text-muted-foreground">മദ്‌റസയുടെ പേര്</span></label><input {...register("madrasaName")} className={inp} placeholder="Full madrasa name" />{errors.madrasaName && <p className={err}>{errors.madrasaName.message}</p>}</div>
                      <div><label className={lbl}>Affiliation Number * <span className="text-xs text-muted-foreground">അഫിലിയേഷൻ നമ്പർ</span></label><input {...register("madrasaAffiliationNumber")} className={inp} placeholder="Affiliation No." />{errors.madrasaAffiliationNumber && <p className={err}>{errors.madrasaAffiliationNumber.message}</p>}</div>
                      <div><label className={lbl}>Present Class * <span className="text-xs text-muted-foreground">നിലവിലെ ക്ലാസ്</span></label><input {...register("madrasaClass")} className={inp} placeholder="e.g. 4th" />{errors.madrasaClass && <p className={err}>{errors.madrasaClass.message}</p>}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Guardian & Contact */}
              {step === 4 && (
                <div className="space-y-5 animate-in slide-in-from-right-4 duration-500">
                  <h2 className="font-playfair text-2xl font-semibold">Guardian & Contact <span className="text-muted-foreground text-sm font-normal">രക്ഷകർത്താവ്</span></h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div><label className={lbl}>Guardian&apos;s Name * <span className="text-xs text-muted-foreground">രക്ഷകർത്താവിന്റെ പേര്</span></label><input {...register("guardianName")} className={inp} placeholder="Guardian's full name" />{errors.guardianName && <p className={err}>{errors.guardianName.message}</p>}</div>
                    <div><label className={lbl}>Relation with Guardian * <span className="text-xs text-muted-foreground">ബന്ധം</span></label><input {...register("guardianRelation")} className={inp} placeholder="e.g. Father, Uncle" />{errors.guardianRelation && <p className={err}>{errors.guardianRelation.message}</p>}</div>
                    <div><label className={lbl}>Phone Number * <span className="text-xs text-muted-foreground">ഫോൺ നമ്പർ</span></label><input {...register("guardianPhone")} type="tel" className={inp} placeholder="10-digit number" />{errors.guardianPhone && <p className={err}>{errors.guardianPhone.message}</p>}</div>
                    <div><label className={lbl}>Alternate Phone Number * <span className="text-xs text-muted-foreground">ഇതര ഫോൺ</span></label><input {...register("alternatePhone")} type="tel" className={inp} placeholder="Alternate number" />{errors.alternatePhone && <p className={err}>{errors.alternatePhone.message}</p>}</div>
                  </div>
                </div>
              )}

              {/* Step 5: Payment */}
              {step === 5 && (
                <div className="space-y-5 animate-in slide-in-from-right-4 duration-500">
                  <h2 className="font-playfair text-2xl font-semibold">Payment & Submission</h2>
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-5 text-center">
                    <p className="text-sm text-foreground/80 mb-1">Interview Fee</p>
                    <p className="text-3xl font-bold text-primary mb-3">₹500</p>
                    <p className="text-sm text-foreground mb-3">Pay via GPay / PhonePe to:</p>
                    <p className="text-lg font-jetbrains font-semibold tracking-wider bg-background inline-block px-4 py-2 rounded border border-border shadow-sm">+91 97475 52134</p>
                  </div>
                  <div>
                    <label className={lbl}>Screenshot of Payment * <span className="text-xs text-muted-foreground">പൈസ അടച്ചതിന്റെ സ്ക്രീൻഷോട്ട്</span></label>
                    <div className={"border-2 border-dashed rounded-lg p-6 text-center transition-colors " + (paymentScreenshotUrl ? "border-green-500 bg-green-500/5" : "border-input hover:border-primary/50")}>
                      {paymentScreenshotUrl ? (
                        <div className="flex flex-col items-center">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={paymentScreenshotUrl} alt="Payment" className="h-32 object-contain rounded shadow mb-2" />
                          <span className="flex items-center gap-1 text-sm text-green-600 font-medium"><CheckCircle size={14} />Screenshot uploaded</span>
                          <label className="mt-3 text-xs text-primary hover:underline cursor-pointer">Change<input type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, "paymentScreenshotUrl")} /></label>
                        </div>
                      ) : (
                        <label className="cursor-pointer flex flex-col items-center">
                          <UploadCloud size={28} className="text-muted-foreground mb-2" />
                          <span className="text-sm font-medium">Click to upload screenshot</span>
                          <span className="text-xs text-muted-foreground mt-1">JPG, PNG. Max 100MB</span>
                          <input type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, "paymentScreenshotUrl")} disabled={paymentUploading} />
                        </label>
                      )}
                      {paymentUploading && <p className="text-xs text-primary mt-2 flex items-center justify-center gap-1"><Loader2 size={12} className="animate-spin" />Uploading...</p>}
                    </div>
                    {errors.paymentScreenshotUrl && <p className={err}>{errors.paymentScreenshotUrl.message}</p>}
                  </div>
                  <div className="bg-muted p-4 rounded-lg"><p className="text-xs text-muted-foreground text-center">By submitting, you declare all information provided is true and accurate.</p></div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex justify-between items-center mt-10 pt-6 border-t border-border">
                {step > 0 ? (
                  <button type="button" onClick={() => { setStep(s => s - 1); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="px-6 py-2.5 text-sm font-medium rounded-md hover:bg-muted transition-colors">← Back</button>
                ) : <div />}
                {step < STEPS.length - 1 ? (
                  <button type="button" onClick={nextStep} className="px-8 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors shadow-sm">Continue →</button>
                ) : (
                  <button type="submit" disabled={isPending} className="px-8 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-70 flex items-center gap-2">
                    {isPending ? (<><Loader2 size={16} className="animate-spin" />Submitting...</>) : "Submit Application"}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
