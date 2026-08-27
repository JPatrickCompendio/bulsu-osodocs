import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export function ArchiveConfirmModal({ isOpen, onClose, onConfirm, targetSy }) {
  const [confirmInput, setConfirmInput] = useState('');

  if (!isOpen || !targetSy) return null;

  const expectedName = targetSy.name || '';
  const isMatch = confirmInput.trim().toLowerCase() === expectedName.trim().toLowerCase();

  const handleConfirm = () => {
    if (isMatch) {
      onConfirm(targetSy.id);
      setConfirmInput('');
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black/50 flex items-center justify-center backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-red-100 animate-in fade-in zoom-in duration-150">
        <div className="flex items-center gap-3 text-red-600 mb-3">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-gray-900">Archive School Year</h3>
            <p className="text-xs text-red-600 font-bold">This action closes active operations for this year.</p>
          </div>
        </div>

        <p className="text-xs text-gray-600 mb-4 leading-relaxed">
          Archiving <strong className="text-gray-900 font-extrabold">{expectedName}</strong> will move all associated calendar records into a read-only historical state.
        </p>

        <div className="space-y-2 mb-6">
          <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
            Type <strong className="text-gray-800 font-extrabold">{expectedName}</strong> to confirm:
          </label>
          <input
            type="text"
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            placeholder={expectedName}
            className="w-full p-2.5 border border-gray-300 rounded-xl outline-none focus:border-red-500 text-xs font-bold text-gray-900"
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => {
              setConfirmInput('');
              onClose();
            }}
            className="px-4 py-2 text-gray-500 font-bold text-xs hover:bg-gray-100 rounded-xl transition"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isMatch}
            className={`px-5 py-2 font-extrabold text-xs rounded-xl shadow-sm transition ${
              isMatch 
                ? 'bg-red-600 hover:bg-red-700 text-white cursor-pointer' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            Confirm Permanent Archive
          </button>
        </div>
      </div>
    </div>
  );
}
