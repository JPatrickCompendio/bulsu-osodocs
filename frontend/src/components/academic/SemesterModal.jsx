import React from 'react';
import { X, Clock } from 'lucide-react';

export function SemesterModal({ isOpen, onClose, onSave, semForm, setSemForm, schoolYears }) {
  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(e);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-gray-100 animate-in fade-in zoom-in duration-150">
        <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
          <h3 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
            <Clock className="text-emerald-700" size={20} />
            {semForm.id ? 'Edit Semester' : 'Create Semester'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Target School Year</label>
            <select
              required
              className="w-full p-2.5 border border-gray-300 rounded-xl outline-none focus:border-emerald-600 font-bold text-gray-800 text-xs bg-white"
              value={semForm.school_year_id || ''}
              onChange={e => setSemForm({ ...semForm, school_year_id: e.target.value })}
            >
              <option value="">Select School Year...</option>
              {schoolYears.map(sy => (
                <option key={sy.id} value={sy.id}>
                  {sy.name} {sy.is_active ? '(Active)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Semester Name</label>
            <input
              required
              type="text"
              placeholder="e.g. First Semester, Second Semester, Summer"
              className="w-full p-2.5 border border-gray-300 rounded-xl outline-none focus:border-emerald-600 font-extrabold text-gray-900 text-xs"
              value={semForm.name || ''}
              onChange={e => setSemForm({ ...semForm, name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Start Date</label>
              <input
                required
                type="date"
                className="w-full p-2.5 border border-gray-300 rounded-xl outline-none focus:border-emerald-600 font-bold text-gray-800 text-xs bg-white"
                value={semForm.start_date || ''}
                onChange={e => setSemForm({ ...semForm, start_date: e.target.value })}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">End Date</label>
              <input
                required
                type="date"
                className="w-full p-2.5 border border-gray-300 rounded-xl outline-none focus:border-emerald-600 font-bold text-gray-800 text-xs bg-white"
                value={semForm.end_date || ''}
                onChange={e => setSemForm({ ...semForm, end_date: e.target.value })}
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-500 font-bold text-xs hover:bg-gray-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs rounded-xl shadow-sm transition"
            >
              Save Semester
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
