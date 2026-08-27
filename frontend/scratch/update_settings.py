import os

file_path = r'c:\Users\User\OneDrive\Desktop\OSODOCS\bulsu-osodocs\frontend\src\pages\AcademicSettings.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add states
state_marker = "const [documentTypes, setDocumentTypes] = useState([]);"
new_states = """const [documentTypes, setDocumentTypes] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [showSemModal, setShowSemModal] = useState(false);
  const [semForm, setSemForm] = useState({ id: null, school_year_id: '', name: '', start_date: '', end_date: '', is_active: false });
  const [warningModal, setWarningModal] = useState({ show: false, message: '', semId: null });"""

content = content.replace(state_marker, new_states)

# Update fetchData
fetch_marker = "const syData = await syRes.json();"
new_fetch = """const semRes = await apiFetch('/api/semesters?includeArchived=true');
      const semData = await semRes.json();
      if (semData.success) setSemesters(semData.data);

      const syData = await syRes.json();"""

content = content.replace(fetch_marker, new_fetch)

# Add Semester Handlers
event_handler_marker = "// --- ACADEMIC CALENDAR EVENT HANDLERS ---"
semester_handlers = """// --- SEMESTER HANDLERS ---
  const saveSemester = async (e) => {
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
  };

  const activateSemester = async (id) => {
    try {
      const res = await apiFetch(`/api/semesters/${id}/activate`, { method: 'PUT' });
      const data = await res.json();
      if (res.ok) {
        if (data.warning) {
          setWarningModal({ show: true, message: data.warning, semId: id });
        } else {
          showMessage('Semester activated!');
        }
        fetchData();
      } else {
        throw new Error(data.error || 'Failed to activate semester');
      }
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  const archiveSemester = async (id) => {
    if (!window.confirm('Are you sure you want to archive this Semester?')) return;
    try {
      const res = await apiFetch(`/api/semesters/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        showMessage('Semester archived!');
        fetchData();
      } else {
        throw new Error(data.error || 'Failed to archive semester');
      }
    } catch (err) {
      showMessage(err.message, 'error');
    }
  };

  """ + event_handler_marker

content = content.replace(event_handler_marker, semester_handlers)

# Update eventForm state in openEventModal
event_form_marker = "id: null, school_year_id: '', title: '', description: '', event_type: 'school_event',"
new_event_form = "id: null, school_year_id: '', semester_id: '', title: '', description: '', event_type: 'school_event',"
content = content.replace(event_form_marker, new_event_form)

# Add Semesters Tab Button
tab_marker = """<button 
          className={`pb-4 px-4 font-bold transition-all border-b-2 flex items-center gap-2 ${activeTab === 'school-years' ? 'border-primary-green text-primary-green' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('school-years')}
        >
          <BookOpen size={18} /> School Years
        </button>"""

new_tabs = """<button 
          className={`pb-4 px-4 font-bold transition-all border-b-2 flex items-center gap-2 ${activeTab === 'school-years' ? 'border-primary-green text-primary-green' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('school-years')}
        >
          <BookOpen size={18} /> School Years
        </button>
        <button 
          className={`pb-4 px-4 font-bold transition-all border-b-2 flex items-center gap-2 ${activeTab === 'semesters' ? 'border-primary-green text-primary-green' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          onClick={() => setActiveTab('semesters')}
        >
          <Clock size={18} /> Semesters
        </button>"""

content = content.replace(tab_marker, new_tabs)

