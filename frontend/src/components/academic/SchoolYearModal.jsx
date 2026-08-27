import React, { useState, useEffect } from 'react';
import { X, Calendar } from 'lucide-react';

export function SchoolYearModal({ isOpen, onClose, onSave, syForm, setSyForm }) {
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
            <Calendar className="text-emerald-700" size={20} />
            {syForm.id ? 'Edit School Year' : 'Create School Year'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Start Date</label>
              <input
                required
                type="date"
                className="w-full p-2.5 border border-gray-300 rounded-xl outline-none focus:border-emerald-600 font-bold text-gray-800 text-xs bg-white"
                value={syForm.start_date || ''}
                onChange={e => {
                  const newStart = e.target.value;
                  const startYr = newStart ? new Date(newStart).getFullYear() : '';
                  const endYr = syForm.end_date ? new Date(syForm.end_date).getFullYear() : (startYr ? startYr + 1 : '');
                  const autoName = (startYr && endYr) ? (startYr === endYr ? `${startYr}` : `${startYr}-${endYr}`) : syForm.name;
                  setSyForm({ ...syForm, start_date: newStart, name: autoName });
                }}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">End Date</label>
              <input
                required
                type="date"
                className="w-full p-2.5 border border-gray-300 rounded-xl outline-none focus:border-emerald-600 font-bold text-gray-800 text-xs bg-white"
                value={syForm.end_date || ''}
                onChange={e => {
                  const newEnd = e.target.value;
                  const endYr = newEnd ? new Date(newEnd).getFullYear() : '';
                  const startYr = syForm.start_date ? new Date(syForm.start_date).getFullYear() : (endYr ? endYr - 1 : '');
                  const autoName = (startYr && endYr) ? (startYr === endYr ? `${startYr}` : `${startYr}-${endYr}`) : syForm.name;
                  setSyForm({ ...syForm, end_date: newEnd, name: autoName });
                }}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">School Year Title</label>
            <div className="flex items-center gap-2">
              <span className="bg-gray-100 text-gray-700 font-extrabold px-3 py-2.5 rounded-xl text-xs shrink-0 border border-gray-200">
                Academic Year
              </span>
              <input
                required
                type="text"
                placeholder="e.g. 2026-2027"
                className="w-full p-2.5 border border-gray-300 rounded-xl outline-none focus:border-emerald-600 font-extrabold text-gray-900 text-sm"
                value={syForm.name ? syForm.name.replace(/^Academic Year\s*/i, '') : ''}
                onChange={e => setSyForm({ ...syForm, name: e.target.value })}
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
              Save School Year
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
