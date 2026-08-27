import os

file_path = r'c:\Users\User\OneDrive\Desktop\OSODOCS\bulsu-osodocs\frontend\src\pages\AcademicSettings.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Update saveSchoolYear with duplicate validation
old_save_sy = """  const saveSchoolYear = async (e) => {
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
  };"""

new_save_sy = """  const saveSchoolYear = async (e) => {
    e.preventDefault();
    try {
      let finalName = syForm.name.trim();
      if (!finalName.toLowerCase().startsWith('academic year')) {
        finalName = `Academic Year ${finalName}`;
      }

      // Check duplicates
      const dup = schoolYears.find(s => s.id !== syForm.id && (
        s.name.toLowerCase().trim() === finalName.toLowerCase() ||
        (s.start_date.split('T')[0] === syForm.start_date && s.end_date.split('T')[0] === syForm.end_date)
      ));

      if (dup) {
        if (dup.name.toLowerCase().trim() === finalName.toLowerCase()) {
          showMessage('A School Year with this title already exists.', 'error');
        } else {
          showMessage('A School Year with these exact start and end dates already exists.', 'error');
        }
        return;
      }

      const payload = { ...syForm, name: finalName };

      const path = syForm.id ? `/api/school-years/${syForm.id}` : '/api/school-years';
      const method = syForm.id ? 'PUT' : 'POST';

      const res = await apiFetch(path, {
        method,
        body: JSON.stringify(payload),
      });
      
      const data = await res.json();
      if (res.ok) {
        showMessage('School Year saved!');
        setShowSyModal(false);
        fetchData();
      } else {
        throw new Error(data.error || 'Failed to save school year');
      }
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };"""

if old_save_sy in content:
    content = content.replace(old_save_sy, new_save_sy)

# Update saveSemester with client-side date boundary check
old_save_sem = """  const saveSemester = async (e) => {
    e.preventDefault();
    try {
      const path = semForm.id ? `/api/semesters/${semForm.id}` : '/api/semesters';
      const method = semForm.id ? 'PUT' : 'POST';

      const res = await apiFetch(path, {
        method,
        body: JSON.stringify(semForm),
      });

      const data = await res.json();
      if (res.ok) {
        showMessage('Semester saved!');
        setShowSemModal(false);
        fetchData();
      } else {
        throw new Error(data.error || 'Failed to save semester');
      }
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };"""

new_save_sem = """  const saveSemester = async (e) => {
    e.preventDefault();
    try {
      const sy = schoolYears.find(s => s.id === semForm.school_year_id);
      if (sy) {
        const syStart = sy.start_date.split('T')[0];
        const syEnd = sy.end_date.split('T')[0];
        if (semForm.start_date < syStart) {
          showMessage(`Semester start date cannot precede School Year start date (${syStart}).`, 'error');
          return;
        }
        if (semForm.end_date > syEnd) {
          showMessage(`Semester end date cannot exceed School Year end date (${syEnd}).`, 'error');
          return;
        }
      }

      if (semForm.start_date > semForm.end_date) {
        showMessage('Semester start date cannot be after the end date.', 'error');
        return;
      }

      const path = semForm.id ? `/api/semesters/${semForm.id}` : '/api/semesters';
      const method = semForm.id ? 'PUT' : 'POST';

      const res = await apiFetch(path, {
        method,
        body: JSON.stringify(semForm),
      });

      const data = await res.json();
      if (res.ok) {
        showMessage('Semester saved!');
        setShowSemModal(false);
        fetchData();
      } else {
        throw new Error(data.error || 'Failed to save semester');
      }
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };"""

if old_save_sem in content:
    content = content.replace(old_save_sem, new_save_sem)

# Update saveEvent to auto-set title for submission_window
old_save_event = """  const saveEvent = async (e) => {
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
  };"""

new_save_event = """  const saveEvent = async (e) => {
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

if old_save_event in content:
    content = content.replace(old_save_event, new_save_event)

# Update School Year Modal Form UI
old_sy_modal = """            <form onSubmit={saveSchoolYear} className="space-y-4">
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
              </div>"""

new_sy_modal = """            <form onSubmit={saveSchoolYear} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
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
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">School Year</label>
                <div className="flex items-center gap-2 mt-1">
                  <span className="bg-gray-100 text-gray-600 font-bold px-3 py-2 rounded-lg text-xs shrink-0 border border-gray-200">Academic Year</span>
                  <input 
                    required 
                    type="text" 
                    placeholder="e.g. 2026-2027" 
                    className="w-full p-2 border rounded-lg outline-none focus:border-primary-green font-bold text-gray-800" 
                    value={syForm.name.replace(/^Academic Year\s*/i, '')} 
                    onChange={e => setSyForm({...syForm, name: e.target.value})} 
                  />
                </div>
              </div>"""

if old_sy_modal in content:
    content = content.replace(old_sy_modal, new_sy_modal)

# Update Calendar Event Title Form UI for submission_window
old_event_title_ui = """              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Event Title</label>
                <input required type="text" className="w-full mt-1 p-2 border rounded-lg outline-none focus:border-primary-green" value={eventForm.title} onChange={e => setEventForm({...eventForm, title: e.target.value})} />
              </div>"""

new_event_title_ui = """              {eventForm.event_type === 'submission_window' ? (
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

if old_event_title_ui in content:
    content = content.replace(old_event_title_ui, new_event_title_ui)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Updated AcademicSettings.jsx via update_settings_v2.py!')
