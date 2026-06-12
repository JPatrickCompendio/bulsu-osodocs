import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import * as reqService from '../services/requirementService';
import { supabase } from '../supabaseClient';
import {
  Plus,
  Search,
  ChevronRight,
  Edit2,
  Trash2,
  FileText,
  RefreshCcw,
  Calendar,
  X,
  Loader2,
  FileCode,
  Info,
  ArrowLeft,
  FileCheck,
  Eye,
  Download,
  Upload,
  File as FileIcon,
  AlertCircle,
  CheckCircle2,
  LayoutGrid,
  Settings2,
  Paperclip,
  MoreHorizontal,
  Check
} from 'lucide-react';

const ListOfRequirements = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // State
  const [documentTypes, setDocumentTypes] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [editingRequirement, setEditingRequirement] = useState(null);
  const [editingType, setEditingType] = useState(null);
  const [subType, setSubType] = useState('In-Campus'); // NEW: Subcategory state
  const [previewUrl, setPreviewUrl] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [reqToDelete, setReqToDelete] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    referenceCode: '',
    description: '',
    file: null,
    file_url: ''
  });

  const [typeFormData, setTypeFormData] = useState({
    name: '',
    description: '',
    availability_type: 'indefinite',
    requires_eligibility: false,
    submissionWindow: { start_date: '', end_date: '' },
    activityBlocks: []
  });

  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const fileInputRef = useRef(null);

  // Initial fetch
  useEffect(() => {
    loadDocumentTypes();
  }, []);

  useEffect(() => {
    const fetchUrl = async () => {
      if (!previewFile) {
        setFilePreviewUrl('');
        return;
      }
      let finalPath = previewFile.url || '';
      if (finalPath.startsWith('documents/')) {
        finalPath = finalPath.replace('documents/', '');
      }

      try {
        const { data } = await supabase.storage
          .from('documents')
          .createSignedUrl(finalPath, 3600);

        if (data?.signedUrl) {
          setFilePreviewUrl(data.signedUrl);
          return;
        }
      } catch (e) {
        console.error('Failed to get signed URL:', e);
      }

      // Fallback
      const { data } = supabase.storage
        .from('documents')
        .getPublicUrl(finalPath);

      setFilePreviewUrl(data?.publicUrl || '');
    };
    fetchUrl();
  }, [previewFile]);

  // Fetch requirements when type or subType changes
  useEffect(() => {
    if (selectedType) {
      const isProposal = selectedType.name.toLowerCase().includes('activity proposal');
      loadRequirements(selectedType.id, isProposal ? subType : null);
    }
  }, [selectedType, subType]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadDocumentTypes = async () => {
    setLoading(true);
    try {
      const data = await reqService.fetchDocumentTypes();
      setDocumentTypes(data || []);
    } catch (error) {
      showToast('Failed to load categories', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadRequirements = async (typeId, proposalType = null) => {
    setLoading(true);
    try {
      const data = await reqService.fetchRequirements(typeId, proposalType);
      setRequirements(data || []);
    } catch (error) {
      showToast('Failed to load requirements', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Icon mapper based on keywords
  const getIconForType = (name) => {
    const n = name.toLowerCase();
    if (n.includes('renewal')) return <RefreshCcw className="text-green-500" />;
    if (n.includes('activity') || n.includes('proposal')) return <FileText className="text-blue-500" />;
    if (n.includes('report') || n.includes('year')) return <Calendar className="text-orange-500" />;
    if (n.includes('finance') || n.includes('budget')) return <FileCode className="text-purple-500" />;
    return <FileCheck className="text-gray-500" />;
  };

  const getBgForType = (name) => {
    const n = name.toLowerCase();
    if (n.includes('renewal')) return 'bg-green-50';
    if (n.includes('activity') || n.includes('proposal')) return 'bg-blue-50';
    if (n.includes('report') || n.includes('year')) return 'bg-orange-50';
    if (n.includes('finance') || n.includes('budget')) return 'bg-purple-50';
    return 'bg-gray-50';
  };

  // Requirement CRUD
  const handleOpenReqModal = (req = null) => {
    if (req) {
      setEditingRequirement(req);
      setFormData({
        title: req.title,
        referenceCode: req.referenceCode || '',
        description: req.description || '',
        file: null,
        file_url: req.file_url || ''
      });
    } else {
      setEditingRequirement(null);
      setFormData({ title: '', referenceCode: '', description: '', file: null, file_url: '' });
    }
    setIsModalOpen(true);
  };

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setFormData({ ...formData, file: e.target.files[0] });
    }
  };

  const handleSaveRequirement = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const isProposal = selectedType.name.toLowerCase().includes('activity proposal');
      const currentProposalType = isProposal ? subType : null;

      let finalFilePath = formData.file_url;
      if (formData.file) {
        if (editingRequirement && editingRequirement.file_url) {
          await reqService.deleteStorageFile(editingRequirement.file_url).catch(() => { });
        }
        // Pass currentProposalType to ensure correct folder structure in storage
        finalFilePath = await reqService.uploadTemplate(formData.file, selectedType.name, currentProposalType);
      }

      const payload = {
        title: formData.title,
        referenceCode: formData.referenceCode,
        description: formData.description,
        file_url: finalFilePath,
        proposal_type: currentProposalType ? currentProposalType.toLowerCase().replace(' ', '-') : null,
        updatedAt: new Date().toISOString()
      };

      if (editingRequirement) {
        await reqService.updateRequirement(editingRequirement.id, payload);
        showToast('Requirement updated');
      } else {
        await reqService.createRequirement({ ...payload, documentTypeID: selectedType.id });
        showToast('Requirement created');
      }
      setIsModalOpen(false);
      loadRequirements(selectedType.id, currentProposalType);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Document Type CRUD
  const handleOpenTypeModal = async (type = null) => {
    if (type) {
      setEditingType(type);
      const scheduling = await reqService.fetchScheduling(type.id);
      setTypeFormData({
        name: type.name,
        description: type.description || '',
        availability_type: type.availability_type || 'indefinite',
        requires_eligibility: type.requires_eligibility || false,
        submissionWindow: { 
          start_date: type.active_from ? type.active_from.split('T')[0] : '', 
          end_date: type.active_until ? type.active_until.split('T')[0] : '' 
        },
        activityBlocks: scheduling.activityBlocks || []
      });
    } else {
      setEditingType(null);
      setTypeFormData({ name: '', description: '', availability_type: 'indefinite', requires_eligibility: false, submissionWindow: { start_date: '', end_date: '' }, activityBlocks: [] });
    }
    setIsTypeModalOpen(true);
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
        active_from: typeFormData.availability_type === 'scheduled' && typeFormData.submissionWindow?.start_date ? new Date(typeFormData.submissionWindow.start_date).toISOString() : null,
        active_until: typeFormData.availability_type === 'scheduled' && typeFormData.submissionWindow?.end_date ? new Date(typeFormData.submissionWindow.end_date).toISOString() : null
      };
      const scheduling = {
        activityBlocks: typeFormData.name.toLowerCase().includes('activity proposal') ? typeFormData.activityBlocks : null
      };
      if (editingType) {
        await reqService.updateDocumentType(editingType.id, payload, scheduling, user.id);
        showToast('Category updated');
      } else {
        await reqService.createDocumentType(payload, scheduling, user.id);
        showToast('Category created');
      }
      setIsTypeModalOpen(false);
      loadDocumentTypes();
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteType = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Deleting this category will NOT delete the requirements inside it automatically. Are you sure?')) return;
    try {
      await reqService.deleteDocumentType(id);
      showToast('Category deleted');
      loadDocumentTypes();
    } catch (error) {
      showToast('Cannot delete category with active requirements', 'error');
    }
  };

  // Preview & Download
  const handlePreview = async (filePath) => {
    setIsPreviewLoading(true);
    setIsPreviewOpen(true);
    try {
      const url = await reqService.generateSignedUrl(filePath);
      setPreviewUrl(url);
    } catch (error) {
      showToast('Preview failed', 'error');
      setIsPreviewOpen(false);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleDownload = async (filePath, fileName) => {
    try {
      const url = await reqService.generateSignedUrl(filePath);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      showToast('Download failed', 'error');
    }
  };

  if (loading && documentTypes.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50/20">
        <div className="flex flex-col items-center gap-6">
          <div className="relative w-24 h-24">
            <div className="absolute inset-0 rounded-full border-4 border-primary-green/10 border-t-primary-green animate-spin" />
            <div className="absolute inset-4 rounded-full border-4 border-secondary-gold/10 border-b-secondary-gold animate-spin-reverse" />
          </div>
          <span className="text-gray-400 font-black uppercase tracking-[0.2em] text-[10px]">Synchronizing Cloud Data</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen animate-in fade-in duration-500">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-10 right-10 z-[200] flex items-center gap-4 px-8 py-5 rounded-[2rem] shadow-2xl animate-in slide-in-from-right-full duration-500 ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-primary-green text-white'
          }`}>
          {toast.type === 'error' ? <AlertCircle size={24} /> : <CheckCircle2 size={24} />}
          <span className="font-black text-sm uppercase tracking-wider">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="mb-16 flex flex-col xl:flex-row xl:items-center justify-between gap-10">
        <div className="flex items-center gap-6">
          <div className="p-3 bg-primary-green rounded-xl shadow-lg shadow-primary-green/20">
            <LayoutGrid className="text-white" size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-gray-800 uppercase tracking-tighter mb-1">Requirements</h1>
            <div className="flex items-center gap-3 text-gray-400 font-bold uppercase tracking-widest text-[10px]">
              <span className="text-primary-green">Document Management</span>
              <ChevronRight size={14} />
              <span>{selectedType ? selectedType.name : 'All Categories'}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-6 w-full xl:max-w-md">
          <div className="relative flex-1 w-full group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-green transition-all" size={20} />
            <input
              type="text"
              placeholder="Search by title, code, or content..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:border-primary-green focus:ring-0 outline-none transition-all shadow-sm font-bold text-gray-700 text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {isAdmin && !selectedType && (
            <button
              onClick={() => handleOpenTypeModal(null)}
              className="bg-gray-800 text-white px-6 py-3.5 rounded-xl text-sm font-black flex items-center gap-2 hover:bg-black transition-all shadow-md whitespace-nowrap"
            >
              <Settings2 size={18} />
              New Category
            </button>
          )}
        </div>
      </div>

      {!selectedType ? (
        /* Dynamic Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 animate-in slide-in-from-bottom-10 duration-700">
          {documentTypes.map((type) => (
            <div
              key={type.id}
              onClick={() => setSelectedType(type)}
              className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer group relative overflow-hidden"
            >
              <div className={`${getBgForType(type.name)} w-16 h-16 rounded-xl flex items-center justify-center mb-6 group-hover:scale-105 transition-transform duration-300`}>
                {React.cloneElement(getIconForType(type.name), { size: 32 })}
              </div>
              <h3 className="text-xl font-black text-gray-800 mb-3 group-hover:text-primary-green transition-colors leading-tight">{type.name}</h3>
              <p className="text-gray-500 font-medium leading-relaxed mb-8 text-sm line-clamp-2">{type.description || 'View and download requirements for this document category.'}</p>

              <div className="pt-6 border-t border-gray-50 flex items-center justify-between mt-auto">
                {isAdmin && (
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => handleOpenTypeModal(type)} className="p-3 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-2xl transition-all"><Edit2 size={20} /></button>
                    <button onClick={(e) => handleDeleteType(type.id, e)} className="p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"><Trash2 size={20} /></button>
                  </div>
                )}
                <div className="flex items-center gap-3 ml-auto">
                  <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Explore List</span>
                  <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-primary-green group-hover:text-white transition-all duration-300">
                    <ChevronRight size={16} />
                  </div>
                </div>
              </div>
            </div>
          ))}
          {documentTypes.length === 0 && (
            <div className="col-span-full py-20 text-center bg-white rounded-3xl border-2 border-dashed border-gray-100 flex flex-col items-center gap-4">
              <Info size={48} className="text-gray-300" />
              <div className="space-y-1">
                <p className="text-xl font-black text-gray-400 uppercase tracking-widest">No Categories Defined</p>
                <p className="text-gray-500 text-sm">Admins can create new document types to start grouping requirements.</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Requirements Table */
        <div className="animate-in slide-in-from-right-10 duration-500">
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={() => setSelectedType(null)}
              className="flex items-center gap-3 text-gray-500 hover:text-primary-green hover:bg-gray-50 transition-all p-3 rounded-xl"
            >
              <ArrowLeft size={24} />
              <span className="font-bold text-sm">Back</span>
            </button>

            {isAdmin && (
              <button
                onClick={() => handleOpenReqModal()}
                className="bg-primary-green text-white px-6 py-3 rounded-xl font-black flex items-center gap-3 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary-green/30"
              >
                <Plus size={20} />
                Add Requirement
              </button>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-gray-100 bg-gray-50/30 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className={`${getBgForType(selectedType.name)} w-14 h-14 rounded-xl shadow-sm flex items-center justify-center`}>
                  {React.cloneElement(getIconForType(selectedType.name), { size: 24 })}
                </div>
                <div>
                  <h2 className="text-2xl font-black text-gray-800 tracking-tight leading-none mb-1.5">{selectedType.name}</h2>
                  <p className="text-gray-500 text-sm">{selectedType.description || 'System-authorized requirements and templates.'}</p>
                </div>
              </div>

              {/* NEW: Subcategory Toggle for Activity Proposal */}
              {selectedType.name.toLowerCase().includes('activity proposal') && (
                <div className="flex bg-white p-1.5 rounded-xl shadow-sm border border-gray-100">
                  {['In-Campus', 'Off-Campus'].map((type) => (
                    <button
                      key={type}
                      onClick={() => setSubType(type)}
                      className={`px-6 py-2.5 rounded-lg text-xs font-black transition-all duration-300 uppercase tracking-widest ${subType === type
                        ? 'bg-primary-green text-white shadow-md'
                        : 'text-gray-500 hover:bg-gray-50'
                        }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/30 text-gray-400 border-b-2 border-gray-50">
                    <th className="px-6 py-4 font-black text-[10px] uppercase tracking-[0.2em] w-1/4">Title of Requirement</th>
                    <th className="px-6 py-4 font-black text-[10px] uppercase tracking-[0.2em]">Code</th>
                    <th className="px-6 py-4 font-black text-[10px] uppercase tracking-[0.2em] w-1/3">Description</th>
                    <th className="px-6 py-4 font-black text-[10px] uppercase tracking-[0.2em]">Attachment</th>
                    <th className="px-6 py-4 font-black text-[10px] uppercase tracking-[0.2em] text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-gray-50">
                  {requirements.filter(req => req.title.toLowerCase().includes(searchQuery.toLowerCase())).length > 0 ? (
                    requirements.filter(req => req.title.toLowerCase().includes(searchQuery.toLowerCase())).map((req) => (
                      <tr key={req.id} className="hover:bg-gray-50/20 transition-all group">
                        <td className="px-6 py-4">
                          <div className="font-black text-lg text-gray-800">{req.title}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1.5 bg-gray-100 text-gray-500 rounded-lg text-[10px] font-black tracking-widest border border-gray-200/50">
                            {req.referenceCode || 'GENERAL'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-gray-400 font-bold text-xs leading-relaxed line-clamp-2">{req.description || 'No special instructions provided.'}</p>
                        </td>
                        <td className="px-6 py-4">
                          {req.file_url ? (
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2 text-primary-green">
                                <FileText size={16} />
                                <span className="font-black text-xs truncate max-w-[150px]">
                                  {req.file_url.split('/').pop()}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="font-black text-xs text-gray-400 uppercase">None</span>
                          )}
                        </td>
                        <td className="px-6 py-4 relative">
                          <div className="flex justify-end relative">
                            {/* Direct Preview Button */}
                            <button
                              onClick={() => setPreviewFile({ title: req.title, url: req.file_url })}
                              className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-all mr-2"
                            >
                              <Eye size={20} />
                            </button>
                            <button
                              onClick={() => setActiveDropdown(activeDropdown === req.id ? null : req.id)}
                              className="p-2 text-gray-400 hover:text-primary-green hover:bg-gray-100 rounded-lg transition-all"
                            >
                              <MoreHorizontal size={20} />
                            </button>

                            {activeDropdown === req.id && (
                              <div className="absolute right-0 top-10 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                {req.file_url && (
                                  <>
                                    <button onClick={() => { setPreviewFile({ title: req.title, url: req.file_url }); setActiveDropdown(null); }} className="w-full text-left px-4 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50 hover:text-primary-green flex items-center gap-3">
                                      <Eye size={16} /> Preview
                                    </button>
                                    <button onClick={() => { handleDownload(req.file_url, `${req.title}${req.file_url.toLowerCase().endsWith('.docx') ? '.docx' : '.pdf'}`); setActiveDropdown(null); }} className="w-full text-left px-4 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50 hover:text-primary-green flex items-center gap-3">
                                      <Download size={16} /> Download
                                    </button>
                                  </>
                                )}
                                {isAdmin && (
                                  <>
                                    <div className="h-[1px] bg-gray-100 w-full" />
                                    <button onClick={() => { handleOpenReqModal(req); setActiveDropdown(null); }} className="w-full text-left px-4 py-3 text-sm font-bold text-gray-600 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-3">
                                      <Edit2 size={16} /> Edit
                                    </button>
                                    <button onClick={() => { setReqToDelete(req); setActiveDropdown(null); }} className="w-full text-left px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-50 flex items-center gap-3">
                                      <Trash2 size={16} /> Delete
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-20 text-center opacity-40">
                        <div className="flex flex-col items-center gap-4">
                          <Info size={64} className="text-gray-200" />
                          <div className="space-y-1">
                            <p className="text-xl font-black text-gray-400 uppercase tracking-widest">Category Empty</p>
                            <p className="text-gray-400 font-bold text-sm">No requirements have been listed yet.</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {reqToDelete && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-gray-950/40 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-8 animate-in zoom-in-95 duration-300 text-center">
            <AlertCircle size={64} className="text-red-500 mx-auto mb-6" />
            <h3 className="text-2xl font-black text-gray-800 mb-2">Delete Requirement?</h3>
            <p className="text-gray-500 font-bold mb-8">Are you sure you want to delete "{reqToDelete.title}"? This action cannot be undone.</p>
            <div className="flex gap-4">
              <button onClick={() => setReqToDelete(null)} className="flex-1 py-4 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-all">Cancel</button>
              <button
                onClick={() => {
                  reqService.deleteRequirement(reqToDelete.id, reqToDelete.file_url).then(() => {
                    loadRequirements(selectedType.id, subType);
                    setReqToDelete(null);
                    showToast('Requirement deleted');
                  });
                }}
                className="flex-1 py-4 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-all shadow-lg shadow-red-500/30"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Requirement Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-gray-950/40 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/30">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-primary-green rounded-xl flex items-center justify-center text-white shadow-md shadow-primary-green/20">
                  <Plus size={20} />
                </div>
                <h3 className="text-lg font-black text-gray-800 uppercase tracking-tighter truncate max-w-[300px]">
                  {editingRequirement ? `Edit: ${editingRequirement.title}` : 'Add Requirement'}
                </h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"><X size={24} /></button>
            </div>

            <form onSubmit={handleSaveRequirement} className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="sm:col-span-2 space-y-2">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Requirement Title</label>
                  <input
                    type="text" required placeholder="e.g. Organizational Bylaws"
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent rounded-xl focus:bg-white focus:border-primary-green/40 outline-none transition-all font-bold text-gray-700 text-sm shadow-inner"
                    value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Ref Code</label>
                  <input
                    type="text" placeholder="e.g. BY-2026"
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent rounded-xl focus:bg-white focus:border-primary-green/40 outline-none transition-all font-bold text-gray-700 text-sm shadow-inner"
                    value={formData.referenceCode} onChange={(e) => setFormData({ ...formData, referenceCode: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Detailed Instructions</label>
                <textarea
                  rows="3" placeholder="How should organizations prepare this document?"
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent rounded-xl focus:bg-white focus:border-primary-green/40 outline-none transition-all resize-none font-bold text-gray-700 text-sm shadow-inner"
                  value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                ></textarea>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Template PDF</label>
                <div
                  onClick={() => fileInputRef.current.click()}
                  className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-primary-green/40 hover:bg-primary-green/5 transition-all cursor-pointer group shadow-inner"
                >
                  <Upload className="mx-auto text-gray-300 mb-3 group-hover:text-primary-green transition-all" size={32} />
                  <p className="text-sm font-bold text-gray-500 group-hover:text-primary-green transition-colors">
                    {formData.file ? formData.file.name : formData.file_url ? 'Template Uploaded' : 'Upload Template (PDF or DOCX)'}
                  </p>
                  <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.docx" onChange={handleFileChange} />
                </div>
              </div>

              <div className="pt-4 flex gap-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-6 py-3 bg-gray-50 text-gray-500 font-black rounded-xl hover:bg-gray-100 transition-all uppercase tracking-widest text-xs">Cancel</button>
                <button type="submit" disabled={isSaving} className="flex-1 px-6 py-3 bg-primary-green text-white font-black rounded-xl hover:bg-green-700 transition-all shadow-md shadow-primary-green/20 flex items-center justify-center gap-2 uppercase tracking-widest text-xs">
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : editingRequirement ? 'Apply Changes' : 'Publish Requirement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {isTypeModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 md:p-6 bg-gray-950/40 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-xl max-h-[90vh] rounded-[2rem] md:rounded-[4rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            <div className="p-8 md:p-12 border-b-2 border-gray-50 flex items-center justify-between shrink-0">
              <h3 className="text-2xl md:text-3xl font-black text-gray-800 uppercase tracking-tighter">
                {editingType ? 'Modify Category' : 'New Category'}
              </h3>
              <button onClick={() => setIsTypeModalOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 transition-colors"><X size={28} /></button>
            </div>
            <form onSubmit={handleSaveType} className="p-8 md:p-12 space-y-8 overflow-y-auto flex-1 custom-scrollbar">
              <div className="space-y-3">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Category Name</label>
                <input
                  type="text" required placeholder="e.g. Mid-Year Reports"
                  className="w-full px-8 py-5 bg-gray-50 border-4 border-transparent rounded-[2rem] focus:bg-white focus:border-primary-green/20 outline-none transition-all font-black text-gray-700 text-lg shadow-inner"
                  value={typeFormData.name} onChange={(e) => setTypeFormData({ ...typeFormData, name: e.target.value })}
                />
              </div>
              <div className="space-y-3">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Short Description</label>
                <textarea
                  rows="3" placeholder="What documents are grouped here?"
                  className="w-full px-8 py-5 bg-gray-50 border-4 border-transparent rounded-[2rem] focus:bg-white focus:border-primary-green/20 outline-none transition-all resize-none font-bold text-gray-700 text-lg shadow-inner"
                  value={typeFormData.description} onChange={(e) => setTypeFormData({ ...typeFormData, description: e.target.value })}
                ></textarea>
              </div>
              <div className="space-y-3">
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Submission Mode</label>
                <select
                  className="w-full px-8 py-5 bg-gray-50 border-4 border-transparent rounded-[2rem] focus:bg-white focus:border-primary-green/20 outline-none transition-all font-bold text-gray-700 text-lg shadow-inner"
                  value={typeFormData.availability_type} onChange={(e) => setTypeFormData({ ...typeFormData, availability_type: e.target.value })}
                >
                  <option value="indefinite">Indefinite (Open all School Year)</option>
                  <option value="scheduled">Scheduled Window</option>
                </select>
              </div>
              <div className="flex items-center gap-4 px-4 bg-gray-50 p-6 rounded-[2rem] border-2 border-transparent hover:border-primary-green/20 transition-all cursor-pointer" onClick={() => setTypeFormData({ ...typeFormData, requires_eligibility: !typeFormData.requires_eligibility })}>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all ${typeFormData.requires_eligibility ? 'bg-primary-green text-white shadow-md shadow-primary-green/30' : 'bg-gray-200 text-transparent'}`}>
                  <Check size={20} strokeWidth={3} />
                </div>
                <div>
                  <h4 className="font-black text-gray-700 text-sm uppercase tracking-wider mb-1">Requires Eligibility</h4>
                  <p className="text-gray-400 text-xs font-bold leading-relaxed">Users must have approved requirements from the previous term/year (e.g., for Renewals)</p>
                </div>
              </div>

              {/* Scheduling Section */}
              <div className="border-t-2 border-gray-50 pt-8 space-y-6">
                
                {/* Submission Window */}
                {typeFormData.availability_type === 'scheduled' && (
                  <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                    <h5 className="font-bold text-sm text-gray-700 uppercase tracking-widest">Submission Window</h5>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Start Date</label>
                        <input 
                          type="date" 
                          className="w-full px-4 py-3 mt-1 bg-gray-50 rounded-xl outline-none focus:border-primary-green/40 border-2 border-transparent text-sm font-bold text-gray-700"
                          value={typeFormData.submissionWindow?.start_date || ''}
                          onChange={(e) => setTypeFormData({...typeFormData, submissionWindow: {...typeFormData.submissionWindow, start_date: e.target.value}})}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">End Date</label>
                        <input 
                          type="date" 
                          className="w-full px-4 py-3 mt-1 bg-gray-50 rounded-xl outline-none focus:border-primary-green/40 border-2 border-transparent text-sm font-bold text-gray-700"
                          value={typeFormData.submissionWindow?.end_date || ''}
                          onChange={(e) => setTypeFormData({...typeFormData, submissionWindow: {...typeFormData.submissionWindow, end_date: e.target.value}})}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Activity Blocks */}
                {typeFormData.name.toLowerCase().includes('activity proposal') && (
                  <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <h5 className="font-bold text-sm text-gray-700 uppercase tracking-widest">Blocked Activity Dates</h5>
                      <button 
                        type="button" 
                        onClick={() => setTypeFormData({...typeFormData, activityBlocks: [...typeFormData.activityBlocks, {start_date: '', end_date: ''}]})}
                        className="text-primary-green text-xs font-black uppercase flex items-center gap-1 hover:text-green-700"
                      >
                        <Plus size={14} /> Add Block
                      </button>
                    </div>
                    
                    {typeFormData.activityBlocks?.map((block, idx) => (
                      <div key={idx} className="flex items-center gap-4 bg-gray-50 p-4 rounded-xl">
                        <div className="flex-1">
                          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Block Start</label>
                          <input 
                            type="date" 
                            className="w-full px-3 py-2 mt-1 bg-white rounded-lg outline-none text-xs font-bold text-gray-700"
                            value={block.start_date || ''}
                            onChange={(e) => {
                              const newBlocks = [...typeFormData.activityBlocks];
                              newBlocks[idx].start_date = e.target.value;
                              setTypeFormData({...typeFormData, activityBlocks: newBlocks});
                            }}
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Block End</label>
                          <input 
                            type="date" 
                            className="w-full px-3 py-2 mt-1 bg-white rounded-lg outline-none text-xs font-bold text-gray-700"
                            value={block.end_date || ''}
                            onChange={(e) => {
                              const newBlocks = [...typeFormData.activityBlocks];
                              newBlocks[idx].end_date = e.target.value;
                              setTypeFormData({...typeFormData, activityBlocks: newBlocks});
                            }}
                          />
                        </div>
                        <button 
                          type="button" 
                          onClick={() => {
                            const newBlocks = typeFormData.activityBlocks.filter((_, i) => i !== idx);
                            setTypeFormData({...typeFormData, activityBlocks: newBlocks});
                          }}
                          className="text-red-400 hover:text-red-600 mt-5 p-2 bg-red-50 rounded-lg"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    {(!typeFormData.activityBlocks || typeFormData.activityBlocks.length === 0) && (
                      <p className="text-xs font-bold text-gray-400 text-center py-2">No activity blocks defined.</p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-8 pt-4">
                <button type="submit" disabled={isSaving} className="w-full py-6 bg-gray-800 text-white font-black rounded-3xl shadow-2xl shadow-gray-900/20 uppercase tracking-widest">
                  {isSaving ? <Loader2 size={24} className="animate-spin mx-auto" /> : editingType ? 'Update Category' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-[200] flex flex-col bg-gray-950/98 animate-in fade-in duration-500">
          <div className="flex items-center justify-between p-10 bg-black/20 backdrop-blur-xl">
            <h3 className="text-white font-black tracking-tighter text-3xl">Document Template</h3>
            <button onClick={() => { setIsPreviewOpen(false); setPreviewUrl(''); }} className="text-white p-4 hover:rotate-90 transition-all duration-300"><X size={48} /></button>
          </div>
          <div className="flex-1 p-10">
            <div className="bg-white mx-auto w-full max-w-7xl h-full rounded-[4rem] shadow-2xl overflow-hidden">
              {isPreviewLoading ? (
                <div className="w-full h-full flex items-center justify-center"><Loader2 className="h-20 w-20 animate-spin text-primary-green" /></div>
              ) : (
                <iframe src={`${previewUrl}#toolbar=0`} className="w-full h-full border-none" title="PDF" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* PDF Preview Modal Overlay */}
      {previewFile && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[120] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="bg-gray-50 border-b border-gray-100 px-8 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                  <Paperclip size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 text-lg">{previewFile.url.split('/').pop()}</h3>
                  <p className="text-gray-400 text-xs font-medium">Verify Template Document: {previewFile.title}</p>
                </div>
              </div>
              <button
                onClick={() => setPreviewFile(null)}
                className="p-2.5 hover:bg-gray-200 rounded-full transition-colors text-gray-400 hover:text-gray-800"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 flex flex-col overflow-hidden bg-gray-100 p-6">
              <div className="flex-1 bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-200/50 relative">
                {previewFile.url?.toLowerCase().includes('.pdf') ? (
                  <iframe
                    src={filePreviewUrl ? `${filePreviewUrl}#toolbar=1&navpanes=0&view=Fit` : ''}
                    className="w-full h-full border-0 rounded-2xl"
                    title="PDF Preview"
                  />
                ) : previewFile.url?.toLowerCase().includes('.docx') ? (
                  <iframe
                    src={filePreviewUrl ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(filePreviewUrl)}` : ''}
                    className="w-full h-full border-0 rounded-2xl"
                    title="DOCX Preview"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                    <FileText size={48} className="text-gray-300 mb-4 animate-bounce" />
                    <h4 className="font-bold text-gray-700 mb-1">Preview is not supported for this file type</h4>
                    <p className="text-gray-400 text-xs max-w-xs mb-4">You can download it to view locally on your device.</p>
                    <button
                      onClick={() => handleDownload(previewFile.url, `${previewFile.title}${previewFile.url.toLowerCase().endsWith('.docx') ? '.docx' : '.pdf'}`)}
                      className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-md inline-flex items-center gap-2"
                    >
                      <Download size={16} /> Download Template
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ListOfRequirements;
