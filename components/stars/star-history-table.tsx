import { Star } from "lucide-react";

interface StarEntry {
  id: string;
  type: "blue" | "black";
  reason: string;
  awardedAt: Date | string;
  awardedByUser?: { username: string } | null;
}

interface Props {
  stars: StarEntry[];
  showRemove?: boolean;
  onRemove?: (id: string) => void;
}

export function StarHistoryTable({
  stars,
  showRemove = false,
  onRemove,
}: Props) {
  if (stars.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
        No stars awarded yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-160 text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
              Star
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
              Reason
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
              Awarded By
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
              Date
            </th>
            {showRemove && <th className="px-4 py-3" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {stars.map((star) => (
            <tr
              key={star.id}
              className={
                star.type === "blue"
                  ? "transition-colors hover:bg-blue-50/30"
                  : "transition-colors hover:bg-gray-50"
              }
            >
              <td className="px-4 py-3">
                {star.type === "blue" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                    <Star size={12} fill="currentColor" /> Blue Star
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-400 bg-gray-100 px-2 py-0.5 text-xs font-semibold text-black">
                    <Star size={12} fill="currentColor" /> Black Star
                  </span>
                )}
              </td>
              <td className="max-w-xs px-4 py-3 text-foreground">
                {star.reason}
              </td>
              <td className="px-4 py-3 font-jetbrains text-xs text-muted-foreground">
                {star.awardedByUser?.username ?? "-"}
              </td>
              <td className="px-4 py-3 font-jetbrains text-xs text-muted-foreground">
                {new Date(star.awardedAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </td>
              {showRemove && (
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onRemove?.(star.id)}
                    className="text-xs text-red-500 transition-colors hover:text-red-700"
                  >
                    Remove
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
