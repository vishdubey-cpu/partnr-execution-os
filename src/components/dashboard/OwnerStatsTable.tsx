import { OwnerStat } from "@/types";
import { cn } from "@/lib/utils";

interface OwnerStatsTableProps {
  data: OwnerStat[];
}

export function OwnerStatsTable({ data }: OwnerStatsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Owner
            </th>
            <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Function
            </th>
            <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Total
            </th>
            <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Open
            </th>
            <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Done
            </th>
            <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Overdue
            </th>
            <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Closure Rate
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={row.owner}
              className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
            >
              <td className="py-2.5 px-3 font-medium text-gray-800">{row.owner}</td>
              <td className="py-2.5 px-3 text-gray-500">{row.function}</td>
              <td className="py-2.5 px-3 text-center text-gray-700">{row.total}</td>
              <td className="py-2.5 px-3 text-center text-blue-600">{row.open}</td>
              <td className="py-2.5 px-3 text-center text-green-600">{row.done}</td>
              <td className="py-2.5 px-3 text-center text-red-600">{row.overdue}</td>
              <td className="py-2.5 px-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                    <div
                      className={cn(
                        "h-1.5 rounded-full",
                        row.closureRate >= 80
                          ? "bg-green-500"
                          : row.closureRate >= 50
                          ? "bg-amber-400"
                          : "bg-red-400"
                      )}
                      style={{ width: `${row.closureRate}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-600 w-8 text-right">
                    {row.closureRate}%
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
