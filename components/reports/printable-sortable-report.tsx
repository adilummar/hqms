"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, Printer } from "lucide-react";

export interface ReportRow {
  id: string;
  studentCode: string;
  firstName: string;
  lastName: string | null;
  className: string;
  target: number;
  actual: number;
}

type SortField = "name" | "class" | "target" | "actual" | "percentage";

export function PrintableSortableReport({ data, monthName }: { data: ReportRow[], monthName: string }) {
  const [sortField, setSortField] = useState<SortField>("percentage");
  const [sortAsc, setSortAsc] = useState(false);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === "name" || field === "class"); // default ascending for strings, descending for numbers
    }
  };

  const sortedData = [...data].sort((a, b) => {
    let comparison = 0;
    
    if (sortField === "name") {
      comparison = a.firstName.localeCompare(b.firstName);
    } else if (sortField === "class") {
      comparison = a.className.localeCompare(b.className);
    } else if (sortField === "target") {
      comparison = a.target - b.target;
    } else if (sortField === "actual") {
      comparison = a.actual - b.actual;
    } else if (sortField === "percentage") {
      const pA = a.target > 0 ? a.actual / a.target : 0;
      const pB = b.target > 0 ? b.actual / b.target : 0;
      comparison = pA - pB;
    }

    return sortAsc ? comparison : -comparison;
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-card border border-border rounded-lg shadow-sm print:shadow-none print:border-none">
      <div className="px-5 py-4 border-b border-border flex justify-between items-center print:border-b-2 print:border-black">
        <div>
          <h3 className="font-playfair text-lg font-semibold">Detailed Student Progress</h3>
          <p className="text-sm text-muted-foreground">{monthName}</p>
        </div>
        <Button onClick={handlePrint} variant="outline" className="print:hidden flex gap-2">
          <Printer size={16} />
          Print Report
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border print:bg-transparent print:border-b-2 print:border-black">
              <th className="text-left px-5 py-3 font-medium text-muted-foreground print:text-black">
                <button className="flex items-center gap-1 hover:text-foreground" onClick={() => handleSort("name")}>
                  Student <ArrowUpDown size={14} className="opacity-50" />
                </button>
              </th>
              <th className="text-left px-5 py-3 font-medium text-muted-foreground print:text-black">
                <button className="flex items-center gap-1 hover:text-foreground" onClick={() => handleSort("class")}>
                  Class <ArrowUpDown size={14} className="opacity-50" />
                </button>
              </th>
              <th className="text-left px-5 py-3 font-medium text-muted-foreground print:text-black">
                <button className="flex items-center gap-1 hover:text-foreground" onClick={() => handleSort("target")}>
                  Target (Juz) <ArrowUpDown size={14} className="opacity-50" />
                </button>
              </th>
              <th className="text-left px-5 py-3 font-medium text-muted-foreground print:text-black">
                <button className="flex items-center gap-1 hover:text-foreground" onClick={() => handleSort("actual")}>
                  Completed <ArrowUpDown size={14} className="opacity-50" />
                </button>
              </th>
              <th className="text-left px-5 py-3 font-medium text-muted-foreground print:text-black">
                <button className="flex items-center gap-1 hover:text-foreground" onClick={() => handleSort("percentage")}>
                  Progress <ArrowUpDown size={14} className="opacity-50" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border print:divide-gray-300">
            {sortedData.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                  No data available for this period.
                </td>
              </tr>
            ) : (
              sortedData.map((row) => {
                const percentage = row.target > 0 ? Math.min(100, Math.round((row.actual / row.target) * 100)) : 0;
                return (
                  <tr key={row.id} className="hover:bg-muted/30 print:break-inside-avoid">
                    <td className="px-5 py-3">
                      <div className="font-medium">{row.firstName} {row.lastName ?? ""}</div>
                      <div className="text-xs text-muted-foreground font-jetbrains">{row.studentCode}</div>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{row.className}</td>
                    <td className="px-5 py-3 font-jetbrains font-medium">{row.target}</td>
                    <td className="px-5 py-3 font-jetbrains font-medium text-emerald-600">{row.actual}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-12 font-jetbrains">{percentage}%</span>
                        <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden print:hidden">
                          <div 
                            className="h-full rounded-full transition-all" 
                            style={{ 
                              width: `${percentage}%`,
                              backgroundColor: percentage >= 100 ? "#10b981" : "#000" 
                            }} 
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
