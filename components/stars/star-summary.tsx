import { Star } from "lucide-react";

interface Props {
  blue: number;
  black: number;
  size?: "sm" | "md" | "lg";
}

export function StarSummary({ blue, black, size = "md" }: Props) {
  const textSize =
    size === "sm" ? "text-xs" : size === "lg" ? "text-base" : "text-sm";
  const iconSize = size === "sm" ? 14 : size === "lg" ? 22 : 18;

  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 ${textSize}`}
      >
        <Star size={iconSize} fill="currentColor" className="text-blue-600" />
        <span className="font-jetbrains font-semibold text-blue-700">
          {blue}
        </span>
        {size !== "sm" && <span className="text-blue-500">Blue</span>}
      </div>
      <div
        className={`flex items-center gap-1.5 rounded-full border border-gray-400 bg-gray-100 px-2.5 py-1 ${textSize}`}
      >
        <Star size={iconSize} fill="currentColor" className="text-black" />
        <span className="font-jetbrains font-semibold text-black">{black}</span>
        {size !== "sm" && <span className="text-gray-600">Black</span>}
      </div>
    </div>
  );
}
