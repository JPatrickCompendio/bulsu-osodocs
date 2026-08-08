import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  AlertCircle,
  CheckCircle,
  X,
  Megaphone,
  Power,
  UploadCloud,
  Paperclip,
  ExternalLink
} from 'lucide-react';
import { apiClient, apiUrl } from '../config/apiClient';
import { supabase } from '../supabaseClient';
import PageHeader from '../components/PageHeader';
import { useToast } from '../hooks/useToast';

const AnnouncementManagement = () => {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [existingFiles, setExistingFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const { showToast, ToastComponent } = useToast();
  
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    target_audience: 'oso-staff',
    is_active: true
  });
  
  const [organizations, setOrganizations] = useState([]);
  const [specificOrg, setSpecificOrg] = useState('');

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(apiUrl('/api/announcements'));
      if (res.data.success) {
        setAnnouncements(res.data.data);
      }
    } catch (err) {
      setError('Failed to fetch announcements.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrganizations = async () => {
    try {
      const res = await apiClient.get(apiUrl('/api/users'));
      if (res.data) {
        const orgs = res.data
          .filter(u => u.role === 'org-president' && u.org_name)
          .map(u => u.org_name);
        setOrganizations([...new Set(orgs)]);
      }
    } catch (err) {
      console.error('Error fetching orgs:', err);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
    fetchOrganizations();
  }, []);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles(Array.from(e.target.files));
    } else {
      setSelectedFiles([]);
    }
  };

  const uploadFiles = async (announcementId) => {
    if (selectedFiles.length === 0) return;
    setUploading(true);
    try {
      const folderPath = `announcements/${announcementId}`;
      
      const uploadPromises = selectedFiles.map(file => {
        const filePath = `${folderPath}/${file.name}`;
        return supabase.storage.from('documents').upload(filePath, file, {
          upsert: true
        });
      });

      await Promise.all(uploadPromises);
    } catch (err) {
      console.error('Error uploading file:', err);
      showToast('Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const removeExistingFile = async (fileName) => {
    if (!window.confirm(`Are you sure you want to remove ${fileName}?`)) return;
    try {
      const filePath = `announcements/${editingId}/${fileName}`;
      await supabase.storage.from('documents').remove([filePath]);
      setExistingFiles(prev => prev.filter(f => f.name !== fileName));
    } catch (err) {
      console.error('Error removing file:', err);
      showToast('Failed to remove file');
    }
  };

  const openModal = async (announcement = null) => {
    if (announcement) {
      setEditingId(announcement.id);
      
      let audience = announcement.target_audience;
      let sOrg = '';
      if (audience && audience.startsWith('org:')) {
        sOrg = audience.substring(4);
        audience = 'specific-org';
      }
      
      setFormData({
        title: announcement.title,
        content: announcement.content,
        target_audience: audience,
        is_active: announcement.is_active
      });
      setSpecificOrg(sOrg);
      
      try {
        const folderPath = `announcements/${announcement.id}`;
        const { data } = await supabase.storage.from('documents').list(folderPath);
        if (data) {
          setExistingFiles(data.filter(f => f.name !== '.emptyFolderPlaceholder'));
        }
      } catch (err) {
        console.error('Error fetching existing files:', err);
      }
    } else {
      setEditingId(null);
      setFormData({
        title: '',
        content: '',
        target_audience: 'oso-staff',
        is_active: true
      });
      setSpecificOrg('');
      setExistingFiles([]);
    }
    setSelectedFiles([]);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setSelectedFiles([]);
    setExistingFiles([]);
    setSpecificOrg('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let currentAnnId = editingId;
      
      let finalAudience = formData.target_audience;
      if (finalAudience === 'specific-org') {
        if (!specificOrg) {
          showToast('Please select an organization');
          return;
        }
        finalAudience = `org:${specificOrg}`;
      }

      const payload = {
        ...formData,
        target_audience: finalAudience
      };

      if (editingId) {
        await apiClient.put(apiUrl(`/api/announcements/${editingId}`), payload);
      } else {
        const res = await apiClient.post(apiUrl('/api/announcements'), {
          ...payload,
          created_by: user?.id
        });
        currentAnnId = res.data.data.id;
      }

      if (selectedFiles.length > 0) {
        await uploadFiles(currentAnnId);
      }

      fetchAnnouncements();
      closeModal();
    } catch (err) {
      console.error('Error saving announcement:', err);
      showToast('Failed to save announcement.');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this announcement?')) {
      try {
        await apiClient.delete(apiUrl(`/api/announcements/${id}`));
        fetchAnnouncements();
      } catch (err) {
        console.error('Error deleting announcement:', err);
        showToast('Failed to delete announcement.');
      }
    }
  };

  const toggleActive = async (ann) => {
    try {
      await apiClient.put(apiUrl(`/api/announcements/${ann.id}`), {
        ...ann,
        is_active: !ann.is_active
      });
      fetchAnnouncements();
    } catch (err) {
      console.error('Error toggling status:', err);
    }
  };

  return (
    <div>
      <div className="mb-8 flex justify-between items-center">
        <PageHeader 
          title="Announcement Management" 
          subtitle="Create and manage system-wide announcements." 
          icon={Megaphone} 
          iconColor="gold" 
        />
        <button 
          onClick={() => openModal()}
          className="flex items-center gap-2 bg-primary-green text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
        >
          <Plus size={20} />
          <span>New Announcement</span>
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-2">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading announcements...</div>
        ) : announcements.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <Megaphone size={48} className="text-gray-300 mb-4" />
            <h3 className="text-xl font-medium text-gray-700">No Announcements</h3>
            <p className="text-gray-500 mt-1">Click the button above to create your first announcement.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#073c2d] border-b border-[#073c2d] text-white font-medium text-sm">
                <th className="p-4 text-white">Title</th>
                <th className="p-4 text-white">Audience</th>
                <th className="p-4 text-white">Status</th>
                <th className="p-4 text-white">Date Created</th>
                <th className="p-4 text-right text-white">Actions</th>
              </tr>
            </thead>
            <tbody>
              {announcements.map((ann) => (
                <tr key={ann.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="p-4">
                    <div className="font-medium text-gray-800">{ann.title}</div>
                    <div className="text-sm text-gray-500 truncate max-w-md">{ann.content}</div>
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs uppercase tracking-wider font-medium">
                      {ann.target_audience && ann.target_audience.startsWith('org:') ? `Org: ${ann.target_audience.substring(4)}` : ann.target_audience}
                    </span>
                  </td>
                  <td className="p-4">
                    <button 
                      onClick={() => toggleActive(ann)}
                      className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                        ann.is_active 
                          ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100' 
                          : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <Power size={14} />
                      {ann.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="p-4 text-sm text-gray-500">
                    {new Date(ann.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => openModal(ann)}
                        className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(ann.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800">
                {editingId ? 'Edit Announcement' : 'Create Announcement'}
              </h2>
              <button 
                onClick={closeModal}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 overflow-y-auto flex-1 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input 
                    type="text" 
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-primary-green focus:ring-1 focus:ring-primary-green"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                  <textarea 
                    name="content"
                    value={formData.content}
                    onChange={handleInputChange}
                    rows="4"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-primary-green focus:ring-1 focus:ring-primary-green resize-none"
                    required
                  ></textarea>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Audience</label>
                  <select 
                    name="target_audience"
                    value={formData.target_audience}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-primary-green focus:ring-1 focus:ring-primary-green"
                  >
                    <option value="oso-staff">OSO Staff (Chairman & Vice Chairman)</option>
                    <option value="chairman">Chairman Only</option>
                    <option value="vice-chairman">Vice Chairman Only</option>
                    <option value="all-orgs">All Organizations</option>
                    <option value="specific-org">Specific Organization</option>
                  </select>

                  {formData.target_audience === 'specific-org' && (
                    <div className="mt-2 animate-in fade-in slide-in-from-top-2">
                      <select
                        value={specificOrg}
                        onChange={(e) => setSpecificOrg(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-primary-green focus:ring-1 focus:ring-primary-green"
                        required
                      >
                        <option value="">-- Select Organization --</option>
                        {organizations.map(org => (
                          <option key={org} value={org}>{org}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Attachments (Photos/Files)</label>
                  
                  {existingFiles.length > 0 && (
                    <div className="mb-4 space-y-2">
                      <p className="text-xs font-bold text-gray-500 uppercase">Existing Files:</p>
                      <div className="bg-gray-50 rounded-lg p-3 space-y-2 border border-gray-100 max-h-32 overflow-y-auto">
                        {existingFiles.map(file => (
                          <div key={file.name} className="flex items-center justify-between bg-white px-3 py-2 rounded border border-gray-200">
                            <div className="flex items-center gap-2 truncate">
                              <Paperclip size={14} className="text-gray-400 shrink-0" />
                              <span className="text-sm text-gray-700 truncate">{file.name}</span>
                            </div>
                            <button 
                              type="button"
                              onClick={() => removeExistingFile(file.name)}
                              className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded transition-colors"
                              title="Remove file"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700 shrink-0">
                      <UploadCloud size={18} className="text-gray-500" />
                      <span>Choose Files</span>
                      <input 
                        type="file" 
                        multiple
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                    <div className="text-sm text-gray-500 truncate flex-1 flex flex-col justify-center">
                      {selectedFiles.length > 0 ? (
                        <span className="font-medium text-primary-green">{selectedFiles.length} file(s) selected</span>
                      ) : (
                        <span>Select multiple files/photos to attach</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input 
                    type="checkbox" 
                    id="is_active"
                    name="is_active"
                    checked={formData.is_active}
                    onChange={handleInputChange}
                    className="w-4 h-4 text-primary-green rounded border-gray-300 focus:ring-primary-green"
                  />
                  <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                    Active (visible to target audience)
                  </label>
                </div>
              </div>
              
              <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={uploading}
                  className={`px-5 py-2 bg-primary-green text-white font-medium rounded-lg transition-colors shadow-sm ${uploading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-green-700'}`}
                >
                  {uploading ? 'Uploading...' : (editingId ? 'Save Changes' : 'Publish Announcement')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ToastComponent />
    </div>
  );
};

export default AnnouncementManagement;
