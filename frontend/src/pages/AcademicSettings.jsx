import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../config/api';
import { Calendar, Settings, Plus, Check, X, Edit, Trash2, CalendarDays, BookOpen, Clock, AlertCircle } from 'lucide-react';
import PageHeader from '../components/PageHeader';

const AcademicSettings = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('school-years');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Data state
  const [schoolYears, setSchoolYears] = useState([]);
  const [academicEvents, setAcademicEvents] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([]);

  // Modals state
  const [showSyModal, setShowSyModal] = useState(false);
  const [syForm, setSyForm] = useState({ id: null, name: '', start_date: '', end_date: '', is_active: false });

  const [showEventModal, setShowEventModal] = useState(false);
  const [eventForm, setEventForm] = useState({
    id: null, school_year_id: '', title: '', description: '', event_type: 'blocked_activity',
    document_type_id: '', start_date: '', end_date: '', is_active: true
  });

  const eventTypes = [
    { value: 'blocked_activity', label: 'Blocked Activity' },
    { value: 'submission_window', label: 'Submission Window' },
    { value: 'holiday', label: 'Holiday' },
    { value: 'exam_week', label: 'Exam Week' },
    { value: 'enrollment', label: 'Enrollment' },
    { value: 'announcement', label: 'Announcement' }
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const showMessage = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const syRes = await apiFetch('/api/school-years');
      const evRes = await apiFetch('/api/academic-events');
      
      const { data: dtRes } = await supabase.from('documentType').select('*').order('name');
      setDocumentTypes(dtRes || []);

      const syData = await syRes.json();
      const evData = await evRes.json();

      if (syData.success) setSchoolYears(syData.data);
      if (evData.success) setAcademicEvents(evData.data);
    } catch (err) {
      showMessage('Failed to fetch data', 'error');
    } finally {
      setLoading(false);
    }
  };

  // --- SCHOOL YEAR HANDLERS ---
  const saveSchoolYear = async (e) => {
    e.preventDefault();
    try {
      const path = syForm.id ? `/api/school-years/${syForm.id}` : '/api/school-years';
      const method = syForm.id ? 'PUT' : 'POST';

      const res = await apiFetch(path, {
        method,
        body: JSON.stringify(syForm),
      });
      
      if (res.ok) {
        showMessage('School Year saved!');
        setShowSyModal(false);
        fetchData();
      } else {
        throw new Error('Failed to save');
      }
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  const activateSchoolYear = async (id) => {
    try {
      const res = await apiFetch(`/api/school-years/${id}/activate`, { method: 'PUT' });
      if (res.ok) {
        showMessage('School Year activated!');
        fetchData();
      }
    } catch (err) {
      showMessage('Failed to activate', 'error');
    }
  };

  const deleteSchoolYear = async (id) => {
    if (!window.confirm('Are you sure you want to delete this School Year?')) return;
    try {
      const res = await apiFetch(`/api/school-years/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        showMessage('School Year deleted!');
        fetchData();
      } else {
        throw new Error(data.error || 'Failed to delete');
      }
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  // --- ACADEMIC CALENDAR EVENT HANDLERS ---
  const saveEvent = async (e) => {
    e.preventDefault();
    try {
      const path = eventForm.id ? `/api/academic-events/${eventForm.id}` : '/api/academic-events';
      const method = eventForm.id ? 'PUT' : 'POST';

      // if Always Available is selected via UI logic (which we'll handle by nulling out dates)
      const payload = { ...eventForm, created_by: user?.id };
      if (!payload.start_date) payload.start_date = null;
      if (!payload.end_date) payload.end_date = null;
      if (payload.event_type !== 'submission_window') payload.document_type_id = null;
      if (payload.blocks_activity) payload.description = 'BLOCKS_ACTIVITY';
      else if (payload.description === 'BLOCKS_ACTIVITY') payload.description = '';

      const res = await apiFetch(path, {
        method,
        body: JSON.stringify(payload),
      });
      
      if (res.ok) {
        showMessage('Event saved!');
        setShowEventModal(false);
        fetchData();
      } else {
        throw new Error('Failed to save event');
      }
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  const deleteEvent = async (id) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;
    try {
      const res = await apiFetch(`/api/academic-events/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showMessage('Event deleted!');
        fetchData();
      }
    } catch (err) {
      showMessage('Failed to delete event', 'error');
    }
  };

  const openEventModal = (ev = null) => {
    if (ev) {
      setEventForm({
        ...ev,
        blocks_activity: ev.event_type === 'blocked_activity' || ev.description === 'BLOCKS_ACTIVITY',
        start_date: ev.start_date ? ev.start_date.split('T')[0] : '',
        end_date: ev.end_date ? ev.end_date.split('T')[0] : '',
        document_type_id: ev.document_type_id || ''
      });
    } else {
      const activeSy = schoolYears.find(s => s.is_active);
      setEventForm({
        id: null, school_year_id: activeSy ? activeSy.id : '', title: '', description: '',
        blocks_activity: false,
        event_type: 'blocked_activity', document_type_id: '', start_date: '', end_date: '', is_active: true
      });
    }
    setShowEventModal(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-32 relative">
      {toast && (
        <div className={`fixed top-10 right-10 z-[200] px-6 py-4 rounded-xl shadow-xl flex items-center gap-3 text-white font-bold ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'} animate-in slide-in-from-right`}>
          {toast.type === 'error' ? <AlertCircle size={20} /> : <Check size={20} />}
          {toast.msg}
        </div>
      )}

      <div className="flex items-end justify-between mb-8 border-b border-gray-100 pb-6">
        <PageHeader 
          title="Academic Settings" 
          subtitle="Manage School Years, Calendar Events, and Document Schedules" 
          icon={Calendar} 
          iconColor="pink" 
        />
      </div>

      <div className="flex gap-4 border-b border-gray-200 mb-8">
        <button 
          className={`pb-4 px-4 font-bold transition-all border-b-2 flex items-center gap-2 ${activeTab === 'school-years' ? 'border-primary-green text-primary-green' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('school-years')}
        >
          <BookOpen size={18} /> School Years
        </button>
        <button 
          className={`pb-4 px-4 font-bold transition-all border-b-2 flex items-center gap-2 ${activeTab === 'academic-events' ? 'border-primary-green text-primary-green' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('academic-events')}
        >
          <CalendarDays size={18} /> Calendar Events
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-500 font-bold">Loading...</div>
      ) : (
        <>
          {/* SCHOOL YEARS TAB */}
          {activeTab === 'school-years' && (
            <div className="space-y-6">
              <div className="flex justify-end">
                <button 
                  onClick={() => {
                    setSyForm({ id: null, name: '', start_date: '', end_date: '', is_active: false });
                    setShowSyModal(true);
                  }}
                  className="bg-primary-green text-white px-5 py-2.5 rounded-lg font-bold flex items-center gap-2 hover:bg-green-700 shadow-sm"
                >
                  <Plus size={18} /> New School Year
                </button>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-100 uppercase tracking-wider text-xs">
                    <tr>
                      <th className="p-4">Name</th>
                      <th className="p-4">Duration</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schoolYears.map(sy => (
                      <tr key={sy.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="p-4 font-bold text-gray-800">{sy.name}</td>
                        <td className="p-4 text-gray-500">{new Date(sy.start_date).toLocaleDateString()} - {new Date(sy.end_date).toLocaleDateString()}</td>
                        <td className="p-4">
                          {sy.is_active ? (
                            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold uppercase">Active</span>
                          ) : (
                            <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-xs font-bold uppercase">Inactive</span>
                          )}
                        </td>
                        <td className="p-4 text-right flex justify-end gap-2">
                          {!sy.is_active && (
                            <button onClick={() => activateSchoolYear(sy.id)} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100">Activate</button>
                          )}
                          <button onClick={() => { setSyForm(sy); setShowSyModal(true); }} className="p-1.5 text-gray-400 hover:text-primary-green hover:bg-green-50 rounded-lg"><Edit size={16} /></button>
                          <button onClick={() => deleteSchoolYear(sy.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    ))}
                    {schoolYears.length === 0 && (
                      <tr><td colSpan="4" className="text-center p-8 text-gray-400 font-medium">No school years configured.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ACADEMIC EVENTS TAB */}
          {activeTab === 'academic-events' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center bg-blue-50 p-4 rounded-xl border border-blue-100">
                <div className="flex items-start gap-3">
                  <AlertCircle className="text-blue-500 mt-0.5 shrink-0" size={20} />
                  <div>
                    <h4 className="font-bold text-blue-800">Activity Blocks & Calendar Events</h4>
                    <p className="text-sm text-blue-600 mt-1">Configure blocked dates for Activity Proposals across the active school year.</p>
                  </div>
                </div>
                <button 
                  onClick={() => openEventModal()}
                  className="bg-primary-green text-white px-5 py-2.5 rounded-lg font-bold flex items-center gap-2 hover:bg-green-700 shadow-sm shrink-0"
                >
                  <Plus size={18} /> Add Event
                </button>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-100 uppercase tracking-wider text-xs">
                    <tr>
                      <th className="p-4">Event Title</th>
                      <th className="p-4">Event Type</th>
                      <th className="p-4">School Year</th>
                      <th className="p-4">Duration</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {academicEvents.map(ev => {
                      const sy = schoolYears.find(s => s.id === ev.school_year_id);
                      return (
                        <tr key={ev.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="p-4 font-bold text-gray-800">{ev.title}</td>
                          <td className="p-4">
                            <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-bold">{eventTypes.find(t => t.value === ev.event_type)?.label || ev.event_type}</span>
                          </td>
                          <td className="p-4 text-gray-500 font-medium">{sy ? sy.name : 'N/A'}</td>
                          <td className="p-4 text-gray-500 font-medium">
                            {ev.start_date && ev.end_date ? (
                              <>{new Date(ev.start_date).toLocaleDateString()} - {new Date(ev.end_date).toLocaleDateString()}</>
                            ) : (
                              <span className="italic">Always Available</span>
                            )}
                          </td>
                          <td className="p-4 text-right flex justify-end gap-2">
                            <button onClick={() => openEventModal(ev)} className="p-1.5 text-gray-400 hover:text-primary-green hover:bg-green-50 rounded-lg"><Edit size={16} /></button>
                            <button onClick={() => deleteEvent(ev.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                          </td>
                        </tr>
                      );
                    })}
                    {academicEvents.length === 0 && (
                      <tr><td colSpan="5" className="text-center p-8 text-gray-400 font-medium">No calendar events configured.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* MODALS */}
      {showSyModal && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-xl font-bold mb-4">{syForm.id ? 'Edit' : 'Create'} School Year</h3>
            <form onSubmit={saveSchoolYear} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Name (e.g., 2025-2026)</label>
                <input required type="text" className="w-full mt-1 p-2 border rounded-lg outline-none focus:border-primary-green" value={syForm.name} onChange={e => setSyForm({...syForm, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Start Date</label>
                  <input required type="date" className="w-full mt-1 p-2 border rounded-lg outline-none focus:border-primary-green" value={syForm.start_date} onChange={e => setSyForm({...syForm, start_date: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">End Date</label>
                  <input required type="date" className="w-full mt-1 p-2 border rounded-lg outline-none focus:border-primary-green" value={syForm.end_date} onChange={e => setSyForm({...syForm, end_date: e.target.value})} />
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowSyModal(false)} className="px-4 py-2 text-gray-500 font-bold hover:bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary-green text-white font-bold rounded-lg hover:bg-green-700">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEventModal && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl">
            <h3 className="text-xl font-bold mb-4">{eventForm.id ? 'Edit' : 'Create'} Calendar Event</h3>
            <form onSubmit={saveEvent} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">School Year</label>
                <select required className="w-full mt-1 p-2 border rounded-lg outline-none focus:border-primary-green bg-white" value={eventForm.school_year_id} onChange={e => setEventForm({...eventForm, school_year_id: e.target.value})}>
                  <option value="">Select School Year...</option>
                  {schoolYears.map(sy => <option key={sy.id} value={sy.id}>{sy.name}</option>)}
                </select>
                {eventForm.event_type === 'submission_window' && eventForm.school_year_id && (() => {
                  const selectedSy = schoolYears.find(sy => sy.id === eventForm.school_year_id);
                  const isEntireSy = selectedSy && eventForm.start_date === selectedSy.start_date.split('T')[0] && eventForm.end_date === selectedSy.end_date.split('T')[0];
                  return (
                    <div className="flex items-center gap-2 mt-3 p-2 bg-green-50/50 border border-green-100 rounded-lg">
                      <input
                        type="checkbox"
                        id="entireSyCheckbox"
                        className="w-4 h-4 text-primary-green rounded focus:ring-primary-green cursor-pointer"
                        checked={!!isEntireSy}
                        onChange={(e) => {
                          if (e.target.checked && selectedSy) {
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
                      />
                      <label htmlFor="entireSyCheckbox" className="text-sm font-bold text-green-800 cursor-pointer select-none">
                        Entire School Year
                      </label>
                    </div>
                  );
                })()}
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Event Title</label>
                <input required type="text" className="w-full mt-1 p-2 border rounded-lg outline-none focus:border-primary-green" value={eventForm.title} onChange={e => setEventForm({...eventForm, title: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Event Type</label>
                  <select required className="w-full mt-1 p-2 border rounded-lg outline-none focus:border-primary-green bg-white" value={eventForm.event_type} onChange={e => {
                    const newType = e.target.value;
                    setEventForm({...eventForm, event_type: newType, blocks_activity: newType === 'blocked_activity' || eventForm.blocks_activity})
                  }}>
                    {eventTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                {eventForm.event_type === 'submission_window' && (
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">Document Type</label>
                    <select required className="w-full mt-1 p-2 border rounded-lg outline-none focus:border-primary-green bg-white" value={eventForm.document_type_id} onChange={e => setEventForm({...eventForm, document_type_id: e.target.value})}>
                      <option value="">Select Document...</option>
                      {documentTypes.map(dt => <option key={dt.id} value={dt.id}>{dt.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
              
              <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/50 mt-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-bold text-gray-500 uppercase">Schedule</label>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  {(() => {
                    const selectedSy = schoolYears.find(sy => sy.id === eventForm.school_year_id);
                    const isEntireSy = eventForm.event_type === 'submission_window' && selectedSy && eventForm.start_date === selectedSy.start_date.split('T')[0] && eventForm.end_date === selectedSy.end_date.split('T')[0];
                    return (
                      <>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase">Start Date</label>
                          <input type="date" className={`w-full mt-1 p-2 border rounded-lg outline-none focus:border-primary-green ${isEntireSy ? 'bg-gray-100 text-gray-500 cursor-not-allowed border-gray-200' : 'bg-white'}`} value={eventForm.start_date || ''} onChange={e => setEventForm({...eventForm, start_date: e.target.value})} required disabled={isEntireSy} />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase">End Date</label>
                          <input type="date" className={`w-full mt-1 p-2 border rounded-lg outline-none focus:border-primary-green ${isEntireSy ? 'bg-gray-100 text-gray-500 cursor-not-allowed border-gray-200' : 'bg-white'}`} value={eventForm.end_date || ''} onChange={e => setEventForm({...eventForm, end_date: e.target.value})} required disabled={isEntireSy} />
                        </div>
                      </>
                    );
                  })()}
                </div>

                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                  <input
                    type="checkbox"
                    id="blocksActivity"
                    className="w-4 h-4 text-primary-green rounded focus:ring-primary-green"
                    checked={eventForm.blocks_activity || eventForm.event_type === 'blocked_activity'}
                    disabled={eventForm.event_type === 'blocked_activity'}
                    onChange={e => setEventForm({...eventForm, blocks_activity: e.target.checked})}
                  />
                  <label htmlFor="blocksActivity" className="text-sm font-bold text-gray-700 cursor-pointer">
                    Block Activity Proposals on these dates
                  </label>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowEventModal(false)} className="px-4 py-2 text-gray-500 font-bold hover:bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary-green text-white font-bold rounded-lg hover:bg-green-700">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AcademicSettings;
