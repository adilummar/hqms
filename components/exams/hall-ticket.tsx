import { format } from "date-fns";
import Image from "next/image";

interface Subject {
  name: string;
  examDate: string | null;
  displayOrder: number;
}

interface HallTicketProps {
  examName: string;
  academicYear: string;
  student: {
    firstName: string;
    lastName: string | null;
    admissionNumber: string | null;
    studentCode: string;
    photoUrl: string | null;
  };
  className: string;
  subjects: Subject[];
  index: number; // for print page breaks
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr), "dd-MM-yyyy");
  } catch {
    return dateStr;
  }
}

export function HallTicket({
  examName,
  academicYear,
  student,
  className,
  subjects,
  index,
}: HallTicketProps) {
  const fullName = [student.firstName, student.lastName].filter(Boolean).join(" ");
  const admNo = student.admissionNumber ?? student.studentCode;

  const sortedSubjects = [...subjects].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div
      className="hall-ticket-page bg-white text-black"
      style={{
        width: "210mm",
        minHeight: "270mm",
        margin: "0 auto",
        padding: "12mm 14mm",
        fontFamily: "'Times New Roman', Times, serif",
        pageBreakAfter: index > 0 ? "always" : undefined,
        boxSizing: "border-box",
        position: "relative",
        border: "1px solid #ddd",
        marginBottom: "24px",
      }}
    >
      {/* ── College Header ── */}
      <div style={{ textAlign: "center", borderBottom: "2px solid #333", paddingBottom: "10px", marginBottom: "10px" }}>
        <div style={{ fontSize: "11px", fontFamily: "Arial, sans-serif", color: "#555", letterSpacing: "1px" }}>
          كلية تحفيظ القرآن لمجمع مليبار الإسلامي
        </div>
        <div style={{ fontSize: "17px", fontWeight: "bold", fontFamily: "Arial, sans-serif", letterSpacing: "2px", marginTop: "2px" }}>
          MIC THAHFEEZUL QUR'AN COLLEGE
        </div>
        <div style={{ fontSize: "9px", fontFamily: "Arial, sans-serif", color: "#666", marginTop: "2px" }}>
          Udma West, Udma P.O, Kasaragod Dt., Kerala, India, 671319
        </div>
      </div>

      {/* ── Exam Name ── */}
      <div style={{ textAlign: "center", borderBottom: "1px solid #aaa", paddingBottom: "8px", marginBottom: "12px" }}>
        <div style={{ fontSize: "14px", fontWeight: "bold", fontFamily: "Arial, sans-serif" }}>
          {examName} {academicYear}
        </div>
      </div>

      {/* ── HALL TICKET title ── */}
      <div style={{ textAlign: "center", marginBottom: "16px" }}>
        <div style={{ fontSize: "22px", fontWeight: "bold", fontFamily: "Arial, sans-serif", letterSpacing: "4px" }}>
          HALL TICKET
        </div>
      </div>

      {/* ── Student Info + Photo ── */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "16px", alignItems: "stretch" }}>
        {/* Info table */}
        <table style={{ flex: 1, borderCollapse: "collapse", fontSize: "13px" }}>
          <tbody>
            {[
              { label: "Name", value: fullName },
              { label: "Ad.No", value: admNo },
              { label: "Class", value: className },
            ].map(({ label, value }) => (
              <tr key={label}>
                <td
                  style={{
                    border: "1px solid #999",
                    padding: "7px 10px",
                    fontWeight: "600",
                    width: "90px",
                    backgroundColor: "#f9f9f9",
                    fontFamily: "Arial, sans-serif",
                    fontSize: "12px",
                  }}
                >
                  {label}
                </td>
                <td
                  style={{
                    border: "1px solid #999",
                    padding: "7px 12px",
                    fontFamily: "Arial, sans-serif",
                    fontSize: "12px",
                  }}
                >
                  {value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Photo box */}
        <div
          style={{
            width: "90px",
            minHeight: "90px",
            border: "1px solid #999",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            backgroundColor: "#f5f5f5",
          }}
        >
          {student.photoUrl ? (
            <img
              src={student.photoUrl}
              alt={fullName}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span style={{ fontSize: "10px", color: "#aaa", textAlign: "center", padding: "4px", fontFamily: "Arial, sans-serif" }}>
              Photo
            </span>
          )}
        </div>
      </div>

      {/* ── Subject Schedule Table ── */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", marginBottom: "24px" }}>
        <thead>
          <tr style={{ backgroundColor: "#f0f0f0" }}>
            {["#", "Date", "Subject", "Sign"].map((h) => (
              <th
                key={h}
                style={{
                  border: "1px solid #999",
                  padding: "7px 10px",
                  textAlign: h === "Sign" ? "center" : "left",
                  fontFamily: "Arial, sans-serif",
                  fontWeight: "bold",
                  fontSize: "12px",
                  width: h === "#" ? "30px" : h === "Date" ? "100px" : h === "Sign" ? "70px" : undefined,
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedSubjects.length === 0 ? (
            <tr>
              <td
                colSpan={4}
                style={{
                  border: "1px solid #999",
                  padding: "12px",
                  textAlign: "center",
                  color: "#aaa",
                  fontFamily: "Arial, sans-serif",
                  fontSize: "11px",
                }}
              >
                No subjects assigned
              </td>
            </tr>
          ) : (
            sortedSubjects.map((sub, i) => (
              <tr key={i}>
                <td style={{ border: "1px solid #999", padding: "7px 10px", fontFamily: "Arial, sans-serif", textAlign: "center" }}>
                  {i + 1}
                </td>
                <td style={{ border: "1px solid #999", padding: "7px 10px", fontFamily: "Arial, sans-serif" }}>
                  {formatDate(sub.examDate)}
                </td>
                <td style={{ border: "1px solid #999", padding: "7px 10px", fontFamily: "Arial, sans-serif" }}>
                  {sub.name}
                </td>
                <td style={{ border: "1px solid #999", padding: "7px 10px" }} />
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* ── Signature Footer ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          borderTop: "1px solid #aaa",
          paddingTop: "12px",
          marginTop: "auto",
        }}
      >
        <div style={{ fontFamily: "Arial, sans-serif", fontSize: "12px", fontWeight: "bold" }}>
          Principal
        </div>
        <div style={{ fontFamily: "Arial, sans-serif", fontSize: "12px", fontWeight: "bold" }}>
          Controller of Examination
        </div>
      </div>
    </div>
  );
}
