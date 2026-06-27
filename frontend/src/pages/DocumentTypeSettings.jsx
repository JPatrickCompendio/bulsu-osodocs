import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../config/api';
import * as reqService from '../services/requirementService';
import { supabase } from '../supabaseClient';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Loader2,
  X,
  AlertCircle,
  CheckCircle2,
  Lock,
  FileText,
  Upload,
  Check,
} from 'lucide-react';

const DocumentTypeSettings = () => {
  const { typeId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isNew = typeId === 'new';
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [documentType, setDocumentType] = useState(null);
  const [requirements, setRequirements] = useState([]);
  const [subType, setSubType] = useState('In-Campus');
  const [adminPassword, setAdminPassword] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [typeFormData, setTypeFormData] = useState({
    name: '',
    description: '',
    availability_type: 'indefinite',
    requires_eligibility: false,
    submissionWindow: { start_date: '', end_date: '' },
    activityBlocks: [],
  });

  const [editingReqId, setEditingReqId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [reqForm, setReqForm] = useState({
    title: '',
    referenceCode: '',
    description: '',
    file: null,
    file_url: '',
  });
  const reqFileRef = useRef(null);

  const isProposal = typeFormData.name.toLowerCase().includes('activity proposal');

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (isNew) return;
    loadType();
  }, [typeId]);

  useEffect(() => {
    if (!documentType?.id) return;
    loadRequirements(documentType.id, isProposal ? subType : null);
  }, [documentType?.id, subType, isProposal]);

  const loadType = async () => {
    setLoading(true);
    try {
      const types = await reqService.fetchDocumentTypes();
      const found = types.find((t) => String(t.id) === String(typeId));
      if (!found) {
        showToast('Category not found', 'error');
        navigate('/requirements');
        return;
      }
      setDocumentType(found);
      const scheduling = await reqService.fetchScheduling(found.id);
      setTypeFormData({
        name: found.name,
        description: found.description || '',
        availability_type: found.availability_type || 'indefinite',
        requires_eligibility: found.requires_eligibility || false,
        submissionWindow: {
          start_date: found.active_from ? found.active_from.split('T')[0] : '',
          end_date: found.active_until ? found.active_until.split('T')[0] : '',
        },
        activityBlocks: scheduling.activityBlocks || [],
      });
    } catch {
      showToast('Failed to load category', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadRequirements = async (id, proposalType = null) => {
    try {
      const data = await reqService.fetchRequirements(id, proposalType);
      setRequirements(data || []);
    } catch {
      showToast('Failed to load requirements', 'error');
    }
  };

  const resetReqForm = () => {
    setReqForm({ title: '', referenceCode: '', description: '', file: null, file_url: '' });
    setEditingReqId(null);
    setShowAddForm(false);
  };

  const startEditRequirement = (req) => {
    setEditingReqId(req.id);
    setShowAddForm(false);
    setReqForm({
      title: req.title,
      referenceCode: req.referenceCode || '',
      description: req.description || '',
      file: null,
      file_url: req.file_url || '',
    });
  };

  const handleSaveType = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        name: typeFormData.name,
        description: typeFormData.description,
        status: 'active',
        availability_type: typeFormData.availability_type,
        requires_eligibility: typeFormData.requires_eligibility,
        active_from:
          typeFormData.availability_type === 'scheduled' && typeFormData.submissionWindow?.start_date
            ? new Date(typeFormData.submissionWindow.start_date).toISOString()
            : null,
        active_until:
          typeFormData.availability_type === 'scheduled' && typeFormData.submissionWindow?.end_date
            ? new Date(typeFormData.submissionWindow.end_date).toISOString()
            : null,
      };
      const scheduling = {
        activityBlocks: isProposal ? typeFormData.activityBlocks : null,
      };

      if (isNew) {
        const created = await reqService.createDocumentType(payload, scheduling, user.id);
        showToast('Category created');
        navigate(`/requirements/settings/${created.id}`, { replace: true });
      } else {
        await reqService.updateDocumentType(documentType.id, payload, scheduling, user.id);
        showToast('Category updated');
        loadType();
      }
    } catch (error) {
      showToast(error.message || 'Failed to save category', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveRequirement = async (e) => {
    e.preventDefault();
    if (!documentType?.id) {
      showToast('Save the category first', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const currentProposalType = isProposal ? subType : null;
      let finalFilePath = reqForm.file_url;
      if (reqForm.file) {
        if (editingReqId) {
          const existing = requirements.find((r) => r.id === editingReqId);
          if (existing?.file_url) {
            await reqService.deleteStorageFile(existing.file_url).catch(() => {});
          }
        }
        finalFilePath = await reqService.uploadTemplate(reqForm.file, documentType.name, currentProposalType);
      }

      const payload = {
        title: reqForm.title,
        referenceCode: reqForm.referenceCode,
        description: reqForm.description,
        file_url: finalFilePath,
        proposal_type: currentProposalType ? currentProposalType.toLowerCase().replace(' ', '-') : null,
        updatedAt: new Date().toISOString(),
      };

      if (editingReqId) {
        await reqService.updateRequirement(editingReqId, payload);
        showToast('Requirement updated');
      } else {
        await reqService.createRequirement({ ...payload, documentTypeID: documentType.id });
        showToast('Requirement created');
      }
      resetReqForm();
      loadRequirements(documentType.id, currentProposalType);
    } catch (error) {
      showToast(error.message || 'Failed to save requirement', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const requestDelete = async (target) => {
    try {
      if (target.type === 'category') {
        const { count, error } = await supabase
          .from('submissions')
          .select('*', { count: 'exact', head: true })
          .eq('document_type_id', documentType.id);
        if (error) throw error;
        if (count > 0) {
          showToast(`Cannot delete category because it has ${count} existing submission(s)`, 'error');
          return;
        }
      } else {
        const { count, error } = await supabase
          .from('submission_attachments')
          .select('*', { count: 'exact', head: true })
          .eq('requirement_id', target.item.id);
        if (error) throw error;
        if (count > 0) {
          showToast(`Cannot delete requirement because it is used in ${count} submission(s)`, 'error');
          return;
        }
      }
      setDeleteTarget(target);
      setAdminPassword('');
    } catch {
      showToast('Error checking usage', 'error');
    }
  };

  const confirmDelete = async (e) => {
    e.preventDefault();
    if (!adminPassword || !deleteTarget) return;
    setIsSaving(true);
    try {
      const response = await apiFetch('/api/auth/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminEmail: user.email, adminPassword }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        showToast('Invalid admin credentials', 'error');
        return;
      }

      if (deleteTarget.type === 'category') {
        await reqService.deleteDocumentType(documentType.id);
        showToast('Category deleted');
        navigate('/requirements');
      } else {
        await reqService.deleteRequirement(deleteTarget.item.id, deleteTarget.item.file_url);
        showToast('Requirement deleted');
        loadRequirements(documentType.id, isProposal ? subType : null);
      }
      setDeleteTarget(null);
      setAdminPassword('');
    } catch {
      showToast('Failed to delete', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const renderReqForm = (isEdit = false) => (
    <form onSubmit={handleSaveRequirement} className="bg-gray-50/80 border border-gray-100 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-black text-gray-800 text-sm uppercase tracking-wider">
          {isEdit ? 'Edit Requirement' : 'New Requirement'}
        </h4>
        <button type="button" onClick={resetReqForm} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg">
          <X size={18} />
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Title</label>
          <input
            type="text"
            required
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl font-bold text-sm"
            value={reqForm.title}
            onChange={(e) => setReqForm({ ...reqForm, title: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Ref Code</label>
          <input
            type="text"
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl font-bold text-sm"
            value={reqForm.referenceCode}
            onChange={(e) => setReqForm({ ...reqForm, referenceCode: e.target.value })}
          />
        </div>
      </div>
      <div>
        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Description</label>
        <textarea
          rows={2}
          className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl font-bold text-sm resize-none"
          value={reqForm.description}
          onChange={(e) => setReqForm({ ...reqForm, description: e.target.value })}
        />
      </div>
      <div>
        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Template</label>
        <div
          onClick={() => reqFileRef.current?.click()}
          className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center cursor-pointer hover:border-primary-green/40 bg-white"
        >
          <Upload className="mx-auto text-gray-300 mb-2" size={24} />
          <p className="text-xs font-bold text-gray-500">
            {reqForm.file ? reqForm.file.name : reqForm.file_url ? 'Template uploaded (click to replace)' : 'Upload PDF or DOCX'}
          </p>
          <input
            type="file"
            ref={reqFileRef}
            className="hidden"
            accept=".pdf,.docx"
            onChange={(e) => e.target.files[0] && setReqForm({ ...reqForm, file: e.target.files[0] })}
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={isSaving}
        className="w-full py-3 bg-primary-green text-white font-black rounded-xl text-xs uppercase tracking-widest flex items-center justify-center gap-2"
      >
        {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        {isEdit ? 'Save Changes' : 'Add Requirement'}
      </button>
    </form>
  );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-primary-green" size={40} />
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto animate-in fade-in duration-500 pb-20">
      {toast && (
        <div
          className={`fixed top-10 right-10 z-[200] flex items-center gap-4 px-8 py-5 rounded-2xl shadow-2xl ${
            toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-primary-green text-white'
          }`}
        >
          {toast.type === 'error' ? <AlertCircle size={24} /> : <CheckCircle2 size={24} />}
          <span className="font-black text-sm uppercase tracking-wider">{toast.message}</span>
        </div>
      )}

      <button
        onClick={() => navigate('/requirements')}
        className="flex items-center gap-2 text-gray-500 hover:text-primary-green font-semibold text-sm mb-8"
      >
        <ArrowLeft size={18} />
        Back to Requirements
      </button>

      <h1 className="text-3xl font-black text-gray-800 uppercase tracking-tighter mb-2">
        {isNew ? 'New Document Category' : 'Document Type Settings'}
      </h1>
      <p className="text-gray-500 font-medium mb-10">
        {isNew ? 'Create a category and add requirements below.' : `Manage ${documentType?.name || 'category'} settings and requirements.`}
      </p>

      <form onSubmit={handleSaveType} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 space-y-6 mb-10">
        <h2 className="text-lg font-black text-gray-800 uppercase">Category Details</h2>
        <div className="space-y-2">
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Category Name</label>
          <input
            type="text"
            required
            className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-xl font-black text-gray-800"
            value={typeFormData.name}
            onChange={(e) => setTypeFormData({ ...typeFormData, name: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Description</label>
          <textarea
            rows={3}
            className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-700 resize-none"
            value={typeFormData.description}
            onChange={(e) => setTypeFormData({ ...typeFormData, description: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Submission Mode</label>
          <select
            className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-700"
            value={typeFormData.availability_type}
            onChange={(e) => setTypeFormData({ ...typeFormData, availability_type: e.target.value })}
          >
            <option value="indefinite">Indefinite (Open all School Year)</option>
            <option value="scheduled">Scheduled Window</option>
          </select>
        </div>
        <div
          className="flex items-center gap-4 px-4 bg-gray-50 p-5 rounded-xl cursor-pointer"
          onClick={() => setTypeFormData({ ...typeFormData, requires_eligibility: !typeFormData.requires_eligibility })}
        >
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              typeFormData.requires_eligibility ? 'bg-primary-green text-white' : 'bg-gray-200 text-transparent'
            }`}
          >
            <Check size={18} strokeWidth={3} />
          </div>
          <div>
            <h4 className="font-black text-gray-700 text-sm uppercase">Requires Eligibility</h4>
            <p className="text-gray-400 text-xs font-bold">Users must have approved requirements from the previous term/year</p>
          </div>
        </div>
        {typeFormData.availability_type === 'scheduled' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Start Date</label>
              <input
                type="date"
                className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 font-bold text-sm"
                value={typeFormData.submissionWindow?.start_date || ''}
                onChange={(e) =>
                  setTypeFormData({
                    ...typeFormData,
                    submissionWindow: { ...typeFormData.submissionWindow, start_date: e.target.value },
                  })
                }
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">End Date</label>
              <input
                type="date"
                className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 font-bold text-sm"
                value={typeFormData.submissionWindow?.end_date || ''}
                onChange={(e) =>
                  setTypeFormData({
                    ...typeFormData,
                    submissionWindow: { ...typeFormData.submissionWindow, end_date: e.target.value },
                  })
                }
              />
            </div>
          </div>
        )}
        {isProposal && (
          <div className="space-y-4 border-t border-gray-100 pt-6">
            <div className="flex items-center justify-between">
              <h5 className="font-black text-sm text-gray-700 uppercase">Blocked Activity Dates</h5>
              <button
                type="button"
                onClick={() =>
                  setTypeFormData({
                    ...typeFormData,
                    activityBlocks: [...typeFormData.activityBlocks, { start_date: '', end_date: '' }],
                  })
                }
                className="text-primary-green text-xs font-black uppercase flex items-center gap-1"
              >
                <Plus size={14} /> Add Block
              </button>
            </div>
            {typeFormData.activityBlocks?.map((block, idx) => (
              <div key={idx} className="flex items-center gap-4 bg-gray-50 p-4 rounded-xl">
                <input
                  type="date"
                  className="flex-1 px-3 py-2 bg-white rounded-lg text-xs font-bold"
                  value={block.start_date || ''}
                  onChange={(e) => {
                    const newBlocks = [...typeFormData.activityBlocks];
                    newBlocks[idx].start_date = e.target.value;
                    setTypeFormData({ ...typeFormData, activityBlocks: newBlocks });
                  }}
                />
                <input
                  type="date"
                  className="flex-1 px-3 py-2 bg-white rounded-lg text-xs font-bold"
                  value={block.end_date || ''}
                  onChange={(e) => {
                    const newBlocks = [...typeFormData.activityBlocks];
                    newBlocks[idx].end_date = e.target.value;
                    setTypeFormData({ ...typeFormData, activityBlocks: newBlocks });
                  }}
                />
                <button
                  type="button"
                  onClick={() =>
                    setTypeFormData({
                      ...typeFormData,
                      activityBlocks: typeFormData.activityBlocks.filter((_, i) => i !== idx),
                    })
                  }
                  className="text-red-400 p-2"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-4 pt-4">
          <button
            type="submit"
            disabled={isSaving}
            className="px-8 py-4 bg-gray-800 text-white font-black rounded-xl uppercase tracking-widest text-xs flex items-center gap-2"
          >
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {isNew ? 'Create Category' : 'Save Category'}
          </button>
          {!isNew && (
            <button
              type="button"
              onClick={() => requestDelete({ type: 'category' })}
              className="px-8 py-4 bg-red-50 text-red-600 font-black rounded-xl uppercase tracking-widest text-xs flex items-center gap-2 hover:bg-red-100"
            >
              <Trash2 size={18} />
              Delete Category
            </button>
          )}
        </div>
      </form>

      {!isNew && (
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-gray-800 uppercase">Requirements</h2>
              <p className="text-xs font-bold text-gray-400 mt-1">Add and manage requirements for this category</p>
            </div>
            {isProposal && (
              <div className="flex bg-gray-50 p-1 rounded-xl">
                {['In-Campus', 'Off-Campus'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSubType(type)}
                    className={`px-5 py-2 rounded-lg text-xs font-black uppercase ${
                      subType === type ? 'bg-primary-green text-white' : 'text-gray-500'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="p-8 space-y-6">
            {showAddForm && !editingReqId && renderReqForm(false)}
            {!showAddForm && !editingReqId && (
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="w-full py-4 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 font-black text-xs uppercase tracking-widest hover:border-primary-green hover:text-primary-green flex items-center justify-center gap-2"
              >
                <Plus size={18} />
                Add Requirement
              </button>
            )}
            {requirements.length === 0 && !showAddForm ? (
              <p className="text-center text-gray-400 font-bold py-8">No requirements in this section yet.</p>
            ) : (
              requirements.map((req) => (
                <div key={req.id} className="border border-gray-100 rounded-xl overflow-hidden">
                  {editingReqId === req.id ? (
                    <div className="p-4">{renderReqForm(true)}</div>
                  ) : (
                    <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center text-primary-green">
                          <FileText size={20} />
                        </div>
                        <div>
                          <p className="font-black text-gray-800">{req.title}</p>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">
                            {req.referenceCode || 'GENERAL'}
                          </p>
                          {req.description && (
                            <p className="text-xs text-gray-500 font-medium mt-2 line-clamp-2">{req.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEditRequirement(req)}
                          className="px-4 py-2 bg-blue-50 text-blue-600 font-bold rounded-lg text-xs hover:bg-blue-100"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => requestDelete({ type: 'requirement', item: req })}
                          className="px-4 py-2 bg-red-50 text-red-600 font-bold rounded-lg text-xs hover:bg-red-100"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setDeleteTarget(null)} />
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl relative z-10 overflow-hidden">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={40} />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Confirm Deletion</h2>
              <p className="text-gray-500 mb-8">
                You are about to delete{' '}
                <span className="font-bold text-gray-800">
                  {deleteTarget.type === 'category' ? documentType?.name : deleteTarget.item?.title}
                </span>
                . This action cannot be undone.
              </p>
              <form onSubmit={confirmDelete} className="space-y-4">
                <div className="text-left">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Verify Admin Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="password"
                      required
                      placeholder="Enter your password"
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(null)}
                    className="flex-1 px-6 py-3 border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 px-6 py-3 bg-red-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />}
                    Delete
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentTypeSettings;
