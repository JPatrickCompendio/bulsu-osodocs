import React from 'react';
import { Plus, FileText, CheckCircle2, Clock, Edit3, Trash2, ShieldCheck, AlertCircle } from 'lucide-react';
import { YearScopePicker } from './YearScopePicker';
import { formatDateRange, determineWindowStatus } from '../../utils/academicLifecycle';

export function SubmissionWindowsTab({
  schoolYears,
  events,
  documentTypes,
  selectedSyId,
  onSelectSy,
  onNewWindow,
  onEditWindow,
  onDeleteWindow
}) {
  const selectedSy = schoolYears.find(sy => sy.id === selectedSyId) || schoolYears.find(sy => sy.is_active) || schoolYears[0];
  const windowEvents = events.filter(ev => ev.school_year_id === selectedSy?.id && ev.event_type === 'submission_window');

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
            <FileText className="text-emerald-700" size={20} />
            Document Submission Windows
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Configure submission deadlines and open periods for required documents in {selectedSy?.name}.
          </p>
        </div>

        <button
          onClick={() => onNewWindow(selectedSy?.id)}
          className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm transition"
        >
          <Plus size={16} /> Add Submission Window
        </button>
      </div>

      {/* Table of Submission Windows */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#073c2d] text-white font-bold border-b border-[#073c2d] uppercase tracking-wider text-xs">
            <tr>
              <th className="p-4 text-white">Document Type</th>
              <th className="p-4 text-white">Target Audience</th>
              <th className="p-4 text-white">Open Duration</th>
              <th className="p-4 text-white">Status</th>
              <th className="p-4 text-right text-white">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {windowEvents.map(win => {
              const dt = documentTypes.find(d => d.id === win.document_type_id);
              const status = determineWindowStatus(win);

              return (
                <tr key={win.id} className="hover:bg-gray-50/70 transition">
                  <td className="p-4 font-extrabold text-gray-900">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">
                        <FileText size={16} />
                      </div>
                      <div>
                        <div>{win.title}</div>
                        {dt && <div className="text-[11px] font-semibold text-gray-400">{dt.name}</div>}
                      </div>
                    </div>
                  </td>

                  <td className="p-4 text-xs font-bold text-gray-600">
                    <span className="bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-full text-gray-700">
                      All Student Organizations
                    </span>
                  </td>

                  <td className="p-4 text-gray-600 font-semibold text-xs">
                    {win.start_date && win.end_date ? (
                      formatDateRange(win.start_date, win.end_date)
                    ) : (
                      <span className="italic text-gray-400">Always Open</span>
                    )}
                  </td>

                  <td className="p-4">
                    {status === 'Accepting now' ? (
                      <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1 rounded-full text-xs font-extrabold inline-flex items-center gap-1">
                        <CheckCircle2 size={12} className="text-emerald-600" /> Accepting Now
                      </span>
                    ) : status === 'Opens later' ? (
                      <span className="bg-amber-100 text-amber-800 border border-amber-300 px-3 py-1 rounded-full text-xs font-bold">
                        Opens Later
                      </span>
                    ) : (
                      <span className="bg-gray-100 text-gray-600 border border-gray-200 px-3 py-1 rounded-full text-xs font-bold">
                        Closed
                      </span>
                    )}
                  </td>

                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onEditWindow(win)}
                        className="p-1.5 text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                        title="Edit Window"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        onClick={() => onDeleteWindow(win.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Delete Window"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {windowEvents.length === 0 && (
              <tr>
                <td colSpan="5" className="p-12 text-center text-gray-400 font-semibold">
                  No submission windows configured for {selectedSy?.name || 'this school year'}. Click "Add Submission Window" to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
