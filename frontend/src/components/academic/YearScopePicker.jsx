import React from 'react';
import { Calendar, ChevronDown, CheckCircle2 } from 'lucide-react';

export function YearScopePicker({ schoolYears, selectedSyId, onSelectSy }) {
  const selectedSy = schoolYears.find(sy => sy.id === selectedSyId) || schoolYears.find(sy => sy.is_active) || schoolYears[0];

  return (
    <div className="bg-white border border-gray-200/80 rounded-xl px-3.5 py-2 shadow-2xs flex flex-wrap items-center justify-between gap-3 mb-4">
      {/* Current Scope Badge */}
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0">
          <Calendar size={14} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 hidden sm:inline">Academic Year:</span>
          <span className="font-extrabold text-gray-900 text-xs sm:text-sm">
            {selectedSy?.name || 'Select School Year'}
          </span>
          {selectedSy?.is_active && (
            <span className="inline-flex items-center gap-1 bg-emerald-100/90 text-emerald-800 text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-bold">
              <CheckCircle2 size={11} className="text-emerald-700" /> Active
            </span>
          )}
        </div>
      </div>

      {/* Compact Switcher */}
      <div className="flex items-center gap-2">
        <label className="text-xs font-semibold text-gray-400 shrink-0 hidden sm:inline">Switch:</label>
        <div className="relative">
          <select
            value={selectedSy?.id || ''}
            onChange={(e) => onSelectSy(e.target.value)}
            className="appearance-none bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-800 font-bold py-1.5 pl-3 pr-7 rounded-lg outline-none focus:border-emerald-600 focus:bg-white text-xs cursor-pointer transition shadow-2xs"
          >
            {schoolYears.map(sy => (
              <option key={sy.id} value={sy.id}>
                {sy.name} {sy.is_active ? '(Active)' : ''}
              </option>
            ))}
          </select>
          <ChevronDown size={13} className="absolute right-2 top-2.5 pointer-events-none text-gray-400" />
        </div>
      </div>
    </div>
  );
}
