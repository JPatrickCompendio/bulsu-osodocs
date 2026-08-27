import os

file_path = r'c:\Users\User\OneDrive\Desktop\OSODOCS\bulsu-osodocs\frontend\src\pages\AcademicSettings.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update SY auto-name logic to handle same start & end year (e.g. 2026-2026 -> Academic Year 2026)
old_sy_modal_code = """              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Start Date</label>
                  <input required type="date" className="w-full mt-1 p-2 border rounded-lg outline-none focus:border-primary-green bg-white" value={syForm.start_date} onChange={e => {
                    const newStart = e.target.value;
                    const startYr = newStart ? new Date(newStart).getFullYear() : '';
                    const endYr = syForm.end_date ? new Date(syForm.end_date).getFullYear() : (startYr ? startYr + 1 : '');
                    const autoName = (startYr && endYr) ? `${startYr}-${endYr}` : syForm.name;
                    setSyForm({ ...syForm, start_date: newStart, name: autoName });
                  }} />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">End Date</label>
                  <input required type="date" className="w-full mt-1 p-2 border rounded-lg outline-none focus:border-primary-green bg-white" value={syForm.end_date} onChange={e => {
                    const newEnd = e.target.value;
                    const endYr = newEnd ? new Date(newEnd).getFullYear() : '';
                    const startYr = syForm.start_date ? new Date(syForm.start_date).getFullYear() : (endYr ? endYr - 1 : '');
                    const autoName = (startYr && endYr) ? `${startYr}-${endYr}` : syForm.name;
                    setSyForm({ ...syForm, end_date: newEnd, name: autoName });
                  }} />
                </div>
              </div>"""

new_sy_modal_code = """              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Start Date</label>
                  <input required type="date" className="w-full mt-1 p-2 border rounded-lg outline-none focus:border-primary-green bg-white" value={syForm.start_date} onChange={e => {
                    const newStart = e.target.value;
                    const startYr = newStart ? new Date(newStart).getFullYear() : '';
                    const endYr = syForm.end_date ? new Date(syForm.end_date).getFullYear() : (startYr ? startYr + 1 : '');
                    const autoName = (startYr && endYr) ? (startYr === endYr ? `${startYr}` : `${startYr}-${endYr}`) : syForm.name;
                    setSyForm({ ...syForm, start_date: newStart, name: autoName });
                  }} />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">End Date</label>
                  <input required type="date" className="w-full mt-1 p-2 border rounded-lg outline-none focus:border-primary-green bg-white" value={syForm.end_date} onChange={e => {
                    const newEnd = e.target.value;
                    const endYr = newEnd ? new Date(newEnd).getFullYear() : '';
                    const startYr = syForm.start_date ? new Date(syForm.start_date).getFullYear() : (endYr ? endYr - 1 : '');
                    const autoName = (startYr && endYr) ? (startYr === endYr ? `${startYr}` : `${startYr}-${endYr}`) : syForm.name;
                    setSyForm({ ...syForm, end_date: newEnd, name: autoName });
                  }} />
                </div>
              </div>"""

if old_sy_modal_code in content:
    content = content.replace(old_sy_modal_code, new_sy_modal_code)

# 2. Update saveSchoolYear for 2026-2026 check
old_save_sy_name = """      let finalName = syForm.name.trim();
      if (!finalName.toLowerCase().startsWith('academic year')) {
        finalName = `Academic Year ${finalName}`;
      }"""

new_save_sy_name = """      let finalName = syForm.name.trim();
      const startYr = syForm.start_date ? new Date(syForm.start_date).getFullYear() : '';
      const endYr = syForm.end_date ? new Date(syForm.end_date).getFullYear() : '';
      if (startYr && endYr && startYr === endYr) {
        finalName = finalName.replace(/\d{4}-\d{4}/, `${startYr}`);
      }
      if (!finalName.toLowerCase().startsWith('academic year')) {
        finalName = `Academic Year ${finalName}`;
      }"""

if old_save_sy_name in content:
    content = content.replace(old_save_sy_name, new_save_sy_name)

# 3. Update saveEvent to validate active SY and active semester before saving
old_save_event = """  const saveEvent = async (e) => {
    e.preventDefault();
    try {
      const path = eventForm.id ? `/api/academic-events/${eventForm.id}` : '/api/academic-events';
      const method = eventForm.id ? 'PUT' : 'POST';

      const payload = { ...eventForm, created_by: user?.id };
      if (payload.event_type === 'submission_window') {
        const dt = documentTypes.find(d => d.id === payload.document_type_id);
        if (dt) {
          payload.title = `${dt.name} Submission Window`;
        }
      }

      if (!payload.start_date) payload.start_date = null;
      if (!payload.end_date) payload.end_date = null;
      if (payload.event_type !== 'submission_window') payload.document_type_id = null;
      if (payload.blocks_activity) payload.description = 'BLOCKS_ACTIVITY';
      else if (payload.description === 'BLOCKS_ACTIVITY') payload.description = '';

      const res = await apiFetch(path, {
        method,
        body: JSON.stringify(payload),
      });
      
      const data = await res.json();
      if (res.ok) {
        showMessage('Event saved!');
        setShowEventModal(false);
        fetchData();
      } else {
        throw new Error(data.error || 'Failed to save event');
      }
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };"""