# Add Semesters Tab Content
sem_tab_content = """{/* SEMESTERS TAB */}
          {activeTab === 'semesters' && (
            <div className="space-y-6">
              <div className="flex justify-end">
                <button 
                  onClick={() => {
                    const activeSy = schoolYears.find(s => s.is_active);
                    setSemForm({ id: null, school_year_id: activeSy ? activeSy.id : '', name: '', start_date: '', end_date: '', is_active: false });
                    setShowSemModal(true);
                  }}
                  className="bg-primary-green text-white px-5 py-2.5 rounded-lg font-bold flex items-center gap-2 hover:bg-green-700 shadow-sm"
                >
                  <Plus size={18} /> New Semester
                </button>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-100 uppercase tracking-wider text-xs">
                    <tr>
                      <th className="p-4">Semester Name</th>
                      <th className="p-4">School Year</th>
                      <th className="p-4">Duration</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {semesters.map(sem => {
                      const sy = schoolYears.find(s => s.id === sem.school_year_id);
                      const isArchived = sem.status === 'archived';
                      return (
                        <tr key={sem.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                          <td className="p-4 font-bold text-gray-800">{sem.name}</td>
                          <td className="p-4 text-gray-600 font-medium">{sy ? sy.name : 'N/A'}</td>
                          <td className="p-4 text-gray-500">{new Date(sem.start_date).toLocaleDateString()} - {new Date(sem.end_date).toLocaleDateString()}</td>
                          <td className="p-4">
                            {isArchived ? (
                              <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold uppercase">Archived</span>
                            ) : sem.is_active ? (
                              <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold uppercase">Active</span>
                            ) : (
                              <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-xs font-bold uppercase">Inactive</span>
                            )}
                          </td>
                          <td className="p-4 text-right flex justify-end gap-2">
                            {!sem.is_active && !isArchived && (
                              <button onClick={() => activateSemester(sem.id)} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100">Activate</button>
                            )}
                            {!isArchived && (
                              <button onClick={() => { setSemForm(sem); setShowSemModal(true); }} className="p-1.5 text-gray-400 hover:text-primary-green hover:bg-green-50 rounded-lg"><Edit size={16} /></button>
                            )}
                            <button 
                              onClick={() => archiveSemester(sem.id)} 
                              disabled={sem.is_active || isArchived}
                              title={sem.is_active ? "Active semesters cannot be archived" : isArchived ? "Already archived" : "Archive Semester"}
                              className={`p-1.5 rounded-lg ${sem.is_active || isArchived ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-red-500 hover:bg-red-50'}`}
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {semesters.length === 0 && (
                      <tr><td colSpan="5" className="text-center p-8 text-gray-400 font-medium">No semesters configured.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          """

content = content.replace("{/* SCHOOL YEARS TAB */}", sem_tab_content + "{/* SCHOOL YEARS TAB */}")

# Add Semester Modal & Warning Modal before end div
new_modals = """
      {/* SEMESTER MODAL */}
      {showSemModal && (
        <div className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-xl font-bold mb-4">{semForm.id ? 'Edit' : 'Create'} Semester</h3>
            <form onSubmit={saveSemester} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">School Year</label>
                <select required className="w-full mt-1 p-2 border rounded-lg outline-none focus:border-primary-green bg-white" value={semForm.school_year_id} onChange={e => setSemForm({...semForm, school_year_id: e.target.value})}>
                  <option value="">Select School Year...</option>
                  {schoolYears.map(sy => <option key={sy.id} value={sy.id}>{sy.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Semester Name (e.g., First Semester)</label>
                <input required type="text" className="w-full mt-1 p-2 border rounded-lg outline-none focus:border-primary-green" value={semForm.name} onChange={e => setSemForm({...semForm, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Start Date</label>
                  <input required type="date" className="w-full mt-1 p-2 border rounded-lg outline-none focus:border-primary-green" value={semForm.start_date} onChange={e => setSemForm({...semForm, start_date: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">End Date</label>
                  <input required type="date" className="w-full mt-1 p-2 border rounded-lg outline-none focus:border-primary-green" value={semForm.end_date} onChange={e => setSemForm({...semForm, end_date: e.target.value})} />
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowSemModal(false)} className="px-4 py-2 text-gray-500 font-bold hover:bg-gray-100 rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary-green text-white font-bold rounded-lg hover:bg-green-700">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ACTIVATION WARNING MODAL */}
      {warningModal.show && (
        <div className="fixed inset-0 z-[110] bg-black/40 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl border border-amber-100">
            <div className="flex items-center gap-3 text-amber-600 mb-4">
              <AlertCircle size={28} />
              <h3 className="text-lg font-bold text-gray-800">Date Range Warning</h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">{warningModal.message}</p>
            <div className="flex justify-end">
              <button 
                onClick={() => setWarningModal({ show: false, message: '', semId: null })}
                className="px-5 py-2 bg-primary-green text-white font-bold rounded-lg hover:bg-green-700 text-xs"
              >
                Understand & Continue
              </button>
            </div>
          </div>
        </div>
      )}
"""

content = content.replace("    </div>\n  );\n};\n\nexport default AcademicSettings;", new_modals + "\n    </div>\n  );\n};\n\nexport default AcademicSettings;")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Updated AcademicSettings.jsx via update_settings.py!')
