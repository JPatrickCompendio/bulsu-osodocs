import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../config/api';
import * as reqService from '../services/requirementService';
import * as subtypeService from '../services/subtypeService';
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
  Settings,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';

const DocumentTypeSettings = () => {
  const { typeId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isNew = typeId === 'new';
  const fileInputRef = useRef(null);

  const [isCategoryDetailsOpen, setIsCategoryDetailsOpen] = useState(true);
  const [isRequirementsOpen, setIsRequirementsOpen] = useState(true);

  const [loading, setLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [documentType, setDocumentType] = useState(null);
  const [requirements, setRequirements] = useState([]);
  const [subType, setSubType] = useState(null); // null = Global
  const [subtypes, setSubtypes] = useState([]);
  const [showSubtypeModal, setShowSubtypeModal] = useState(false);
  const [isAddingSubtype, setIsAddingSubtype] = useState(false);
  const [subtypeForm, setSubtypeForm] = useState({ id: null, name: '', description: '', status: 'active', sort_order: 0 });
  
  const [adminPassword, setAdminPassword] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [typeFormData, setTypeFormData] = useState({
    name: '',
    description: '',
    requires_eligibility: false,
    allow_multiple_submissions: false
  });

  const [editingReqId, setEditingReqId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [reqForm, setReqForm] = useState({
    title: '',
    referenceCode: '',
    description: '',
    file: null,
    file_url: '',
    is_optional: false,
    requirement_scope: 'OSAS',
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
    loadSubtypes(documentType.id);
  }, [documentType?.id]);

  useEffect(() => {
    if (!documentType?.id) return;
    loadRequirements(documentType.id, subType);
  }, [documentType?.id, subType]);

  const loadSubtypes = async (id) => {
    try {
      const data = await subtypeService.fetchSubtypes(id);
      setSubtypes(data || []);
    } catch {
      showToast('Failed to load subtypes', 'error');
    }
  };

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
      setTypeFormData({
        name: found.name,
        description: found.description || '',
        requires_eligibility: found.requires_eligibility || false,
        allow_multiple_submissions: found.allow_multiple_submissions || false,
      });
    } catch {
      showToast('Failed to load category', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadRequirements = async (id, subtypeId = null) => {
    try {
      const data = await reqService.fetchRequirements(id, subtypeId);
      setRequirements(data || []);
    } catch {
      showToast('Failed to load requirements', 'error');
    }
  };

  const resetReqForm = () => {
    setReqForm({ title: '', referenceCode: '', description: '', file: null, file_url: '', is_optional: false, requirement_scope: 'OSAS' });
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
      is_optional: req.is_optional || false,
      requirement_scope: req.requirement_scope || 'OSAS',
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
        requires_eligibility: typeFormData.requires_eligibility,
        allow_multiple_submissions: typeFormData.allow_multiple_submissions,
      };
      if (isNew) {
        const created = await reqService.createDocumentType(payload, user.id);
        showToast('Category created');
        navigate(`/requirements/settings/${created.id}`, { replace: true });
      } else {
        await reqService.updateDocumentType(documentType.id, payload, user.id);
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
      let finalFilePath = reqForm.file_url;
      const currentSubtypeObj = subtypes.find(s => s.id === subType);
      const subtypeSlug = currentSubtypeObj ? currentSubtypeObj.name : null;

      if (reqForm.file) {
        if (editingReqId) {
          const existing = requirements.find((r) => r.id === editingReqId);
          if (existing?.file_url) {
            await reqService.deleteStorageFile(existing.file_url).catch(() => {});
          }
        }
        finalFilePath = await reqService.uploadTemplate(reqForm.file, documentType.name, subtypeSlug);
      }

      const payload = {
        title: reqForm.title,
        referenceCode: reqForm.referenceCode,
        description: reqForm.description,
        file_url: finalFilePath,
        subtype_id: subType, // New field instead of proposal_type
        updatedAt: new Date().toISOString(),
        is_optional: reqForm.is_optional || false,
        requirement_scope: reqForm.requirement_scope || 'OSAS',
      };

      if (editingReqId) {
        await reqService.updateRequirement(editingReqId, payload);
        showToast('Requirement updated');
      } else {
        await reqService.createRequirement({ ...payload, documentTypeID: documentType.id });
        showToast('Requirement created');
      }
      resetReqForm();
      loadRequirements(documentType.id, subType);
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
      } else if (target.type === 'subtype') {
        const { count, error } = await supabase
          .from('activity_proposal_details')
          .select('*', { count: 'exact', head: true })
          .eq('subtype_id', target.item.id);
        if (error) throw error;
        if (count > 0) {
          showToast(`Cannot delete subtype because it has ${count} existing submission(s)`, 'error');
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
      } else if (deleteTarget.type === 'subtype') {
        await subtypeService.deleteSubtype(deleteTarget.item.id);
        showToast('Subtype deleted');
        loadSubtypes(documentType.id);
        if (subType === deleteTarget.item.id) setSubType(null);
        setIsAddingSubtype(false);
        setSubtypeForm({ id: null, name: '', description: '', status: 'active', sort_order: 0 });
      } else {
        await reqService.deleteRequirement(deleteTarget.item.id, deleteTarget.item.file_url);
        showToast('Requirement deleted');
        loadRequirements(documentType.id, subType);
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
      <div className="flex items-center justify-between bg-white border border-gray-200 px-5 py-4 rounded-xl mt-2">
        <div>
          <h4 className="text-sm font-bold text-gray-800">Optional Requirement</h4>
          <p className="text-[10px] font-medium text-gray-400 mt-0.5">Allow students to skip this requirement if not applicable</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={reqForm.is_optional === true || String(reqForm.is_optional) === 'true'}
          onClick={() => setReqForm({ ...reqForm, is_optional: !(reqForm.is_optional === true || String(reqForm.is_optional) === 'true') })}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-green focus:ring-offset-2 ${reqForm.is_optional === true || String(reqForm.is_optional) === 'true' ? 'bg-primary-green' : 'bg-gray-200'}`}
        >
          <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${reqForm.is_optional === true || String(reqForm.is_optional) === 'true' ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>
      <div className="bg-white border border-gray-200 p-5 rounded-xl space-y-3">
        <div>
          <h4 className="text-sm font-bold text-gray-800">Requirement Scope</h4>
          <p className="text-[10px] font-medium text-gray-400 mt-0.5">
            Select the scope to determine automatic forwarding for Main Campus Review
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <label className={`flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
            reqForm.requirement_scope === 'OSOA' 
              ? 'border-blue-600 bg-blue-50/50 text-blue-900 font-bold' 
              : 'border-gray-100 hover:border-gray-200 text-gray-600 font-semibold'
          }`}>
            <input
              type="radio"
              name="requirement_scope"
              value="OSOA"
              checked={reqForm.requirement_scope === 'OSOA'}
              onChange={(e) => setReqForm({ ...reqForm, requirement_scope: e.target.value })}
              className="w-4 h-4 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <div className="text-xs font-black">LOCAL Requirement</div>
              <div className="text-[10px] text-gray-500 font-normal">Retained at Bustos Campus</div>
            </div>
          </label>

          <label className={`flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
            reqForm.requirement_scope === 'OSAS' || !reqForm.requirement_scope 
              ? 'border-emerald-600 bg-emerald-50/50 text-emerald-900 font-bold' 
              : 'border-gray-100 hover:border-gray-200 text-gray-600 font-semibold'
          }`}>
            <input
              type="radio"
              name="requirement_scope"
              value="OSAS"
              checked={reqForm.requirement_scope === 'OSAS' || !reqForm.requirement_scope}
              onChange={(e) => setReqForm({ ...reqForm, requirement_scope: e.target.value })}
              className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
            />
            <div>
              <div className="text-xs font-black">OSAS Requirement</div>
              <div className="text-[10px] text-gray-500 font-normal">Forwarded to Main Campus</div>
            </div>
          </label>
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

  const handleSaveSubtype = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload = {
        document_type_id: documentType.id,
        name: subtypeForm.name,
        description: subtypeForm.description,
        status: subtypeForm.status,
        sort_order: subtypeForm.sort_order,
      };

      if (subtypeForm.id) {
        await subtypeService.updateSubtype(subtypeForm.id, payload);
        showToast('Subtype updated');
      } else {
        await subtypeService.createSubtype(payload);
        showToast('Subtype created');
      }
      setIsAddingSubtype(false);
      setSubtypeForm({ id: null, name: '', description: '', status: 'active', sort_order: 0 });
      loadSubtypes(documentType.id);
    } catch (error) {
      showToast(error.message || 'Failed to save subtype', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-primary-green border-t-transparent rounded-full animate-spin"></div>
        <span className="text-primary-green font-bold tracking-[0.2em] text-xs uppercase animate-pulse">Loading Settings...</span>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto animate-in fade-in duration-500 pb-20">
      {toast && (
        <div
          className={`fixed top-10 right-10 z-[99999] flex items-center gap-4 px-8 py-5 rounded-2xl shadow-2xl ${
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
      <div className="mb-10">
        <PageHeader 
          title={isNew ? 'New Document Category' : 'Document Type Settings'} 
          subtitle={isNew ? 'Create a category and add requirements below.' : `Manage ${documentType?.name || 'category'} settings and requirements.`} 
          icon={Settings} 
          iconColor="slate" 
        />
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-10">
        <div 
          className="p-8 border-b border-gray-100 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => setIsCategoryDetailsOpen(!isCategoryDetailsOpen)}
        >
          <h2 className="text-lg font-black text-gray-800 uppercase">Category Details</h2>
          {isCategoryDetailsOpen ? <ChevronUp className="text-gray-400" /> : <ChevronDown className="text-gray-400" />}
        </div>
        {isCategoryDetailsOpen && (
          <form onSubmit={handleSaveType} className="p-8 space-y-6">
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            className="flex items-center gap-4 px-4 bg-gray-50 p-5 rounded-xl cursor-pointer"
            onClick={() => setTypeFormData({ ...typeFormData, requires_eligibility: !typeFormData.requires_eligibility })}
          >
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                typeFormData.requires_eligibility ? 'bg-primary-green text-white' : 'bg-gray-200 text-transparent'
              }`}
            >
              <Check size={18} strokeWidth={3} />
            </div>
            <div>
              <h4 className="font-black text-gray-700 text-sm uppercase">Requires Eligibility</h4>
              <p className="text-gray-400 text-xs font-bold leading-tight">Users must have approved requirements from previous term</p>
            </div>
          </div>
          
          <div
            className="flex items-center gap-4 px-4 bg-gray-50 p-5 rounded-xl cursor-pointer"
            onClick={() => setTypeFormData({ ...typeFormData, allow_multiple_submissions: !typeFormData.allow_multiple_submissions })}
          >
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                typeFormData.allow_multiple_submissions ? 'bg-primary-green text-white' : 'bg-gray-200 text-transparent'
              }`}
            >
              <Check size={18} strokeWidth={3} />
            </div>
            <div>
              <h4 className="font-black text-gray-700 text-sm uppercase">Allow Multiple Submissions</h4>
              <p className="text-gray-400 text-xs font-bold leading-tight">Organizations may submit this document multiple times</p>
            </div>
          </div>
        </div>
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
        )}
      </div>

      {!isNew && (
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div 
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => setIsRequirementsOpen(!isRequirementsOpen)}
            >
              <div>
                <h2 className="text-lg font-black text-gray-800 uppercase hover:text-primary-green transition-colors">Requirements & Subtypes</h2>
                <p className="text-xs font-bold text-gray-400 mt-1">Manage subtypes and requirements</p>
              </div>
              {isRequirementsOpen ? <ChevronUp className="text-gray-400" /> : <ChevronDown className="text-gray-400" />}
            </div>
            
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsAddingSubtype(false);
                  setSubtypeForm({ id: null, name: '', description: '', status: 'active', sort_order: subtypes.length });
                  setShowSubtypeModal(true);
                }}
                className="px-4 py-2 bg-gray-100 text-gray-600 font-bold rounded-lg text-xs hover:bg-gray-200 flex items-center justify-center gap-2"
              >
                <Settings size={14} /> Manage Subtypes
              </button>
            </div>
          </div>
          
          {isRequirementsOpen && (
            <>
              <div className="border-b border-gray-100 px-8 py-3 bg-gray-50 flex items-center gap-2 overflow-x-auto">
                <button
              type="button"
              onClick={() => setSubType(null)}
              className={`px-5 py-2 rounded-lg text-xs font-black uppercase whitespace-nowrap ${
                subType === null ? 'bg-primary-green text-white' : 'text-gray-500 hover:bg-gray-200'
              }`}
            >
              General Requirements
            </button>
            {subtypes.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setSubType(st.id)}
                className={`px-5 py-2 rounded-lg text-xs font-black uppercase whitespace-nowrap flex items-center gap-2 ${
                  subType === st.id ? 'bg-primary-green text-white' : 'text-gray-500 hover:bg-gray-200'
                }`}
              >
                {st.name} {st.status !== 'active' && <span className="text-[10px] bg-gray-200 px-2 py-0.5 rounded-full text-gray-600">{st.status}</span>}
              </button>
            ))}
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
                          <p className="font-black text-gray-800 flex flex-wrap items-center gap-2">
                            {req.title}
                            <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                              (req.requirement_scope || 'OSAS') === 'OSAS'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-slate-100/90 text-slate-500 border border-slate-200'
                            }`}>
                              {(req.requirement_scope || 'OSAS') === 'OSAS' ? 'OSAS Requirement' : 'LOCAL Requirement'}
                            </span>
                            {(req.is_optional === true || String(req.is_optional) === 'true') && (
                              <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                Optional
                              </span>
                            )}
                          </p>
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
            </>
          )}
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
                  {deleteTarget.type === 'category' 
                    ? documentType?.name 
                    : deleteTarget.type === 'subtype' 
                      ? deleteTarget.item?.name 
                      : deleteTarget.item?.title}
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

      {showSubtypeModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowSubtypeModal(false)} />
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-8 border-b border-gray-100 shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800">
                  Manage Subtypes
                </h2>
                <button onClick={() => setShowSubtypeModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <div className="overflow-y-auto p-8 flex-1">
              {(!subtypeForm.id && !isAddingSubtype) ? (
                <div className="space-y-6">
                  {subtypes.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-100">
                      <p className="text-gray-400 font-bold">No subtypes defined.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {subtypes.map((st) => (
                        <div key={st.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-gray-200 transition-colors">
                          <div>
                            <p className="font-bold text-sm text-gray-800">{st.name}</p>
                            <p className="text-[10px] text-gray-500 uppercase font-black mt-1">{st.status}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSubtypeForm(st);
                              setIsAddingSubtype(true);
                            }}
                            className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-100 shadow-sm"
                          >
                            Edit
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setSubtypeForm({ id: null, name: '', description: '', status: 'active', sort_order: subtypes.length });
                      setIsAddingSubtype(true);
                    }}
                    className="w-full py-4 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 font-black text-xs uppercase tracking-widest hover:border-primary-green hover:text-primary-green flex items-center justify-center gap-2"
                  >
                    <Plus size={18} />
                    Add New Subtype
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSaveSubtype} className="space-y-5 animate-in slide-in-from-right-4 duration-300">
                  <div className="flex items-center gap-3 mb-6">
                    <button
                      type="button"
                      onClick={() => setIsAddingSubtype(false)}
                      className="text-gray-400 hover:text-gray-800 transition-colors"
                    >
                      <ArrowLeft size={20} />
                    </button>
                    <h3 className="font-bold text-gray-800">
                      {subtypeForm.id ? 'Edit Subtype' : 'New Subtype'}
                    </h3>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Name</label>
                    <input
                      type="text"
                      required
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm"
                      value={subtypeForm.name}
                      onChange={(e) => setSubtypeForm({ ...subtypeForm, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Description</label>
                    <textarea
                      rows={3}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm resize-none"
                      value={subtypeForm.description}
                      onChange={(e) => setSubtypeForm({ ...subtypeForm, description: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Status</label>
                    <select
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-sm"
                      value={subtypeForm.status}
                      onChange={(e) => setSubtypeForm({ ...subtypeForm, status: e.target.value })}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                  <div className="pt-6 space-y-3">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="w-full py-4 bg-primary-green text-white font-black rounded-xl text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-green-700 transition-colors shadow-lg shadow-green-900/20"
                    >
                      {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                      Save Subtype
                    </button>
                    {subtypeForm.id && (
                      <button
                        type="button"
                        onClick={() => requestDelete({ type: 'subtype', item: subtypeForm })}
                        className="w-full py-4 bg-red-50 text-red-600 font-black rounded-xl text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"
                      >
                        <Trash2 size={16} />
                        Delete Subtype
                      </button>
                    )}
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentTypeSettings;
