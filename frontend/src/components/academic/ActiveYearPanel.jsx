import React from 'react';
import { Calendar, CheckCircle2, Clock, Lock, Edit3, ShieldAlert, Sparkles, Eye } from 'lucide-react';
import { formatDateRange } from '../../utils/academicLifecycle';

export function ActiveYearPanel({ activeSy, activeSemester, blockedDaysCount, onEdit, onCloseSubmissions, canEdit = true }) {
  if (!activeSy) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-amber-800 flex items-center justify-between mb-8 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 font-bold shrink-0">
            <ShieldAlert size={24} />
          </div>
          <div>
            <h3 className="font-bold text-lg">No Active School Year Selected</h3>
            <p className="text-xs text-amber-700 mt-0.5">
              Select or activate a School Year below to set the official administrative cycle for OSOADOCS.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-[#073c2d] to-[#0f523c] text-white rounded-2xl p-6 shadow-xl mb-8 border border-[#17634a] relative overflow-hidden">
      {/* Subtle shine backdrop decoration */}
      <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 bg-emerald-400/20 text-emerald-300 text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider border border-emerald-400/30">
              <CheckCircle2 size={14} className="text-emerald-400" /> Active School Year
            </span>
            {activeSemester && (
              <span className="inline-flex items-center gap-1 bg-amber-400/20 text-amber-300 text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider border border-amber-400/30">
                <Clock size={14} className="text-amber-400" /> {activeSemester.name}
              </span>
            )}
          </div>

          <h2 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            {activeSy.name}
          </h2>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-semibold text-emerald-100/80">
            <div className="flex items-center gap-1.5">
              <Calendar size={14} className="text-amber-400" />
              <span>{formatDateRange(activeSy.start_date, activeSy.end_date)}</span>
            </div>
            {blockedDaysCount > 0 && (
              <div className="flex items-center gap-1.5">
                <Lock size={14} className="text-red-400" />
                <span className="text-red-300 font-bold">{blockedDaysCount} Blocked Proposal Dates</span>
              </div>
            )}
          </div>
        </div>

        {/* Quick Action buttons */}
        {canEdit ? (
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => onEdit(activeSy)}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 border border-white/20 backdrop-blur-md"
            >
              <Edit3 size={16} /> Edit Year Details
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 shrink-0 bg-white/10 px-3.5 py-2 rounded-xl border border-white/20 text-xs font-bold text-emerald-100 backdrop-blur-md">
            <Eye size={14} className="text-emerald-300" /> Read-Only View
          </div>
        )}
      </div>
    </div>
  );
}
