import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../config/api';
import { CalendarDays, AlertCircle, Check, Info } from 'lucide-react';
import PageHeader from '../components/PageHeader';

import { CalendarTab } from '../components/academic/CalendarTab';
import { EventModal } from '../components/academic/EventModal';
import { fetchApprovedActivitySchedules } from '../utils/activityScheduleFetcher';

const AcademicEventsPage = () => {
  const { user } = useAuth();
  const canEdit = user?.role === 'admin';

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const [schoolYears, setSchoolYears] = useState([]);
  const [academicEvents, setAcademicEvents] = useState([]);
  const [selectedSyId, setSelectedSyId] = useState('');
  const [approvedActivities, setApprovedActivities] = useState([]);

  // Modals
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventForm, setEventForm] = useState({
    id: null,
    school_year_id: '',
    semester_id: '',
    title: '',
    description: '',
    event_type: 'school_event',
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
      const [syRes, evRes] = await Promise.all([
        apiFetch('/api/school-years'),
        apiFetch('/api/academic-events'),
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
    } catch (err) {
      showMessage('Failed to fetch events data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedSyId) {
      loadApprovedActivities(selectedSyId);
    }
  }, [selectedSyId]);

  const loadApprovedActivities = async (syId) => {
    try {
      const acts = await fetchApprovedActivitySchedules(syId);
      setApprovedActivities(acts || []);
    } catch (err) {
      console.error('Failed to load approved activity schedules:', err);
    }
  };

  const openEventModal = (ev = null, type = 'school_event', targetSyId = null) => {
    if (ev) {
      const isBlocked = ev.event_type === 'blocked_activity' || ev.description === 'BLOCKS_ACTIVITY';
      setEventForm({
        id: ev.id,
        school_year_id: ev.school_year_id || selectedSyId,
        semester_id: ev.semester_id || '',
        title: ev.title || '',
        description: ev.description === 'BLOCKS_ACTIVITY' ? '' : ev.description || '',
        event_type: ev.event_type === 'blocked_activity' ? 'school_event' : ev.event_type,
        document_type_id: ev.document_type_id || '',
        start_date: ev.start_date ? ev.start_date.split('T')[0] : '',
        end_date: ev.end_date ? ev.end_date.split('T')[0] : '',
        blocks_activity: isBlocked,
        is_active: ev.is_active !== undefined ? ev.is_active : true,
      });
    } else {
      setEventForm({
        id: null,
        school_year_id: targetSyId || selectedSyId || (schoolYears[0]?.id || ''),
        semester_id: '',
        title: '',
        description: '',
        event_type: type,
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
        showMessage('Cannot create calendar events because no School Year is configured.', 'error');
        return;
      }

      const path = eventForm.id ? `/api/academic-events/${eventForm.id}` : '/api/academic-events';
      const method = eventForm.id ? 'PUT' : 'POST';

      const payload = { ...eventForm, created_by: user?.id || null };
      if (!payload.school_year_id) {
        const activeSyObj = schoolYears.find((sy) => sy.is_active) || schoolYears[0];
        if (activeSyObj) payload.school_year_id = activeSyObj.id;
      }

      if (payload.event_type === 'school_event') {
        if (payload.blocks_activity) {
          payload.event_type = 'blocked_activity';
        } else {
          payload.event_type = 'announcement';
        }
      }

      if (!payload.start_date) payload.start_date = null;
      if (!payload.end_date) payload.end_date = null;
      payload.document_type_id = null;
      if (payload.blocks_activity) payload.description = 'BLOCKS_ACTIVITY';
      else if (payload.description === 'BLOCKS_ACTIVITY') payload.description = '';

      const res = await apiFetch(path, {
        method,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        showMessage('Event saved successfully!');
        setShowEventModal(false);
        fetchData();
        if (selectedSyId) loadApprovedActivities(selectedSyId);
      } else {
        throw new Error(data.error || data.details || 'Failed to save event');
      }
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  const toggleEventBlock = async (ev) => {
    try {
      const isCurrentlyBlocked =
        ev.event_type === 'blocked_activity' || ev.blocks_activity || ev.description === 'BLOCKS_ACTIVITY';
      const updatedType = isCurrentlyBlocked ? 'announcement' : 'blocked_activity';
      const updatedDesc = isCurrentlyBlocked ? '' : 'BLOCKS_ACTIVITY';

      const res = await apiFetch(`/api/academic-events/${ev.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...ev,
          event_type: updatedType,
          description: updatedDesc,
        }),
      });

      if (res.ok) {
        showMessage(`Proposal blocking ${isCurrentlyBlocked ? 'disabled' : 'enabled'} for "${ev.title}".`);
        fetchData();
      }
    } catch (err) {
      showMessage('Failed to toggle blocking', 'error');
    }
  };

  const deleteEvent = async (id) => {
    if (!window.confirm('Are you sure you want to delete this calendar event?')) return;
    try {
      const res = await apiFetch(`/api/academic-events/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showMessage('Calendar event deleted!');
        fetchData();
      }
    } catch (err) {
      showMessage('Failed to delete event', 'error');
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
          title="Academic Events & Blocked Dates"
          subtitle="Configure academic calendar events, holidays, and blocked activity dates."
          icon={CalendarDays}
          iconColor="blue"
        />
      </div>

      {!canEdit && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-2xl p-4 text-blue-800 flex items-center gap-3 text-xs font-bold shadow-2xs">
          <Info size={18} className="text-blue-600 shrink-0" />
          <span>
            You are viewing Events in <strong>Read-Only Mode</strong>. Only System Administrators can configure academic calendar events.
          </span>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl p-16 text-center text-gray-400 font-bold border border-gray-100">
          Loading Academic Events...
        </div>
      ) : (
        <CalendarTab
          schoolYears={schoolYears}
          events={academicEvents}
          approvedActivities={approvedActivities}
          selectedSyId={selectedSyId}
          onSelectSy={setSelectedSyId}
          canEdit={canEdit}
          onNewEvent={(targetSyId) => openEventModal(null, 'school_event', targetSyId)}
          onEditEvent={(ev) => openEventModal(ev)}
          onDeleteEvent={deleteEvent}
          onToggleBlock={toggleEventBlock}
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
        documentTypes={[]}
      />
    </div>
  );
};

export default AcademicEventsPage;
