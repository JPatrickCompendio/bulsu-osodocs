import React, { useState } from 'react';
import { ChevronDown, HelpCircle, Calendar, CheckCircle2, Archive } from 'lucide-react';

export function LifecycleLegend() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-xl mb-6 shadow-sm overflow-hidden transition">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-50/80 transition text-left"
      >
        <div className="flex items-center gap-2.5">
          <HelpCircle size={18} className="text-emerald-700" />
          <span className="font-bold text-gray-800 text-sm">Understanding School Year States</span>
        </div>
        <ChevronDown size={18} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="p-4 pt-0 border-t border-gray-100 bg-gray-50/50 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-white p-3.5 rounded-lg border border-emerald-200 space-y-1.5 shadow-2xs">
            <div className="flex items-center gap-2 text-emerald-800 font-extrabold">
              <CheckCircle2 size={14} className="text-emerald-600" />
              <span>Active</span>
            </div>
            <p className="text-gray-600">
              Currently operational school year for OSODOCS document submissions and reviews.
            </p>
          </div>

          <div className="bg-white p-3.5 rounded-lg border border-amber-200 space-y-1.5 shadow-2xs">
            <div className="flex items-center gap-2 text-amber-800 font-extrabold">
              <Calendar size={14} className="text-amber-600" />
              <span>Upcoming</span>
            </div>
            <p className="text-gray-600">
              Future academic cycle configured in advance for upcoming terms and calendar events.
            </p>
          </div>

          <div className="bg-white p-3.5 rounded-lg border border-red-200 space-y-1.5 shadow-2xs">
            <div className="flex items-center gap-2 text-red-800 font-extrabold">
              <Archive size={14} className="text-red-600" />
              <span>Archived</span>
            </div>
            <p className="text-gray-600">
              Closed or past school year records stored for historical reporting and audit logs.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
