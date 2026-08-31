import React from 'react';
import { Lock, X, AlertTriangle } from 'lucide-react';

export function CloseConfirmModal({ isOpen, onClose, onConfirm, targetSy }) {
  if (!isOpen || !targetSy) return null;

  return (
    <div className="fixed inset-0 z-[110] bg-slate-900/60 flex items-center justify-center backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-md p-6 sm:p-8 shadow-2xl border border-amber-100 animate-in zoom-in-95 duration-200 text-gray-800 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
        >
          <X size={20} />
        </button>

        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-5 border border-amber-100">
          <Lock size={28} />
        </div>

        <h3 className="text-xl font-black text-gray-900 mb-2">Close Submissions</h3>
        <p className="text-sm font-bold text-gray-600 mb-3">
          Are you sure you want to close submissions for <strong className="text-amber-700 font-extrabold">{targetSy.name}</strong>?
        </p>
        <div className="p-3.5 bg-amber-50/80 border border-amber-200/60 rounded-xl mb-6 flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 font-bold leading-relaxed">
            Closing submissions will prevent students and organization presidents from submitting new proposal forms for this academic year.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-all text-xs uppercase tracking-wider"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(targetSy)}
            className="flex-1 px-4 py-3 bg-amber-600 text-white font-bold rounded-xl shadow-lg hover:bg-amber-700 transition-all text-xs uppercase tracking-wider"
          >
            Confirm Close
          </button>
        </div>
      </div>
    </div>
  );
}
