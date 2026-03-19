import { OwnerStat } from "@/types";
import { cn } from "@/lib/utils";

interface OwnerStatsTableProps {
  data: OwnerStat[];
}

function scoreLabel(score: number) {
  if (score >= 80) return { grade: "A", color: "bg-green-100 text-green-700" };
  if (score >= 60) return { grade: "B", color: "bg-blue-100 text-blue-700" };
  if (score >= 40) return { grade: "C", color: "bg-amber-100 text-amber-700" };
  return { grade: "D", color: "bg-red-100 text-red-700" };
}

export function OwnerStatsTable({ data }: OwnerStatsTableProps) {
  if (data.length === 0) return <p className="text-sm text-gray-400 p-4">No data yet</p>;

  return (
    <>
      {/* Mobile card list */}
      <div className="md:hidden divide-y divide-gray-100">
        {data.map((row) => {
          const { grade, color } = scoreLabel(row.executionScore);
          return (
            <div key={row.owner} className="px-4 py-3.5">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{row.owner}</p>
                  <p className="text-xs text-gray-400">{row.function}</p>
                </div>
                <span className={cn("text-sm font-bold px-2.5 py-1 rounded-full", color)}>
                  {grade} · {row.executionScore}
                </span>
              </div>
              <div className="flex gap-3 text-xs mb-2">
                <span className="text-gray-500">{row.total} total</span>
                <span className="text-green-600">{row.done} done</span>
                <span className="text-red-600">{row.overdue} overdue</span>
                <span className="text-amber-600">{row.delayed} delayed</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                  <div className={cn("h-1.5 rounded-full", row.closureRate >= 80 ? "bg-green-500" : row.closureRate >= 50 ? "bg-amber-400" : "bg-red-400")} style={{ width: `${row.closureRate}%` }} />
                </div>
                <span className="text-xs text-gray-500">{row.closureRate}% closed</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Owner</th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Function</th>
              <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
              <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Done</th>
              <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Overdue</th>
              <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Delayed</th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Closure Rate</th>
              <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Score</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const { grade, color } = scoreLabel(row.executionScore);
              return (
                <tr key={row.owner} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="py-2.5 px-3 font-medium text-gray-800">{row.owner}</td>
                  <td className="py-2.5 px-3 text-gray-500">{row.function}</td>
                  <td className="py-2.5 px-3 text-center text-gray-700">{row.total}</td>
                  <td className="py-2.5 px-3 text-center text-green-600 font-medium">{row.done}</td>
                  <td className="py-2.5 px-3 text-center text-red-600 font-medium">{row.overdue}</td>
                  <td className="py-2.5 px-3 text-center text-amber-600">{row.delayed}</td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div className={cn("h-1.5 rounded-full", row.closureRate >= 80 ? "bg-green-500" : row.closureRate >= 50 ? "bg-amber-400" : "bg-red-400")} style={{ width: `${row.closureRate}%` }} />
                      </div>
                      <span className="text-xs text-gray-600 w-8 text-right">{row.closureRate}%</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", color)}>{grade} · {row.executionScore}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
