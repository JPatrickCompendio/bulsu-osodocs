import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { apiFetch } from '../config/api';
import { FileText, AlertCircle, Check, Info } from 'lucide-react';
import PageHeader from '../components/PageHeader';

import { SubmissionWindowsTab } from '../components/academic/SubmissionWindowsTab';
import { EventModal } from '../components/academic/EventModal';

const SubmissionWindowsPage = () => {
  const { user } = useAuth();
  const canEdit = user?.role === 'admin';

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const [schoolYears, setSchoolYears] = useState([]);
  const [academicEvents, setAcademicEvents] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [selectedSyId, setSelectedSyId] = useState('');

  // Modals
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventForm, setEventForm] = useState({
    id: null,
    school_year_id: '',
    semester_id: '',
    title: '',
    description: '',
    event_type: 'submission_window',
    document_type_id: '',
    start_date: '',
    end_date: '',
    blocks_activity: false,
    is_active: true,
  });

  const showMessage = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [syRes, evRes, dtRes] = await Promise.all([
        apiFetch('/api/school-years'),
        apiFetch('/api/academic-events'),
        supabase.from('documentType').select('*').order('name'),
      ]);

      const [syData, evData] = await Promise.all([syRes.json(), evRes.json()]);

      if (syData.success) {
        const sys = syData.data || [];
        setSchoolYears(sys);
        const activeSy = sys.find((s) => s.is_active) || sys[0];
        if (activeSy && !selectedSyId) {
          setSelectedSyId(activeSy.id);
        }
      }

      if (evData.success) setAcademicEvents(evData.data || []);
      setDocumentTypes(dtRes.data || []);
    } catch (err) {
      showMessage('Failed to fetch submission windows data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openEventModal = (ev = null, targetSyId = null) => {
    if (ev) {
      setEventForm({
        id: ev.id,
        school_year_id: ev.school_year_id || selectedSyId,
        semester_id: ev.semester_id || '',
        title: ev.title || '',
        description: ev.description || '',
        event_type: 'submission_window',
        document_type_id: ev.document_type_id || '',
        start_date: ev.start_date ? ev.start_date.split('T')[0] : '',
        end_date: ev.end_date ? ev.end_date.split('T')[0] : '',
        blocks_activity: false,
        is_active: ev.is_active !== undefined ? ev.is_active : true,
      });
    } else {
      setEventForm({
        id: null,
        school_year_id: targetSyId || selectedSyId || (schoolYears[0]?.id || ''),
        semester_id: '',
        title: '',
        description: '',
        event_type: 'submission_window',
        document_type_id: '',
        start_date: '',
        end_date: '',
        blocks_activity: false,
        is_active: true,
      });
    }
    setShowEventModal(true);
  };

  const saveEvent = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    try {
      if (!schoolYears || schoolYears.length === 0) {
        showMessage('Cannot configure submission windows because no School Year is set.', 'error');
        return;
      }

      const path = eventForm.id ? `/api/academic-events/${eventForm.id}` : '/api/academic-events';
      const method = eventForm.id ? 'PUT' : 'POST';

      const payload = { ...eventForm, created_by: user?.id || null, event_type: 'submission_window' };
      if (!payload.school_year_id) {
        const activeSyObj = schoolYears.find((sy) => sy.is_active) || schoolYears[0];
        if (activeSyObj) payload.school_year_id = activeSyObj.id;
      }

      const dt = documentTypes.find((d) => d.id === payload.document_type_id);
      if (dt) {
        payload.title = `${dt.name} Submission Window`;
      }

      if (!payload.start_date) payload.start_date = null;
      if (!payload.end_date) payload.end_date = null;
      payload.blocks_activity = false;

      const res = await apiFetch(path, {
        method,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        showMessage('Submission window saved successfully!');
        setShowEventModal(false);
        fetchData();
      } else {
        throw new Error(data.error || data.details || 'Failed to save submission window');
      }
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  const deleteEvent = async (id) => {
    if (!window.confirm('Are you sure you want to delete this submission window?')) return;
    try {
      const res = await apiFetch(`/api/academic-events/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showMessage('Submission window deleted!');
        fetchData();
      }
    } catch (err) {
      showMessage('Failed to delete submission window', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-32 relative">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-20 right-4 sm:right-10 z-[999999] px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 text-white font-extrabold text-xs tracking-wide ${
            toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-700'
          } animate-in slide-in-from-top-4`}
        >
          {toast.type === 'error' ? <AlertCircle size={20} /> : <Check size={20} />}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 border-b border-gray-100 pb-6">
        <PageHeader
          title="Submission Windows"
          subtitle="Configure document submission periods and deadlines for student organizations."
          icon={FileText}
          iconColor="amber"
        />
      </div>

      {!canEdit && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-2xl p-4 text-blue-800 flex items-center gap-3 text-xs font-bold shadow-2xs">
          <Info size={18} className="text-blue-600 shrink-0" />
          <span>
            You are viewing Submission Windows in <strong>Read-Only Mode</strong>. Only System Administrators can configure submission windows.
          </span>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl p-16 text-center text-gray-400 font-bold border border-gray-100">
          Loading Submission Windows...
        </div>
      ) : (
        <SubmissionWindowsTab
          schoolYears={schoolYears}
          events={academicEvents}
          documentTypes={documentTypes}
          selectedSyId={selectedSyId}
          onSelectSy={setSelectedSyId}
          canEdit={canEdit}
          onNewWindow={(targetSyId) => openEventModal(null, targetSyId)}
          onEditWindow={(win) => openEventModal(win)}
          onDeleteWindow={deleteEvent}
        />
      )}

      {/* MODAL */}
      <EventModal
        isOpen={showEventModal}
        onClose={() => setShowEventModal(false)}
        onSave={saveEvent}
        eventForm={eventForm}
        setEventForm={setEventForm}
        schoolYears={schoolYears}
        documentTypes={documentTypes}
      />
    </div>
  );
};

export default SubmissionWindowsPage;
