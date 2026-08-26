import Link from "next/link";

interface Topper {
  id: string;
  studentCode: string;
  firstName: string;
  lastName: string | null;
  target: number;
  actual: number;
}

interface Props {
  toppers: Topper[];
  month: string;
}

export function ToppersList({ toppers, month }: Props) {
  return (
    <div className="bg-card border border-border rounded-lg">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="font-playfair text-base font-semibold">
          ⭐ Toppers — {month}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Students who met their monthly target
        </p>
      </div>

      {toppers.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            No toppers yet this month
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Students who complete their target Juz will appear here
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {toppers.map((topper, idx) => (
            <div key={topper.id} className="px-5 py-3 flex items-center gap-3">
              {/* Rank */}
              <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-medium font-jetbrains
                bg-foreground text-background"
              >
                {idx + 1}
              </div>
              {/* Name */}
              <div className="flex-1 min-w-0">
                <Link
                  href={`/admin/students/${topper.id}`}
                  className="text-sm font-medium text-foreground hover:underline block truncate"
                >
                  {topper.firstName} {topper.lastName ?? ""}
                </Link>
                <p className="text-xs text-muted-foreground font-jetbrains">
                  {topper.actual} / {topper.target} Juz
                </p>
              </div>
              {/* Star */}
              <span className="text-[#C9A84C] text-lg">⭐</span>
            </div>
          ))}
        </div>
      )}

      {toppers.length > 0 && (
        <div className="px-5 py-3 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            {toppers.length} student{toppers.length !== 1 ? "s" : ""} met their target this month
          </p>
        </div>
      )}
    </div>
  );
}
