import React from 'react';
import { X, CalendarDays, Lock } from 'lucide-react';

export function EventModal({ 
  isOpen, 
  onClose, 
  onSave, 
  eventForm, 
  setEventForm, 
  schoolYears, 
  documentTypes 
}) {
  if (!isOpen) return null;

  const eventTypes = [
    { value: 'school_event', label: 'School Event' },
    { value: 'submission_window', label: 'Submission Window' },
    { value: 'holiday', label: 'Holiday' },
    { value: 'exam_week', label: 'Exam Week' },
    { value: 'enrollment', label: 'Enrollment' },
    { value: 'announcement', label: 'Announcement' }
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(e);
  };

  const selectedSy = schoolYears.find(sy => sy.id === eventForm.school_year_id);
  const isEntireSy = eventForm.event_type === 'submission_window' && selectedSy && 
    eventForm.start_date === selectedSy.start_date.split('T')[0] && 
    eventForm.end_date === selectedSy.end_date.split('T')[0];

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-gray-100 animate-in fade-in zoom-in duration-150 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
          <h3 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
            <CalendarDays className="text-emerald-700" size={20} />
            {eventForm.id ? 'Edit Calendar Event' : 'Create Calendar Event'}
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
              value={eventForm.school_year_id || ''}
              onChange={e => setEventForm({ ...eventForm, school_year_id: e.target.value })}
            >
              <option value="">Select School Year...</option>
              {schoolYears.map(sy => (
                <option key={sy.id} value={sy.id}>
                  {sy.name} {sy.is_active ? '(Active)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Event Category</label>
              <select
                required
                className="w-full p-2.5 border border-gray-300 rounded-xl outline-none focus:border-emerald-600 font-bold text-gray-800 text-xs bg-white"
                value={eventForm.event_type || 'school_event'}
                onChange={e => setEventForm({ ...eventForm, event_type: e.target.value })}
              >
                {eventTypes.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {eventForm.event_type === 'submission_window' && (
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Document Type</label>
                <select
                  required
                  className="w-full p-2.5 border border-gray-300 rounded-xl outline-none focus:border-emerald-600 font-bold text-gray-800 text-xs bg-white"
                  value={eventForm.document_type_id || ''}
                  onChange={e => setEventForm({ ...eventForm, document_type_id: e.target.value })}
                >
                  <option value="">Select Document...</option>
                  {documentTypes.map(dt => (
                    <option key={dt.id} value={dt.id}>{dt.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {eventForm.event_type === 'submission_window' ? (
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Event Title</label>
              <input
                type="text"
                disabled
                className="w-full p-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 font-semibold text-xs cursor-not-allowed"
                value={(() => {
                  const dt = documentTypes.find(d => d.id === eventForm.document_type_id);
                  return dt ? `${dt.name} Submission Window` : 'Auto-generated from Document Type';
                })()}
              />
            </div>
          ) : (
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Event Title</label>
              <input
                required
                type="text"
                placeholder="e.g. University Foundation Week, Midterm Examinations"
                className="w-full p-2.5 border border-gray-300 rounded-xl outline-none focus:border-emerald-600 font-extrabold text-gray-900 text-xs"
                value={eventForm.title || ''}
                onChange={e => setEventForm({ ...eventForm, title: e.target.value })}
              />
            </div>
          )}

          {/* Schedule Section */}
          <div className="border border-gray-200 rounded-2xl p-4 bg-gray-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-gray-700 uppercase tracking-wider">Schedule</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Start Date</label>
                <input
                  type="date"
                  className={`w-full p-2 border rounded-xl outline-none text-xs font-bold ${
                    isEntireSy ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-white border-gray-300 focus:border-emerald-600'
                  }`}
                  value={eventForm.start_date || ''}
                  onChange={e => setEventForm({ ...eventForm, start_date: e.target.value })}
                  disabled={isEntireSy}
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">End Date</label>
                <input
                  type="date"
                  className={`w-full p-2 border rounded-xl outline-none text-xs font-bold ${
                    isEntireSy ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-white border-gray-300 focus:border-emerald-600'
                  }`}
                  value={eventForm.end_date || ''}
                  onChange={e => setEventForm({ ...eventForm, end_date: e.target.value })}
                  disabled={isEntireSy}
                />
              </div>
            </div>

            {/* Toggle Switches */}
            <div className="space-y-3 pt-3 border-t border-gray-200">
              {eventForm.event_type === 'submission_window' && selectedSy && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700">Entire School Year Duration</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isEntireSy && selectedSy) {
                        setEventForm({
                          ...eventForm,
                          start_date: selectedSy.start_date.split('T')[0],
                          end_date: selectedSy.end_date.split('T')[0]
                        });
                      } else {
                        setEventForm({
                          ...eventForm,
                          start_date: '',
                          end_date: ''
                        });
                      }
                    }}
                    className={`w-10 h-5 flex items-center rounded-full p-0.5 transition cursor-pointer ${
                      isEntireSy ? 'bg-emerald-600' : 'bg-gray-300'
                    }`}
                  >
                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      isEntireSy ? 'translate-x-5' : ''
                    }`} />
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-gray-800 flex items-center gap-1.5">
                  <Lock size={14} className="text-red-500" />
                  Block Activity Proposals on these dates
                </span>
                <button
                  type="button"
                  onClick={() => setEventForm({ ...eventForm, blocks_activity: !eventForm.blocks_activity })}
                  className={`w-10 h-5 flex items-center rounded-full p-0.5 transition cursor-pointer ${
                    eventForm.blocks_activity ? 'bg-red-500' : 'bg-gray-300'
                  }`}
                >
                  <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                    eventForm.blocks_activity ? 'translate-x-5' : ''
                  }`} />
                </button>
              </div>
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
              Save Event
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
