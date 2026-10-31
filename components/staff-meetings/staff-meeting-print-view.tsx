"use client";

import { Printer } from "lucide-react";
import type { StaffAttendee } from "./staff-meeting-attendance-sheet";

interface Props {
  meeting: {
    id: string;
    title: string;
    meetingDate: string;
    meetingTime: string | null;
    location: string | null;
    description: string | null;
    status: string;
    minutes: string | null;
    decisions: string | null;
    createdByUser?: {
      username: string;
      role: string;
    } | null;
  };
  attendees: StaffAttendee[];
}

export function StaffMeetingPrintView({ meeting, attendees }: Props) {
  const presentMembers = attendees.filter((a) => a.attended);
  const absentMembers = attendees.filter((a) => !a.attended);

  return (
    <div className="space-y-4">
      {/* Print Trigger */}
      <div className="flex justify-end print:hidden">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-all cursor-pointer font-dm-sans shadow-xs"
        >
          <Printer size={15} />
          Print Official Document
        </button>
      </div>

      {/* ── Document Container ── */}
      <div className="bg-white text-black p-8 sm:p-12 rounded-xl border border-gray-200 shadow-sm print:border-none print:shadow-none print:p-0 max-w-4xl mx-auto font-serif">
        {/* Header */}
        <div className="text-center border-b-2 border-black pb-5 mb-6">
          <p className="text-xs uppercase tracking-widest font-sans font-semibold text-gray-600 mb-1">
            Hifzul Quran Management System
          </p>
          <h1 className="text-2xl font-bold font-serif tracking-tight text-black uppercase">
            Staff Meeting Minutes & Resolutions
          </h1>
          <p className="text-xs text-gray-500 font-sans mt-1">
            Official Institutional Record • Ref ID: {meeting.id.slice(0, 8)}
          </p>
        </div>

        {/* Meeting Information Block */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-gray-50 border border-gray-200 rounded-md text-xs font-sans mb-6">
          <div>
            <span className="text-gray-500 font-medium block">Meeting Title:</span>
            <span className="font-bold text-gray-900">{meeting.title}</span>
          </div>
          <div>
            <span className="text-gray-500 font-medium block">Date & Time:</span>
            <span className="font-bold text-gray-900">
              {new Date(meeting.meetingDate + "T00:00:00").toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}{" "}
              {meeting.meetingTime ? `• ${meeting.meetingTime}` : ""}
            </span>
          </div>
          <div>
            <span className="text-gray-500 font-medium block">Location / Venue:</span>
            <span className="font-bold text-gray-900">
              {meeting.location || "Institution Premises"}
            </span>
          </div>
          <div>
            <span className="text-gray-500 font-medium block">Convened By:</span>
            <span className="font-bold text-gray-900">
              {meeting.createdByUser?.username || "Administration"}
            </span>
          </div>
        </div>

        {/* Agenda */}
        {meeting.description && (
          <div className="mb-6 text-xs">
            <h3 className="font-sans font-bold text-xs uppercase tracking-wider text-gray-700 border-b border-gray-300 pb-1 mb-2">
              1. Meeting Agenda / Objectives
            </h3>
            <p className="text-gray-800 whitespace-pre-wrap leading-relaxed pl-2 font-sans">
              {meeting.description}
            </p>
          </div>
        )}

        {/* Attendance Summary */}
        <div className="mb-6 text-xs font-sans">
          <h3 className="font-sans font-bold text-xs uppercase tracking-wider text-gray-700 border-b border-gray-300 pb-1 mb-2">
            2. Attendance Record ({presentMembers.length} Present / {attendees.length} Total)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="border border-gray-200 rounded p-2.5 bg-gray-50/50">
              <p className="font-semibold text-emerald-800 text-[11px] mb-1.5 uppercase">
                Present Members ({presentMembers.length}):
              </p>
              <div className="space-y-1">
                {presentMembers.map((m) => (
                  <div key={m.userId} className="text-gray-800 flex justify-between">
                    <span>• {m.username}</span>
                    <span className="text-gray-500 text-[10px]">({m.role.replace("_", " ")})</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-gray-200 rounded p-2.5 bg-gray-50/50">
              <p className="font-semibold text-red-800 text-[11px] mb-1.5 uppercase">
                Absent Members ({absentMembers.length}):
              </p>
              {absentMembers.length === 0 ? (
                <p className="text-gray-400 italic">None (100% Attendance)</p>
              ) : (
                <div className="space-y-1">
                  {absentMembers.map((m) => (
                    <div key={m.userId} className="text-gray-800 flex justify-between">
                      <span>• {m.username}</span>
                      <span className="text-gray-500 text-[10px]">
                        {m.remarks ? `Reason: ${m.remarks}` : `(${m.role.replace("_", " ")})`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Minutes of the Meeting */}
        <div className="mb-6 text-xs">
          <h3 className="font-sans font-bold text-xs uppercase tracking-wider text-gray-700 border-b border-gray-300 pb-1 mb-2">
            3. Discussion Proceedings & Minutes
          </h3>
          {meeting.minutes ? (
            <p className="text-gray-900 whitespace-pre-wrap leading-relaxed pl-2 font-sans">
              {meeting.minutes}
            </p>
          ) : (
            <p className="text-gray-400 italic pl-2 font-sans">
              No detailed discussion notes recorded.
            </p>
          )}
        </div>

        {/* DECISIONS TAKEN SECTION ("DISITIONS") */}
        <div className="mb-8 text-xs font-sans">
          <h3 className="font-sans font-bold text-xs uppercase tracking-wider text-gray-900 border-b-2 border-black pb-1 mb-2">
            4. Key Decisions Taken & Resolutions ("Disitions")
          </h3>
          <div className="border-2 border-black rounded p-4 bg-gray-50">
            {meeting.decisions ? (
              <p className="text-gray-900 whitespace-pre-wrap leading-relaxed font-semibold">
                {meeting.decisions}
              </p>
            ) : (
              <p className="text-gray-500 italic">
                Pending formal recording of meeting decisions.
              </p>
            )}
          </div>
        </div>

        {/* Signatures */}
        <div className="pt-10 border-t border-gray-300 grid grid-cols-2 gap-8 text-xs font-sans">
          <div>
            <div className="border-b border-gray-400 w-48 mb-2"></div>
            <p className="font-bold text-gray-800">Recorded By (Staff Secretary)</p>
            <p className="text-gray-500 text-[11px]">Name: {meeting.createdByUser?.username}</p>
            <p className="text-gray-500 text-[11px]">Date: ____________________</p>
          </div>

          <div className="text-right flex flex-col items-end">
            <div className="border-b border-gray-400 w-48 mb-2"></div>
            <p className="font-bold text-gray-800">Approved By (Principal / Admin)</p>
            <p className="text-gray-500 text-[11px]">Signature & Seal</p>
            <p className="text-gray-500 text-[11px]">Date: ____________________</p>
          </div>
        </div>
      </div>
    </div>
  );
}
