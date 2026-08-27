import React, { useState } from 'react';
import { 
  Edit3, CheckCircle2, Lock, Trash2, Archive, Calendar, MoreVertical, Plus 
} from 'lucide-react';
import { formatDateRange, determineSchoolYearStatus, getSchoolYearStatusBadge } from '../../utils/academicLifecycle';

export function SchoolYearsTable({ 
  schoolYears, 
  semesters,
  onNewSchoolYear, 
  onActivate, 
  onEdit, 
  onClose, 
  onArchive, 
  onDelete 
}) {
  const [filter, setFilter] = useState('ALL');
  const [openMenuId, setOpenMenuId] = useState(null);

  const filteredYears = schoolYears.filter(sy => {
    if (filter === 'ALL') return true;
    const status = determineSchoolYearStatus(sy).toUpperCase();
    return status === filter;
  });

  return (
    <div className="space-y-4">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Status Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 bg-gray-100 p-1 rounded-xl w-fit border border-gray-200">
          {['ALL', 'ACTIVE', 'UPCOMING', 'ARCHIVED'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition capitalize ${
                filter === f 
                  ? 'bg-white text-gray-900 shadow-2xs font-extrabold' 
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {f === 'ALL' ? 'All Years' : f.toLowerCase()}
            </button>
          ))}
        </div>

        <button
          onClick={onNewSchoolYear}
          className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm transition shrink-0"
        >
          <Plus size={16} /> Add School Year
        </button>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#073c2d] text-white font-bold border-b border-[#073c2d] uppercase tracking-wider text-xs">
              <tr>
                <th className="p-4 text-white">School Year</th>
                <th className="p-4 text-white">Duration</th>
                <th className="p-4 text-white">Status</th>
                <th className="p-4 text-white">Terms Configured</th>
                <th className="p-4 text-right text-white">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {filteredYears.map(sy => {
                const status = determineSchoolYearStatus(sy);
                const badge = getSchoolYearStatusBadge(status);
                const sySemesters = semesters.filter(sem => sem.school_year_id === sy.id);

                return (
                  <tr key={sy.id} className="hover:bg-gray-50/70 transition">
                    <td className="p-4 font-extrabold text-gray-900">
                      <div className="flex items-center gap-2.5">
                        <Calendar size={18} className="text-emerald-700 shrink-0" />
                        <span>{sy.name}</span>
                      </div>
                    </td>

                    <td className="p-4 text-gray-600 font-semibold text-xs">
                      {formatDateRange(sy.start_date, sy.end_date)}
                    </td>

                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${badge.bg}`}>
                        <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
                        {badge.label}
                      </span>
                    </td>

                    <td className="p-4 text-gray-600 font-bold text-xs">
                      {sySemesters.length} {sySemesters.length === 1 ? 'Semester' : 'Semesters'}
                    </td>

                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!sy.is_active && status !== 'Archived' && (
                          <button
                            onClick={() => onActivate(sy.id)}
                            className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-bold transition flex items-center gap-1"
                          >
                            <CheckCircle2 size={14} /> Set Active
                          </button>
                        )}

                        <button
                          onClick={() => onEdit(sy)}
                          className="p-1.5 text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                          title="Edit School Year"
                        >
                          <Edit3 size={16} />
                        </button>

                        <button
                          onClick={() => onArchive(sy)}
                          disabled={sy.is_active}
                          title={sy.is_active ? "Active school years cannot be archived" : "Archive School Year"}
                          className={`p-1.5 rounded-lg transition ${
                            sy.is_active 
                              ? 'text-gray-300 cursor-not-allowed' 
                              : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                          }`}
                        >
                          <Archive size={16} />
                        </button>

                        <button
                          onClick={() => onDelete(sy.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Delete School Year"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredYears.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-12 text-center text-gray-400 font-semibold">
                    No school years found for the selected filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