new_save_event = """  const saveEvent = async (e) => {
    e.preventDefault();
    try {
      const activeSyExists = schoolYears.some(sy => sy.is_active);
      const activeSemExists = semesters.some(sem => sem.is_active);
      if (!activeSyExists || !activeSemExists) {
        showMessage('Cannot create or save calendar events because there is no active School Year or active Semester configured.', 'error');
        return;
      }

      const path = eventForm.id ? `/api/academic-events/${eventForm.id}` : '/api/academic-events';
      const method = eventForm.id ? 'PUT' : 'POST';

      const payload = { ...eventForm, created_by: user?.id || null };
      if (!payload.school_year_id) {
        const activeSyObj = schoolYears.find(sy => sy.is_active) || schoolYears[0];
        if (activeSyObj) payload.school_year_id = activeSyObj.id;
      }

      if (payload.event_type === 'submission_window') {
        const dt = documentTypes.find(d => d.id === payload.document_type_id);
        if (dt) {
          payload.title = `${dt.name} Submission Window`;
        }
      }

      if (!payload.start_date) payload.start_date = null;
      if (!payload.end_date) payload.end_date = null;
      if (payload.event_type !== 'submission_window') payload.document_type_id = null;
      if (payload.blocks_activity) payload.description = 'BLOCKS_ACTIVITY';
      else if (payload.description === 'BLOCKS_ACTIVITY') payload.description = '';

      const res = await apiFetch(path, {
        method,
        body: JSON.stringify(payload),
      });
      
      const data = await res.json();
      if (res.ok) {
        showMessage('Event saved!');
        setShowEventModal(false);
        fetchData();
      } else {
        throw new Error(data.error || 'Failed to save event');
      }
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };"""

if old_save_event in content:
    content = content.replace(old_save_event, new_save_event)

# 4. Re-order Event Modal UI so Event Type is asked FIRST before Event Title
old_event_modal_ui = """              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">School Year</label>
                <select required className="w-full mt-1 p-2 border rounded-lg outline-none focus:border-primary-green bg-white" value={eventForm.school_year_id} onChange={e => setEventForm({...eventForm, school_year_id: e.target.value})}>
                  <option value="">Select School Year...</option>
                  {schoolYears.map(sy => <option key={sy.id} value={sy.id}>{sy.name}</option>)}
                </select>
              </div>
              {eventForm.event_type === 'submission_window' ? (
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Event Title</label>
                  <input 
                    type="text" 
                    disabled 
                    className="w-full mt-1 p-2 border rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed font-medium italic text-xs" 
                    value={(() => {
                      const dt = documentTypes.find(d => d.id === eventForm.document_type_id);
                      return dt ? `${dt.name} Submission Window` : 'Auto-generated based on Document Type';
                    })()} 
                  />
                </div>
              ) : (
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Event Title</label>
                  <input required type="text" className="w-full mt-1 p-2 border rounded-lg outline-none focus:border-primary-green" value={eventForm.title} onChange={e => setEventForm({...eventForm, title: e.target.value})} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Event Type</label>
                  <select required className="w-full mt-1 p-2 border rounded-lg outline-none focus:border-primary-green bg-white" value={eventForm.event_type} onChange={e => {
                    const newType = e.target.value;
                    setEventForm({...eventForm, event_type: newType, blocks_activity: (newType === 'school_event' && eventForm.blocks_activity) || eventForm.blocks_activity})
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
              </div>"""

new_event_modal_ui = """              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">School Year</label>
                <select required className="w-full mt-1 p-2 border rounded-lg outline-none focus:border-primary-green bg-white" value={eventForm.school_year_id} onChange={e => setEventForm({...eventForm, school_year_id: e.target.value})}>
                  <option value="">Select School Year...</option>
                  {schoolYears.map(sy => <option key={sy.id} value={sy.id}>{sy.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Event Type</label>
                  <select required className="w-full mt-1 p-2 border rounded-lg outline-none focus:border-primary-green bg-white" value={eventForm.event_type} onChange={e => {
                    const newType = e.target.value;
                    setEventForm({...eventForm, event_type: newType, blocks_activity: (newType === 'school_event' && eventForm.blocks_activity) || eventForm.blocks_activity})
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
              {eventForm.event_type === 'submission_window' ? (
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Event Title</label>
                  <input 
                    type="text" 
                    disabled 
                    className="w-full mt-1 p-2 border rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed font-medium italic text-xs" 
                    value={(() => {
                      const dt = documentTypes.find(d => d.id === eventForm.document_type_id);
                      return dt ? `${dt.name} Submission Window` : 'Auto-generated based on Document Type';
                    })()} 
                  />
                </div>
              ) : (
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Event Title</label>
                  <input required type="text" className="w-full mt-1 p-2 border rounded-lg outline-none focus:border-primary-green" value={eventForm.title} onChange={e => setEventForm({...eventForm, title: e.target.value})} />
                </div>
              )}"""

if old_event_modal_ui in content:
    content = content.replace(old_event_modal_ui, new_event_modal_ui)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Updated AcademicSettings.jsx via update_settings_v3.py!')
