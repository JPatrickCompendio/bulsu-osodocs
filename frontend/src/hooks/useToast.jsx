import React, { useState, useCallback } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export const useToast = () => {
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    const lowerMsg = message.toLowerCase();
    const isErrorKeyword = lowerMsg.includes('fail') || lowerMsg.includes('error') || lowerMsg.includes('cannot') || lowerMsg.includes('invalid');
    const isSuccessKeyword = lowerMsg.includes('sent') || lowerMsg.includes('success') || lowerMsg.includes('updated') || lowerMsg.includes('created');
    
    const inferredType = (type === 'success' && isErrorKeyword && !isSuccessKeyword) ? 'error' : type;
    
    setToast({ message, type: inferredType });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const ToastComponent = useCallback(() => {
    if (!toast) return null;
    return (
      <div className={`fixed top-20 right-4 sm:right-10 z-[999999] flex items-center gap-4 px-6 py-4 rounded-xl shadow-xl animate-in slide-in-from-right-full ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-primary-green text-white'}`}>
        {toast.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
        <span className="font-bold text-sm">{toast.message}</span>
      </div>
    );
  }, [toast]);

  return { showToast, ToastComponent };
};
