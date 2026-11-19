'use client';

import { useState } from 'react';

import { SIZE_CHART_CM, SIZE_CHART_INCHES } from '@/lib/size-chart';

/** The standard size chart with an inches / centimetres switch. */
export function SizeChartTable() {
  const [unit, setUnit] = useState<'inches' | 'cm'>('inches');
  const rows = unit === 'inches' ? SIZE_CHART_INCHES : SIZE_CHART_CM;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-neutral-500">Measurements are of the finished garment.</p>
        <div role="group" aria-label="Measurement unit" className="flex rounded-lg border border-neutral-300 p-0.5 text-xs font-bold bg-neutral-100">
          {(['inches', 'cm'] as const).map((u) => (
            <button
              key={u}
              type="button"
              aria-pressed={unit === u}
              onClick={() => setUnit(u)}
              className={`px-3 py-1 rounded-md transition-colors ${unit === u ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-600'}`}
            >
              {u === 'inches' ? 'Inches' : 'CM'}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm text-left">
          <caption className="sr-only">Garment sizes in {unit === 'inches' ? 'inches' : 'centimetres'}</caption>
          <thead className="bg-neutral-100 text-neutral-700 text-xs uppercase font-bold border-b border-neutral-200">
            <tr>
              <th scope="col" className="p-3">Size</th>
              <th scope="col" className="p-3">Chest</th>
              <th scope="col" className="p-3">Waist</th>
              <th scope="col" className="p-3">Length</th>
              <th scope="col" className="p-3">Shoulders</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {rows.map((row) => (
              <tr key={row.size}>
                <th scope="row" className="p-3 font-bold text-neutral-900">{row.size}</th>
                <td className="p-3 text-neutral-600">{row.chest}</td>
                <td className="p-3 text-neutral-600">{row.waist}</td>
                <td className="p-3 text-neutral-600">{row.length}</td>
                <td className="p-3 text-neutral-600">{row.shoulders}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
