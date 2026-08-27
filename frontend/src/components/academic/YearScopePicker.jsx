import React from 'react';
import { Calendar, ChevronDown, CheckCircle, Clock } from 'lucide-react';

export function YearScopePicker({ schoolYears, selectedSyId, onSelectSy }) {
  const selectedSy = schoolYears.find(sy => sy.id === selectedSyId) || schoolYears.find(sy => sy.is_active) || schoolYears[0];

  return (
    <div className="bg-white border border-emerald-100 rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold">
          <Calendar size={20} />
        </div>
        <div>
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Configuring Scope</span>
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-gray-900 text-base">{selectedSy?.name || 'Select School Year'}</h3>
            {selectedSy?.is_active && (
              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
                <CheckCircle size={12} /> Active
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-xs font-bold text-gray-500 shrink-0">Switch Scope:</label>
        <div className="relative min-w-[220px]">
          <select
            value={selectedSy?.id || ''}
            onChange={(e) => onSelectSy(e.target.value)}
            className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-800 font-bold py-2 px-3 pr-8 rounded-lg outline-none focus:border-emerald-600 focus:bg-white text-sm cursor-pointer transition"
          >
            {schoolYears.map(sy => (
              <option key={sy.id} value={sy.id}>
                {sy.name} {sy.is_active ? '(Active)' : ''}
              </option>
            ))}
          </select>
          <ChevronDown size={16} className="absolute right-2.5 top-3 pointer-events-none text-gray-400" />
        </div>
      </div>
    </div>
  );
}
