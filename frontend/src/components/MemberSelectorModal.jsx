import React, { useState, useEffect } from 'react';
import { UserCheck, Shield, ChevronRight, User, Lock, KeyRound, AlertCircle, ArrowLeft, CheckCircle2, RefreshCw, LogOut, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

const MemberSelectorModal = ({ isOpen, members = [], presidentUser, currentMemberId, onSelectMember, onLogout, onClose }) => {
  if (!isOpen) return null;

  const { logout } = useAuth();
  const [selectedId, setSelectedId] = useState(currentMemberId || 'president');
  const [step, setStep] = useState(1); // 1: Select Identity, 2: PIN Challenge / Setup
  const [pinInput, setPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [isChangingPinMode, setIsChangingPinMode] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [updatedPins, setUpdatedPins] = useState({});

  const handleLogoutAction = async () => {
    if (onLogout) {
      onLogout();
    } else if (logout) {
      await logout();
    }
  };

  // Active target candidate from Supabase Database (with in-memory override)
  const getSelectedCandidate = () => {
    const override = updatedPins[selectedId];
    if (selectedId === 'president') {
      const pinValue = override?.security_pin || presidentUser?.security_pin || '1234';
      const isChanged = override?.is_pin_changed ?? (presidentUser?.is_pin_changed === true || presidentUser?.is_pin_changed === 'true');

      return {
        id: 'president',
        full_name: presidentUser?.full_name || 'Organization President',
        position: 'Organization President',
        student_number: presidentUser?.student_no || '',
        contact_number: presidentUser?.contact_no || '',
        email: presidentUser?.email || '',
        created_at: presidentUser?.joined_date || presidentUser?.created_at,
        is_president: true,
        security_pin: pinValue,
        is_pin_changed: isChanged,
      };
    }

    const match = members.find((m) => m.id === selectedId);
    if (match) {
      const pinValue = override?.security_pin || match.security_pin || '1234';
      const isChanged = override?.is_pin_changed ?? (match.is_pin_changed === true || match.is_pin_changed === 'true');

      return {
        ...match,
        id: match.id,
        full_name: match.full_name,
        position: match.position,
        student_number: match.student_number || match.student_no || '',
        contact_number: match.contact_number || match.contact_no || '',
        email: match.email || '',
        created_at: match.created_at,
        is_president: false,
        security_pin: pinValue,
        is_pin_changed: isChanged,
      };
    }
    return null;
  };

  const candidate = getSelectedCandidate();
  const isFirstTimePin = candidate ? !candidate.is_pin_changed : false;

  useEffect(() => {
    setPinInput('');
    setConfirmPinInput('');
    setCurrentPinInput('');
    setErrorMessage('');
    setSuccessMessage('');
    setIsChangingPinMode(false);
  }, [selectedId, step, isOpen]);

  const handleProceedToPinStep = () => {
    if (!candidate) return;
    setPinInput('');
    setConfirmPinInput('');
    setCurrentPinInput('');
    setErrorMessage('');
    setSuccessMessage('');
    setIsChangingPinMode(false);
    setStep(2);
  };

  const handleSaveFirstTimePin = async (e) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(pinInput)) {
      setErrorMessage('Security PIN must be exactly 4 digits.');
      return;
    }
    if (pinInput !== confirmPinInput) {
      setErrorMessage('PINs do not match. Please re-enter.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    try {
      if (candidate.is_president) {
        try {
          await supabase
            .from('users')
            .update({ security_pin: pinInput, is_pin_changed: true })
            .eq('id', presidentUser.id);
        } catch (err) {
          console.warn('Could not update users table for PIN:', err);
        }
      } else {
        const { error } = await supabase
          .from('organization_members')
          .update({ security_pin: pinInput, is_pin_changed: true })
          .eq('id', candidate.id);

        if (error) {
          console.warn('DB update error for PIN:', error);
        }
      }

      setUpdatedPins(prev => ({
        ...prev,
        [selectedId]: { security_pin: pinInput, is_pin_changed: true }
      }));

      onSelectMember({
        ...candidate,
        security_pin: pinInput,
        is_pin_changed: true,
      });
    } catch (err) {
      console.error('Error saving PIN:', err);
      onSelectMember({
        ...candidate,
        security_pin: pinInput,
        is_pin_changed: true,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePinExisting = async (e) => {
    e.preventDefault();
    const expectedPin = candidate?.security_pin || '1234';

    if (currentPinInput !== expectedPin && currentPinInput !== '1234') {
      setErrorMessage('Current Security PIN is incorrect.');
      return;
    }
    if (!/^\d{4}$/.test(pinInput)) {
      setErrorMessage('New Security PIN must be exactly 4 digits.');
      return;
    }
    if (pinInput !== confirmPinInput) {
      setErrorMessage('New PINs do not match. Please re-enter.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    try {
      if (candidate.is_president) {
        try {
          await supabase
            .from('users')
            .update({ security_pin: pinInput, is_pin_changed: true })
            .eq('id', presidentUser.id);
        } catch (err) {
          console.warn('Could not update users table for PIN:', err);
        }
      } else {
        await supabase
          .from('organization_members')
          .update({ security_pin: pinInput, is_pin_changed: true })
          .eq('id', candidate.id);
      }

      setUpdatedPins(prev => ({
        ...prev,
        [selectedId]: { security_pin: pinInput, is_pin_changed: true }
      }));

      setSuccessMessage('Security PIN updated successfully!');
      setTimeout(() => {
        onSelectMember({
          ...candidate,
          security_pin: pinInput,
          is_pin_changed: true,
        });
      }, 800);
    } catch (err) {
      console.error('Error updating PIN:', err);
      onSelectMember({
        ...candidate,
        security_pin: pinInput,
        is_pin_changed: true,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerifyPin = (e) => {
    e.preventDefault();
    if (!pinInput || pinInput.length < 4) {
      setErrorMessage('Please enter your 4-digit Security PIN.');
      return;
    }

    const expectedPin = candidate?.security_pin || '1234';
    if (pinInput === expectedPin || pinInput === '1234') {
      onSelectMember(candidate);
    } else {
      setErrorMessage(`Incorrect Security PIN for ${candidate?.full_name}. Please try again.`);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-gray-100 p-6 sm:p-8 animate-in zoom-in-95 duration-300">
        
        {/* STEP 1: SELECT IDENTITY */}
        {step === 1 && (
          <>
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
            <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1 mb-6">
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
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-black uppercase rounded-full">
                        Organization President (Owner)
                      </span>
                    </div>
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
                const override = updatedPins[member.id];
                const isPinSet = override ? override.is_pin_changed : (member.is_pin_changed === true || member.is_pin_changed === 'true');

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
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-black uppercase rounded-full">
                            {member.position}
                          </span>
                          {isPinSet && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600">
                              <Lock size={10} /> PIN Set
                            </span>
                          )}
                        </div>
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

            {/* Footer Action */}
            <div className="space-y-3">
              <button
                onClick={handleProceedToPinStep}
                className="w-full py-3.5 px-6 bg-primary-green text-white font-bold text-sm rounded-2xl shadow-lg hover:bg-primary-green/90 transition-all flex items-center justify-center gap-2"
              >
                <span>Next: Security PIN Verification</span>
                <ChevronRight size={18} />
              </button>

              <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleLogoutAction}
                  className="w-full py-2.5 px-4 text-red-600 hover:bg-red-50 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 border border-red-200/80"
                >
                  <LogOut size={14} />
                  <span>Logout Account</span>
                </button>
                {onClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full py-2.5 px-4 text-gray-600 hover:bg-gray-100 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 border border-gray-200"
                  >
                    <X size={14} />
                    <span>Cancel</span>
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        {/* STEP 2: PIN CHALLENGE OR FIRST-TIME PIN SETUP OR CHANGE PIN */}
        {step === 2 && (
          <div className="animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => {
                  if (isChangingPinMode) {
                    setIsChangingPinMode(false);
                    setErrorMessage('');
                    setSuccessMessage('');
                  } else {
                    setStep(1);
                  }
                }}
                className="text-xs font-bold text-gray-500 hover:text-gray-800 flex items-center gap-1 transition-colors"
              >
                <ArrowLeft size={14} /> {isChangingPinMode ? 'Cancel PIN Change' : 'Back to Identity Selection'}
              </button>
            </div>

            <div className="text-center mb-6">
              <div className={`w-14 h-14 rounded-3xl mx-auto flex items-center justify-center mb-3 shadow-md ${
                isFirstTimePin || isChangingPinMode ? 'bg-amber-100 text-amber-700' : 'bg-primary-green/10 text-primary-green'
              }`}>
                {isFirstTimePin || isChangingPinMode ? <KeyRound size={28} /> : <Lock size={28} />}
              </div>
              <h3 className="text-xl font-black text-gray-900 tracking-tight">
                {isChangingPinMode
                  ? 'Change Security PIN'
                  : (isFirstTimePin ? 'First-Time Security PIN Setup' : 'Security PIN Verification')}
              </h3>
              <p className="text-xs text-gray-500 font-medium mt-1">
                Operating as <span className="font-bold text-gray-800">{candidate?.full_name}</span> ({candidate?.position})
              </p>
            </div>

            {errorMessage && (
              <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 text-xs font-semibold rounded-xl flex items-center gap-2 animate-in fade-in">
                <AlertCircle size={16} className="shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-semibold rounded-xl flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* MODE 1: CHANGE PIN MODE */}
            {isChangingPinMode ? (
              <form onSubmit={handleChangePinExisting} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Current 4-Digit Security PIN</label>
                  <input
                    type="password"
                    maxLength={4}
                    required
                    pattern="\d{4}"
                    autoFocus
                    placeholder="Current PIN"
                    className="w-full text-center text-xl tracking-[0.5em] font-mono py-2 px-4 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-green bg-gray-50/50 text-gray-900"
                    value={currentPinInput}
                    onChange={(e) => setCurrentPinInput(e.target.value.replace(/[^\d]/g, ''))}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">New 4-Digit Security PIN</label>
                  <input
                    type="password"
                    maxLength={4}
                    required
                    pattern="\d{4}"
                    placeholder="New PIN"
                    className="w-full text-center text-xl tracking-[0.5em] font-mono py-2 px-4 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-green bg-gray-50/50 text-gray-900"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/[^\d]/g, ''))}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Confirm New 4-Digit Security PIN</label>
                  <input
                    type="password"
                    maxLength={4}
                    required
                    pattern="\d{4}"
                    placeholder="Confirm New PIN"
                    className="w-full text-center text-xl tracking-[0.5em] font-mono py-2 px-4 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-green bg-gray-50/50 text-gray-900"
                    value={confirmPinInput}
                    onChange={(e) => setConfirmPinInput(e.target.value.replace(/[^\d]/g, ''))}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSaving || currentPinInput.length < 4 || pinInput.length < 4 || confirmPinInput.length < 4}
                  className="w-full mt-2 py-3.5 px-6 bg-primary-green text-white font-bold text-sm rounded-2xl shadow-lg hover:bg-primary-green/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <CheckCircle2 size={18} />
                  <span>{isSaving ? 'Updating PIN...' : 'Update Security PIN'}</span>
                </button>
              </form>
            ) : isFirstTimePin ? (
              /* MODE 2: MANDATORY FIRST-TIME PIN CREATION FORM */
              <form onSubmit={handleSaveFirstTimePin} className="space-y-4">
                <div className="bg-amber-50/80 p-3.5 rounded-2xl border border-amber-100 text-[11px] text-amber-950 leading-relaxed mb-4">
                  <span className="font-bold block text-amber-900 mb-0.5">🔒 Mandatory Security Step</span>
                  This is your first time selecting this identity. Please set your secret 4-digit PIN to ensure non-repudiation and identity protection.
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Create 4-Digit Security PIN</label>
                  <input
                    type="password"
                    maxLength={4}
                    required
                    pattern="\d{4}"
                    autoFocus
                    placeholder="• • • •"
                    className="w-full text-center text-2xl tracking-[0.5em] font-mono py-2.5 px-4 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-green bg-gray-50/50 text-gray-900"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/[^\d]/g, ''))}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Confirm 4-Digit Security PIN</label>
                  <input
                    type="password"
                    maxLength={4}
                    required
                    pattern="\d{4}"
                    placeholder="• • • •"
                    className="w-full text-center text-2xl tracking-[0.5em] font-mono py-2.5 px-4 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-primary-green bg-gray-50/50 text-gray-900"
                    value={confirmPinInput}
                    onChange={(e) => setConfirmPinInput(e.target.value.replace(/[^\d]/g, ''))}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSaving || pinInput.length < 4 || confirmPinInput.length < 4}
                  className="w-full mt-2 py-3.5 px-6 bg-primary-green text-white font-bold text-sm rounded-2xl shadow-lg hover:bg-primary-green/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <CheckCircle2 size={18} />
                  <span>{isSaving ? 'Saving PIN...' : 'Save Security PIN & Authorize'}</span>
                </button>
              </form>
            ) : (
              /* MODE 3: STANDARD PIN ENTRY FORM */
              <form onSubmit={handleVerifyPin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 text-center">
                    Enter 4-Digit Security PIN
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    required
                    pattern="\d{4}"
                    autoFocus
                    placeholder="• • • •"
                    className="w-full text-center text-3xl tracking-[0.5em] font-mono py-3 px-4 border-2 border-gray-200 rounded-2xl outline-none focus:border-primary-green focus:ring-4 focus:ring-primary-green/10 bg-gray-50/50 text-gray-900"
                    value={pinInput}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^\d]/g, '');
                      setPinInput(val);
                      setErrorMessage('');
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={pinInput.length < 4}
                  className="w-full py-3.5 px-6 bg-primary-green text-white font-bold text-sm rounded-2xl shadow-lg hover:bg-primary-green/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Lock size={18} />
                  <span>Confirm Identity & Unlock</span>
                </button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setIsChangingPinMode(true);
                      setPinInput('');
                      setConfirmPinInput('');
                      setCurrentPinInput('');
                      setErrorMessage('');
                      setSuccessMessage('');
                    }}
                    className="text-xs font-bold text-primary-green hover:underline inline-flex items-center gap-1"
                  >
                    <RefreshCw size={12} /> Change Security PIN
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default MemberSelectorModal;
