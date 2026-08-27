import React, { useState } from 'react';
import { Plus, Clock, CheckCircle2, Edit3, Trash2, Calendar, AlertCircle } from 'lucide-react';
import { YearScopePicker } from './YearScopePicker';
import { formatDateRange, determineSemesterStatus } from '../../utils/academicLifecycle';

export function SemestersTab({
  schoolYears,
  semesters,
  selectedSyId,
  onSelectSy,
  onNewSemester,
  onActivateSemester,
  onEditSemester,
  onArchiveSemester
}) {
  const selectedSy = schoolYears.find(sy => sy.id === selectedSyId) || schoolYears.find(sy => sy.is_active) || schoolYears[0];
  const sySemesters = semesters.filter(sem => sem.school_year_id === selectedSy?.id);

  return (
    <div className="space-y-6">
      {/* Top Scope Selector */}
      <YearScopePicker
        schoolYears={schoolYears}
        selectedSyId={selectedSyId}
        onSelectSy={onSelectSy}
      />

      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-extrabold text-gray-900 text-lg flex items-center gap-2">
            <Clock className="text-emerald-700" size={20} />
            Academic Semesters & Terms
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Configure term dates within {selectedSy?.name || 'the selected School Year'}.
          </p>
        </div>

        <button
          onClick={() => onNewSemester(selectedSy?.id)}
          className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm transition"
        >
          <Plus size={16} /> New Semester
        </button>
      </div>

      {/* Semesters Cards / Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#073c2d] text-white font-bold border-b border-[#073c2d] uppercase tracking-wider text-xs">
            <tr>
              <th className="p-4 text-white">Semester Name</th>
              <th className="p-4 text-white">Duration</th>
              <th className="p-4 text-white">Status</th>
              <th className="p-4 text-right text-white">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {sySemesters.map(sem => {
              const status = determineSemesterStatus(sem);
              const isArchived = sem.status === 'archived';

              return (
                <tr key={sem.id} className="hover:bg-gray-50/70 transition">
                  <td className="p-4 font-extrabold text-gray-900">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">
                        <Clock size={16} />
                      </div>
                      <span>{sem.name}</span>
                    </div>
                  </td>

                  <td className="p-4 text-gray-600 font-semibold text-xs">
                    {formatDateRange(sem.start_date, sem.end_date)}
                  </td>

                  <td className="p-4">
                    {isArchived ? (
                      <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold uppercase">Archived</span>
                    ) : sem.is_active ? (
                      <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1 rounded-full text-xs font-extrabold flex items-center gap-1 w-fit">
                        <CheckCircle2 size={12} className="text-emerald-600" /> Ongoing Term
                      </span>
                    ) : (
                      <span className="bg-gray-100 text-gray-600 border border-gray-200 px-3 py-1 rounded-full text-xs font-bold w-fit">
                        {status}
                      </span>
                    )}
                  </td>

                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {!sem.is_active && !isArchived && (
                        <button
                          onClick={() => onActivateSemester(sem.id)}
                          className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold transition flex items-center gap-1"
                        >
                          Set as Current
                        </button>
                      )}

                      {!isArchived && (
                        <button
                          onClick={() => onEditSemester(sem)}
                          className="p-1.5 text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                          title="Edit Semester"
                        >
                          <Edit3 size={16} />
                        </button>
                      )}

                      <button
                        onClick={() => onArchiveSemester(sem.id)}
                        disabled={sem.is_active || isArchived}
                        title={sem.is_active ? "Active semesters cannot be archived" : isArchived ? "Already archived" : "Archive Semester"}
                        className={`p-1.5 rounded-lg transition ${
                          sem.is_active || isArchived
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                        }`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {sySemesters.length === 0 && (
              <tr>
                <td colSpan="4" className="p-12 text-center text-gray-400 font-semibold">
                  No semesters configured for {selectedSy?.name || 'this school year'}. Click "New Semester" to add one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
