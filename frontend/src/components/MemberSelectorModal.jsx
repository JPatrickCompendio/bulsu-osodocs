import React, { useState } from 'react';
import { UserCheck, Shield, ChevronRight, User } from 'lucide-react';

const MemberSelectorModal = ({ isOpen, members = [], presidentUser, onSelectMember }) => {
  if (!isOpen) return null;

  const [selectedId, setSelectedId] = useState('president');

  const handleConfirm = () => {
    if (selectedId === 'president') {
      onSelectMember({
        id: 'president',
        full_name: presidentUser?.full_name || 'Organization President',
        position: 'Organization President',
        is_president: true,
      });
    } else {
      const match = members.find((m) => m.id === selectedId);
      if (match) {
        onSelectMember({
          id: match.id,
          full_name: match.full_name,
          position: match.position,
          is_president: false,
        });
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-gray-100 p-6 sm:p-8 animate-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-primary-green/10 text-primary-green flex items-center justify-center shrink-0">
            <UserCheck size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-gray-900 tracking-tight">Who is using this account?</h2>
            <p className="text-xs text-gray-500 font-medium mt-0.5">
              Select your identity for this session. Actions and timeline logs will be attributed to you.
            </p>
          </div>
        </div>

        {/* List of Identities */}
        <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1 mb-6">
          {/* President Option */}
          <div
            onClick={() => setSelectedId('president')}
            className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer ${
              selectedId === 'president'
                ? 'border-primary-green bg-primary-green/5 shadow-sm'
                : 'border-gray-100 hover:border-gray-200 bg-gray-50/50'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold text-sm">
                <Shield size={20} />
              </div>
              <div>
                <p className="font-bold text-sm text-gray-900">{presidentUser?.full_name || 'Organization President'}</p>
                <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-black uppercase rounded-full mt-0.5">
                  Organization President (Owner)
                </span>
              </div>
            </div>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              selectedId === 'president' ? 'border-primary-green bg-primary-green' : 'border-gray-300'
            }`}>
              {selectedId === 'president' && <div className="w-2 h-2 rounded-full bg-white" />}
            </div>
          </div>

          {/* Members Options */}
          {members.map((member) => {
            const isSelected = selectedId === member.id;
            return (
              <div
                key={member.id}
                onClick={() => setSelectedId(member.id)}
                className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                  isSelected
                    ? 'border-primary-green bg-primary-green/5 shadow-sm'
                    : 'border-gray-100 hover:border-gray-200 bg-gray-50/50'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold text-sm">
                    <User size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-gray-900">{member.full_name}</p>
                    <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-black uppercase rounded-full mt-0.5">
                      {member.position}
                    </span>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  isSelected ? 'border-primary-green bg-primary-green' : 'border-gray-300'
                }`}>
                  {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Confirm */}
        <button
          onClick={handleConfirm}
          className="w-full py-3.5 px-6 bg-primary-green text-white font-bold text-sm rounded-2xl shadow-lg hover:bg-primary-green/90 transition-all flex items-center justify-center gap-2"
        >
          <span>Confirm Active Session Identity</span>
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
};

export default MemberSelectorModal;
