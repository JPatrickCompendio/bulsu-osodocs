import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as subService from '../services/submissionService';
import * as reqService from '../services/requirementService';
import * as subtypeService from '../services/subtypeService';
import { supabase } from '../supabaseClient';
import { apiClient, apiUrl } from '../config/apiClient';
import {
  FileText, Upload, Send, Save, ArrowLeft, CheckCircle2,
  AlertCircle, Loader2, Info, Calendar, User, MapPin,
  Clock, Users, Search, ChevronRight, RefreshCcw, X,
  FileCheck, Download, Eye, Trash2, File as FileIcon,
  Eraser, Check, CheckSquare, Lock, Paperclip, Settings, FilePlus, ChevronDown, WifiOff
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import DEFAULT_HEADER_IMG from '../assets/HEADER.png';
import DEFAULT_FOOTER_IMG from '../assets/FOOTER.png';
import HEADER_LOGO_IMG from '../assets/headerLOGO.png';
import ActivityProposalPreviewModal from '../components/ActivityProposalPreviewModal';
import CustomDatePicker from '../components/CustomDatePicker';
import { calculateProposalDuration } from '../utils/submissionLogUtils';

const formatDateLocal = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getMinAllowedDate = () => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  let daysUntilNextMonday = 8 - dayOfWeek;
  if (dayOfWeek === 0) daysUntilNextMonday = 1;
  const minDate = new Date(today);
  minDate.setDate(today.getDate() + daysUntilNextMonday);
  return formatDateLocal(minDate);
};

const isAllowMultiple = (val) => {
  if (val === true || val === 1) return true;
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    return s === 'true' || s === '1' || s === 't' || s === 'yes';
  }
  return false;
};

const extractIncrementNumber = (val) => {
  if (!val) return '';
  const str = String(val).trim();
  if (str.includes('-')) {
    const parts = str.split('-');
    const lastPart = parts[parts.length - 1];
    if (!isNaN(parseInt(lastPart, 10))) {
      return lastPart;
    }
  }
  return str;
};

const fetchHistoricalAySnapshot = async (orgId, schoolYearId) => {
  if (!orgId || !schoolYearId) return null;
  try {
    const { data, error } = await supabase
      .from('organization_academic_years')
      .select('president_name, student_no, contact_no, adviser_name, co_advisers, no_member')
      .eq('organization_id', orgId)
      .eq('school_year_id', schoolYearId)
      .maybeSingle();
    if (!error && data) return data;
  } catch (err) {
    console.warn('Failed to fetch historical AY snapshot:', err);
  }
  return null;
};

const renderSignatureBlocksHtml = (proposalDetails, user, orgName) => {
  const allPeople = [];

  // 1. President
  const presidentName = (proposalDetails?.person_in_charge || user?.full_name || '').trim();
  allPeople.push({ name: presidentName, role: 'President' });

  // 2. Primary Adviser
  const primaryAdviser = (proposalDetails?.adviser_name || user?.adviser_name || '').trim();
  if (primaryAdviser) {
    allPeople.push({ name: primaryAdviser, role: 'Adviser' });
  }

  // 3. Co-Advisers
  const rawCoAdvisers = proposalDetails?.co_advisers || user?.co_advisers;
  if (rawCoAdvisers) {
    if (Array.isArray(rawCoAdvisers)) {
      rawCoAdvisers.forEach(item => {
        if (typeof item === 'string' && item.trim()) {
          const trimmed = item.trim();
          if (!allPeople.some(p => p.name === trimmed)) {
            allPeople.push({ name: trimmed, role: 'Adviser' });
          }
        }
      });
    } else if (typeof rawCoAdvisers === 'string') {
      try {
        const parsed = JSON.parse(rawCoAdvisers);
        if (Array.isArray(parsed)) {
          parsed.forEach(item => {
            if (typeof item === 'string' && item.trim()) {
              const trimmed = item.trim();
              if (!allPeople.some(p => p.name === trimmed)) {
                allPeople.push({ name: trimmed, role: 'Adviser' });
              }
            }
          });
        } else if (rawCoAdvisers.trim() && !allPeople.some(p => p.name === rawCoAdvisers.trim())) {
          allPeople.push({ name: rawCoAdvisers.trim(), role: 'Adviser' });
        }
      } catch {
        rawCoAdvisers.split(',').forEach(item => {
          const trimmed = item.trim();
          if (trimmed && !allPeople.some(p => p.name === trimmed)) {
            allPeople.push({ name: trimmed, role: 'Adviser' });
          }
        });
      }
    }
  }

  // If no advisers found, ensure at least 1 empty Adviser block
  if (allPeople.length === 1) {
    allPeople.push({ name: '', role: 'Adviser' });
  }

  // Chunk into rows of max 3 items
  const rows = [];
  for (let i = 0; i < allPeople.length; i += 3) {
    rows.push(allPeople.slice(i, i + 3));
  }

  return rows.map((rowItems, rowIndex) => `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; margin-top: ${rowIndex === 0 ? '18px' : '16px'}; margin-bottom: 10px;">
      ${rowItems.map(person => `
        <div style="flex: 1 1 30%; max-width: 32%; text-align: center;">
          <div style="border-bottom: 1.5px solid black; min-height: 16px; font-size: 10px; font-weight: bold; padding-bottom: 2px; margin-bottom: 2px; text-transform: uppercase; line-height: 1.2; word-break: break-word;">
            ${person.name}
          </div>
          <div style="font-size: 9px; font-style: italic;">(Signature over printed name)</div>
          <div style="font-size: 10px; margin-top: 2px; line-height: 1.2;">${person.role}, ${orgName}</div>
        </div>
      `).join('')}
      ${Array.from({ length: 3 - rowItems.length }).map(() => `
        <div style="flex: 1 1 30%; max-width: 32%; visibility: hidden;"></div>
      `).join('')}
    </div>
  `).join('');
};

const humanizeProposalType = (typeStr) => {
  if (!typeStr) return '';
  return String(typeStr)
    .split(/[-_]/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
};

const SubmitNewDocument = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  // Navigation & State
  const [view, setView] = useState('dashboard'); // 'dashboard' or 'form'
  const [selectedTypeForSubtypes, setSelectedTypeForSubtypes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [docTypes, setDocTypes] = useState([]);
  const [reqCounts, setReqCounts] = useState({}); // Dynamic counts
  const [availability, setAvailability] = useState({}); // Document availability from system
  const [blockedEvents, setBlockedEvents] = useState([]); // Blocked activity dates
  const [globalWarning, setGlobalWarning] = useState(''); // School Year bounds warning
  const [selectedType, setSelectedType] = useState(null);
  const [subType, setSubType] = useState('');
  const [selectedSubtypeObj, setSelectedSubtypeObj] = useState(null);
  const [requirements, setRequirements] = useState([]);
  const [docSubtypes, setDocSubtypes] = useState({}); // Mapping from docTypeId -> active subtypes

  // UI States
  const [showClearModal, setShowClearModal] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [networkErrorModal, setNetworkErrorModal] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);
  const [toast, setToast] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isActivityPreviewOpen, setIsActivityPreviewOpen] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [activeSchoolYearId, setActiveSchoolYearId] = useState(null);
  const [scheduleMode, setScheduleMode] = useState('single'); // 'single', 'multiple', 'range'
  const [proposalStep, setProposalStep] = useState(1);
  const [hasDownloadedProposal, setHasDownloadedProposal] = useState(false);
  const [loadedSubmission, setLoadedSubmission] = useState(null);
  const initialFormSnapshotRef = useRef(null);
  const [returnedReqIds, setReturnedReqIds] = useState(new Set());
  const [approvedReqIds, setApprovedReqIds] = useState(new Set());
  const [is02F1Returned, setIs02F1Returned] = useState(false);

  // Scroll behavior state
  const [showHeader, setShowHeader] = useState(true);
  const lastScrollY = useRef(0);
  const formRef = useRef(null);

  useEffect(() => {
    // Automatically scroll to top when stepper phase changes
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    if (formRef.current) {
      const getScrollParent = (node) => {
        if (node == null || node === document.body || node === document.documentElement) return window;
        const overflowY = window.getComputedStyle(node).overflowY;
        const isScrollable = overflowY !== 'visible' && overflowY !== 'hidden';
        if (isScrollable && node.scrollHeight > node.clientHeight) {
          return node;
        }
        return getScrollParent(node.parentNode);
      };
      const scrollParent = getScrollParent(formRef.current);
      if (scrollParent && scrollParent !== window && typeof scrollParent.scrollTo === 'function') {
        scrollParent.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }, [proposalStep, view]);

  useEffect(() => {
    const handleOffline = () => {
      setNetworkErrorModal({
        title: 'Internet Connection Lost',
        message: 'You are currently offline. Please check your network connection and try again.'
      });
      isSavingRef.current = false;
      setIsSaving(false);
    };

    const handleUnhandledRejection = (event) => {
      const reasonStr = String(event?.reason?.message || event?.reason || '').toLowerCase();
      if (
        reasonStr.includes('err_internet_disconnected') ||
        reasonStr.includes('failed to fetch') ||
        reasonStr.includes('networkerror') ||
        reasonStr.includes('network error')
      ) {
        setNetworkErrorModal({
          title: 'Connection Lost / Network Issue',
          message: 'A network request failed because internet connection was lost or interrupted. Please check your network connection and try again.'
        });
        isSavingRef.current = false;
        setIsSaving(false);
      }
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    if (!formRef.current) return;

    // Find the closest scrollable ancestor
    const getScrollParent = (node) => {
      if (node == null || node === document.body || node === document.documentElement) return window;
      const overflowY = window.getComputedStyle(node).overflowY;
      const isScrollable = overflowY !== 'visible' && overflowY !== 'hidden';
      if (isScrollable && node.scrollHeight > node.clientHeight) {
        return node;
      }
      return getScrollParent(node.parentNode);
    };

    const scrollParent = getScrollParent(formRef.current);

    const handleScroll = (e) => {
      const target = e.target;
      const currentScrollY = scrollParent === window ? window.scrollY : scrollParent.scrollTop;

      if (currentScrollY > lastScrollY.current && currentScrollY > 90) {
        setShowHeader(false); // Scroll down: hide header
      } else if (currentScrollY < lastScrollY.current - 5) {
        setShowHeader(true); // Scroll up: show header
      }
      lastScrollY.current = currentScrollY;
    };

    scrollParent.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollParent.removeEventListener('scroll', handleScroll);
  }, [view]);

  // Print Images State
  const [headerBase64, setHeaderBase64] = useState('');
  const [footerBase64, setFooterBase64] = useState('');
  const [blockedDateModal, setBlockedDateModal] = useState(null);
  const [validationErrorModal, setValidationErrorModal] = useState(null);

  const getBase64 = (src) => new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(null);
  });

  useEffect(() => {
    const loadDefaultImages = async () => {
      if (!headerBase64) setHeaderBase64(await getBase64(DEFAULT_HEADER_IMG));
      if (!footerBase64) setFooterBase64(await getBase64(DEFAULT_FOOTER_IMG));
    };
    loadDefaultImages();
  }, []);
  const isSuspended = user?.status?.startsWith('Suspended') && user?.role === 'org-president';

  useEffect(() => {
    if (isSuspended) {
      apiClient.get(apiUrl('/api/system/admin-email'))
        .then(res => {
          if (res.data?.email) {
            setAdminEmail(res.data.email);
          }
        })
        .catch(err => console.error('Error fetching admin email:', err));
    }
  }, [isSuspended]);

  // Form Data
  const defaultForm = {
    activity_number: '', organization_name: '', adviser_name: '', activity_title: '',
    person_in_charge: '', student_id_no: '', contact_number: '', target_venue: '',
    target_date: '', target_time: '', target_end_time: '', duration: '', is_indefinite_end_time: false, number_of_students: '',
    activity_dates: [], // Multi-date selection
    schedules: [{ activity_date: '', start_time: '', end_time: '', is_indefinite: false, duration_minutes: 0 }], // Single date schedule default
    target_audience: '', nature_of_activity: '', objectives: [], others_objective: '',
    satisfaction_goal_1: '', satisfaction_goal_2: '', satisfaction_goal_3: '', partners: '', sponsors: ''
  };
  const [proposalDetails, setProposalDetails] = useState(defaultForm);
  const [localFiles, setLocalFiles] = useState({}); // Stores actual File objects before uploading
  const [existingAttachments, setExistingAttachments] = useState([]);
  const [activeDraft, setActiveDraft] = useState({ submissionId: null, versionId: null });
  const [draftNotice, setDraftNotice] = useState('');
  const [draftLoadedFields, setDraftLoadedFields] = useState(new Set());
  const [isNewDraftThisSession, setIsNewDraftThisSession] = useState(false);
  const [pendingNavPath, setPendingNavPath] = useState(null);
  const location = useLocation();

  const ensureArrayOfStrings = (val) => {
    if (!val) return [];
    let res = val;

    if (typeof res === 'string') {
      const trimmed = res.trim();
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          res = JSON.parse(trimmed);
        } catch (e) {
          res = [trimmed];
        }
      } else if (trimmed.includes(',')) {
        res = trimmed.split(',').map((s) => s.trim()).filter(Boolean);
      } else if (trimmed) {
        res = [trimmed];
      } else {
        res = [];
      }
    }

    if (Array.isArray(res)) {
      const isShredded = res.length > 1 && res.every((x) => typeof x === 'string' && x.length <= 1);
      if (isShredded) {
        const joined = res.join('');
        if (joined.startsWith('[') && joined.endsWith(']')) {
          try {
            const parsed = JSON.parse(joined);
            if (Array.isArray(parsed)) return parsed.map((s) => String(s).trim()).filter(Boolean);
          } catch (e) {
            // ignore
          }
        }
        return [joined.replace(/^[\["'\s]+|[\]"'\s]+$/g, '').trim()].filter(Boolean);
      }
      return res.map((s) => String(s).trim()).filter(Boolean);
    }

    return [];
  };

  const clearDraftField = (fieldName) => {
    setDraftLoadedFields(prev => {
      if (!prev.has(fieldName)) return prev;
      const next = new Set(prev);
      next.delete(fieldName);
      return next;
    });
  };

  const populateDraftFields = (details) => {
    if (!details) return;
    const loadedSet = new Set();
    const keysToCheck = [
      'activity_title',
      'contact_number',
      'target_venue',
      'number_of_students',
      'target_audience',
      'nature_of_activity',
      'objectives',
      'others_objective',
      'satisfaction_goal_1',
      'satisfaction_goal_2',
      'satisfaction_goal_3',
      'partners',
      'sponsors'
    ];

    keysToCheck.forEach(key => {
      const val = details[key];
      if (val !== undefined && val !== null && val !== '') {
        if (Array.isArray(val) && val.length === 0) return;
        loadedSet.add(key);
      }
    });

    if ((details.activity_schedules && details.activity_schedules.length > 0) || details.target_date) {
      loadedSet.add('schedules');
    }

    setDraftLoadedFields(loadedSet);
  };

  useEffect(() => {
    if (proposalDetails.target_audience === 'Members only' && !proposalDetails.number_of_students && user?.no_member) {
      setProposalDetails(prev => ({
        ...prev,
        number_of_students: String(user.no_member)
      }));
    }
  }, [proposalDetails.target_audience, user?.no_member]);

  useEffect(() => {
    window.__hasUnsavedChanges = hasUnsavedChanges;
    return () => {
      window.__hasUnsavedChanges = false;
    };
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const handleSidebarNav = (e) => {
      const targetPath = e.detail?.path;
      if (targetPath) {
        if (view === 'form' && hasUnsavedChanges) {
          setPendingNavPath(targetPath);
          setShowUnsavedModal(true);
        } else {
          setPendingNavPath(null);
          setShowUnsavedModal(false);
          setHasUnsavedChanges(false);
          window.__hasUnsavedChanges = false;
          navigate(targetPath);
        }
      }
    };
    window.addEventListener('sidebar-nav-click', handleSidebarNav);
    return () => window.removeEventListener('sidebar-nav-click', handleSidebarNav);
  }, [view, hasUnsavedChanges, navigate]);

  useEffect(() => {
    loadDocumentTypes();
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const validateDateSelection = (val) => {
    if (!val) return true;
    const checkVal = val.split('T')[0];
    const minAllowedStr = getMinAllowedDate();

    // 1. Current Work Week restriction
    if (checkVal < minAllowedStr) {
      let formattedDateStr = checkVal;
      try {
        const parts = checkVal.split('-');
        if (parts.length === 3) {
          const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          formattedDateStr = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        }
      } catch (e) {}

      setBlockedDateModal({
        date: formattedDateStr,
        title: "Current Work Week Restriction",
        reason: `${formattedDateStr} is unavailable. Activities must be scheduled in advance and cannot be set within the current work week.`
      });
      return false;
    }

    // 2. Academic Calendar Event restriction
    const matchingEvent = (blockedEvents || []).find(ev => {
      if (ev.document_type_id && selectedType?.id && ev.document_type_id !== selectedType?.id) return false;
      const evStart = ev.start_date ? ev.start_date.split('T')[0] : '';
      const evEnd = ev.end_date ? ev.end_date.split('T')[0] : evStart;
      if (!evStart) return false;
      return checkVal >= evStart && checkVal <= evEnd;
    });

    if (matchingEvent) {
      let formattedDateStr = checkVal;
      try {
        const parts = checkVal.split('-');
        if (parts.length === 3) {
          const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          formattedDateStr = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        }
      } catch (e) {}

      let rawTitle = matchingEvent.title || matchingEvent.event_name || 'Academic Calendar Event';
      if (rawTitle.toUpperCase() === 'BLOCKS_ACTIVITY' || rawTitle === 'BLOCK_ACTIVITY') {
        rawTitle = matchingEvent.event_name || 'Academic Calendar Event';
      }

      let rawReason = matchingEvent.description || matchingEvent.reason || '';
      if (!rawReason || rawReason.trim() === '' || rawReason.toUpperCase().includes('BLOCKS_ACTIVITY') || rawReason.includes('_')) {
        rawReason = `${formattedDateStr} is blocked because of ${rawTitle}.`;
      } else if (!rawReason.includes(rawTitle)) {
        rawReason = `${formattedDateStr} is blocked because of ${rawTitle}. (${rawReason})`;
      }

      setBlockedDateModal({
        date: formattedDateStr,
        title: rawTitle,
        reason: rawReason
      });
      return false;
    }

    return true;
  };

  const isProposal = selectedType?.name.toLowerCase().includes('activity proposal');

  const isActivityProposalFormComplete = useMemo(() => {
    if (!isProposal) return false;
    const {
      activity_title, contact_number, target_venue, schedules,
      number_of_students, target_audience, nature_of_activity, objectives,
      others_objective, satisfaction_goal_1, satisfaction_goal_2, satisfaction_goal_3
    } = proposalDetails;

    if (!activity_title?.trim()) return false;
    if (!contact_number?.trim()) return false;
    if (!target_venue?.trim()) return false;

    if (!schedules || schedules.length === 0) return false;
    for (const sched of schedules) {
      if (!sched.activity_date) return false;
      if (scheduleMode === 'range') {
        if (!sched.end_date) return false;
      } else {
        if (!sched.start_time) return false;
        if (!sched.is_indefinite && !sched.end_time) return false;
      }
    }

    const safeObjs = ensureArrayOfStrings(objectives);
    if (!String(number_of_students || '').trim()) return false;
    if (!target_audience?.trim()) return false;
    if (!nature_of_activity?.trim()) return false;
    if (safeObjs.length === 0) return false;
    if (safeObjs.includes('Others') && !others_objective?.trim()) return false;
    if (!satisfaction_goal_1?.trim()) return false;
    return true;
  }, [isProposal, proposalDetails]);

  const [showValidationHighlights, setShowValidationHighlights] = useState(false);

  const isFieldSkipped = (key) => {
    const {
      activity_title, contact_number, target_venue, schedules,
      number_of_students, target_audience, nature_of_activity, objectives,
      others_objective, satisfaction_goal_1
    } = proposalDetails;

    if (key === 'activity_title') return !activity_title?.trim();
    if (key === 'contact_number') return !contact_number?.trim() || !/^09\d{9}$/.test(contact_number.trim());
    if (key === 'target_venue') return !target_venue?.trim();
    if (key === 'number_of_students') return !String(number_of_students || '').trim();
    if (key === 'target_audience') return !target_audience?.trim();
    if (key === 'nature_of_activity') return !nature_of_activity?.trim();
    if (key === 'objectives') {
      const safeObjs = ensureArrayOfStrings(objectives);
      if (safeObjs.length === 0) return true;
      if (safeObjs.includes('Others') && !others_objective?.trim()) return true;
      return false;
    }
    if (key === 'satisfaction_goal_1') return !satisfaction_goal_1?.trim();
    if (key === 'schedules') {
      if (!schedules || schedules.length === 0) return true;
      for (const sched of schedules) {
        if (!sched.activity_date) return true;
        if (scheduleMode === 'range') {
          if (!sched.end_date) return true;
        } else {
          if (!sched.start_time) return true;
          if (!sched.is_indefinite && !sched.end_time) return true;
        }
      }
      return false;
    }
    return false;
  };

  const validateStep1Detailed = () => {
    const missing = [];
    const {
      activity_title, contact_number, target_venue, schedules,
      number_of_students, target_audience, nature_of_activity, objectives,
      others_objective, satisfaction_goal_1
    } = proposalDetails;

    if (!activity_title?.trim()) {
      missing.push({ field: 'Activity Title', message: 'Please enter the title of the activity.' });
    }

    if (!contact_number?.trim()) {
      missing.push({ field: 'Contact Number', message: 'Please enter an 11-digit mobile contact number (e.g., 09123456789).' });
    } else if (!/^09\d{9}$/.test(contact_number.trim())) {
      missing.push({ field: 'Contact Number', message: 'Contact number must be an 11-digit number starting with 09 (e.g., 09123456789).' });
    }

    if (!target_venue?.trim()) {
      missing.push({ field: 'Target Venue', message: 'Please enter the target venue for the activity.' });
    }

    if (!schedules || schedules.length === 0) {
      missing.push({ field: 'Activity Schedule', message: 'At least one activity schedule date must be set.' });
    } else {
      schedules.forEach((sched, idx) => {
        const schedLabel = schedules.length > 1 ? `Schedule #${idx + 1}` : 'Activity Schedule';
        if (!sched.activity_date) {
          missing.push({ field: `${schedLabel} Date`, message: 'Please select an activity date.' });
        }
        if (scheduleMode === 'range') {
          if (!sched.end_date) {
            missing.push({ field: `${schedLabel} End Date`, message: 'Please select an end date for the date range.' });
          }
        } else {
          if (!sched.start_time) {
            missing.push({ field: `${schedLabel} Start Time`, message: 'Please specify the start time.' });
          }
          if (!sched.is_indefinite) {
            if (!sched.end_time) {
              missing.push({ field: `${schedLabel} End Time`, message: 'Please specify the end time or select "Indefinite".' });
            } else if (sched.start_time && sched.end_time && sched.start_time === sched.end_time) {
              missing.push({ field: `${schedLabel} Time Range`, message: 'End time cannot be the exact same as start time.' });
            }
          }
        }
      });
    }

    if (!String(number_of_students || '').trim()) {
      missing.push({ field: 'Number of Students Involved', message: 'Please enter the expected number of participants.' });
    }

    if (!target_audience?.trim()) {
      missing.push({ field: 'Target Audience', message: 'Please select a target audience (e.g., Members only, BulSUans only, Open to public).' });
    }

    if (!nature_of_activity?.trim()) {
      missing.push({ field: 'Nature of Activity', message: 'Please select the nature of activity (Co-Curricular or Extra-Curricular).' });
    }

    const safeObjs = ensureArrayOfStrings(objectives);
    if (safeObjs.length === 0) {
      missing.push({ field: 'Objectives of the Activity', message: 'Please select at least one objective for the activity.' });
    } else if (safeObjs.includes('Others') && !others_objective?.trim()) {
      missing.push({ field: 'Other Objective Specification', message: 'You selected "Others" under Objectives. Please specify the objective.' });
    }

    if (!satisfaction_goal_1?.trim()) {
      missing.push({ field: 'Needs and Goals (Item #1)', message: 'Please describe how this activity satisfies organizational needs/goals in Item #1.' });
    }

    return missing;
  };

  const handleNextFromStep1 = () => {
    const missing = validateStep1Detailed();
    if (missing.length > 0) {
      setShowValidationHighlights(true);
      if (typeof showToast === 'function') {
        const firstErr = missing[0];
        showToast(`${firstErr.field}: ${firstErr.message}`, 'error');
      }
      setTimeout(() => {
        const firstSkipped = document.querySelector('.skipped-field-highlight');
        if (firstSkipped) {
          firstSkipped.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      return;
    }
    setShowValidationHighlights(false);
    setProposalStep(2);
  };

  const handlePrintActivityProposal = () => {
    const printIframe = document.createElement('iframe');
    printIframe.style.position = 'absolute';
    printIframe.style.width = '0px';
    printIframe.style.height = '0px';
    printIframe.style.border = 'none';
    document.body.appendChild(printIframe);

    const doc = printIframe.contentWindow.document;

    const renderCheckbox = (label, isChecked) => `
      <div style="display: flex; align-items: center; margin-right: 30px; font-size: 13px; font-weight: bold; margin-bottom: 8px;">
        <div style="display: flex; justify-content: center; align-items: center; width: 14px; height: 14px; border: 1.5px solid black; margin-right: 8px; font-size: 14px; flex-shrink: 0;">
          ${isChecked ? '✓' : ''}
        </div>
        ${label}
      </div>
    `;

    const getObjectiveChecked = (val) => ensureArrayOfStrings(proposalDetails.objectives).includes(val);

    const formatTime = (t) => {
      if (!t || t === 'TBD') return 'TBD';
      try {
        const [h, m] = t.split(':');
        let hours = parseInt(h, 10);
        const suffix = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        return `${hours}:${m} ${suffix}`;
      } catch (e) { return t; }
    };

    const formatDuration = (mins) => {
      if (!mins) return '';
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      let res = [];
      if (h > 0) res.push(`${h} hour${h > 1 ? 's' : ''}`);
      if (m > 0) res.push(`${m} minute${m > 1 ? 's' : ''}`);
      return res.join(' and ') || '';
    };

    const orgName = proposalDetails.organization_name || user?.organization_name || user?.organization || 'Student Organization';

    doc.open();
    doc.write(`
      <html>
        <head>
          <title>Activity Proposal Form</title>
          <style>
            @media print {
              html, body { height: 100%; margin: 0; padding: 0; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              @page { margin: 4mm 6mm; size: A4 portrait; }
              .print-wrapper { display: flex; flex-direction: column; min-height: 280mm; box-sizing: border-box; position: relative; }
              .official-document-footer {
                position: fixed !important;
                bottom: 2mm !important;
                left: 6mm !important;
                right: 6mm !important;
                width: auto !important;
                background: white !important;
              }
            }
            body { font-family: Arial, Helvetica, sans-serif; color: black; background: white; margin: 0; font-size: 11.5px; }
            .form-row { display: flex; align-items: flex-end; margin-bottom: 7px; }
            .form-label { font-weight: bold; font-size: 11.5px; margin-right: 5px; white-space: nowrap; }
            .form-line { flex-grow: 1; border-bottom: 1.5px solid black; min-height: 14px; font-size: 11.5px; font-weight: normal; padding-bottom: 1px; text-align: left; padding-left: 8px; }
            .section-title { font-weight: bold; font-size: 11.5px; margin-top: 8px; margin-bottom: 4px; }
          </style>
        </head>
        <body>
          <div class="print-wrapper" style="padding: 0px 5px; display: flex; flex-direction: column; min-height: 280mm; box-sizing: border-box;">
            <div style="text-align: center; margin-bottom: 6px;">
              <img src="${HEADER_LOGO_IMG}" style="height: 70px; width: auto; object-fit: contain; margin: 0 auto; display: block;" alt="BulSU Logo" />
            </div>

            <div style="text-align: center; font-size: 15px; font-weight: bold; margin-bottom: 28px;">Activity Proposal Form</div>
            
            <div class="form-row">
              <div class="form-label">Name of Student Organization:</div>
              <div class="form-line">${proposalDetails.organization_name || ''}</div>
            </div>
            <div class="form-row">
              <div class="form-label">Name of Adviser:</div>
              <div class="form-line">${proposalDetails.adviser_name || ''}</div>
            </div>
            <div class="form-row">
              <div class="form-label">Activity Number:</div>
              <div class="form-line">${proposalDetails.activity_number || ''}</div>
            </div>
            <div class="form-row">
              <div class="form-label">Activity Title:</div>
              <div class="form-line">${proposalDetails.activity_title || ''}</div>
            </div>
            <div class="form-row">
              <div class="form-label">Name of Person-in-Charge:</div>
              <div class="form-line" style="flex-grow: 0.6; margin-right: 15px;">${proposalDetails.person_in_charge || ''}</div>
              <div class="form-label">Student ID No.:</div>
              <div class="form-line">${proposalDetails.student_id_no || ''}</div>
            </div>
            <div class="form-row">
              <div class="form-label">Contact Number of Person-in-Charge:</div>
              <div class="form-line">${proposalDetails.contact_number || ''}</div>
            </div>
            <div class="form-row">
              <div class="form-label">Target Venue:</div>
              <div class="form-line">${proposalDetails.target_venue || ''}</div>
            </div>
            <div class="form-row">
              <div class="form-label">Target Date and Time:</div>
              <div class="form-line">
                ${(proposalDetails.schedules || []).map(s => {
                  if (s.end_date && s.activity_date) {
                    return `${new Date(s.activity_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} to ${new Date(s.end_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
                  }
                  if (s.activity_date) {
                    const timeStr = s.is_indefinite ? 'INDEFINITE' : `${formatTime(s.start_time)} - ${formatTime(s.end_time)}`;
                    return `${new Date(s.activity_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} (${timeStr})`;
                  }
                  return '';
                }).filter(Boolean).join('; ') || (proposalDetails.target_date || '')}
              </div>
            </div>
            <div class="form-row">
              <div class="form-label">Duration:</div>
              <div class="form-line">${calculateProposalDuration(proposalDetails)}</div>
            </div>
            <div class="form-row">
              <div class="form-label">Number of Student Involved:</div>
              <div class="form-line">${proposalDetails.number_of_students || ''}</div>
            </div>

            <div class="section-title">Target Audience/Participants:</div>
            <div style="margin-left: 20px; margin-bottom: 6px; display: flex;">
              ${renderCheckbox('Members only', proposalDetails.target_audience === 'Members only')}
              ${renderCheckbox('BulSUans only', proposalDetails.target_audience === 'BulSUans only')}
              ${renderCheckbox('Open to the public', proposalDetails.target_audience === 'Open to the public')}
            </div>

            <div class="section-title">Nature of Activity:</div>
            <div style="margin-left: 20px; margin-bottom: 6px; display: flex;">
              ${renderCheckbox('Co-Curricular', proposalDetails.nature_of_activity === 'Co-Curricular')}
              ${renderCheckbox('Extra-Curricular', proposalDetails.nature_of_activity === 'Extra-Curricular')}
            </div>

            <div class="section-title">Objectives of the Activity:</div>
            <div style="margin-left: 20px; margin-bottom: 8px; display: flex; flex-direction: column;">
              ${renderCheckbox('Leadership Development and Formation', getObjectiveChecked('Leadership Development and Formation'))}
              ${renderCheckbox('Membership Development and Formation', getObjectiveChecked('Membership Development and Formation'))}
              ${renderCheckbox('Organizational Program Management', getObjectiveChecked('Organizational Program Management'))}
              ${renderCheckbox('Values Enrichment', getObjectiveChecked('Values Enrichment'))}
              ${renderCheckbox('Skills Enhancement', getObjectiveChecked('Skills Enhancement'))}
              <div class="form-row" style="margin-top: 2px; margin-bottom: 0;">
                ${renderCheckbox('Others:', getObjectiveChecked('Others'))}
                <div class="form-line" style="margin-left: -20px; text-align: left;">${proposalDetails.others_objective || ''}</div>
              </div>
            </div>

            <div style="font-size: 11px; margin-left: 30px; margin-top: 8px; margin-bottom: 6px;">
              Describe how this activity will satisfy the needs of the organization and how it will help the<br/>organization achieve its goals:
            </div>
            <div class="form-row" style="margin-left: 30px;"><div class="form-label">1.</div><div class="form-line" style="text-align: left;">${proposalDetails.satisfaction_goal_1 || ''}</div></div>
            <div class="form-row" style="margin-left: 30px;"><div class="form-label">2.</div><div class="form-line" style="text-align: left;">${proposalDetails.satisfaction_goal_2 || ''}</div></div>
            <div class="form-row" style="margin-left: 30px;"><div class="form-label">3.</div><div class="form-line" style="text-align: left;">${proposalDetails.satisfaction_goal_3 || ''}</div></div>

            <div style="margin-top: 10px;">
              <div class="form-row">
                <div class="form-label">Name of Partners (if any):</div>
                <div class="form-line" style="text-align: left;">${proposalDetails.partners || ''}</div>
              </div>
              <div class="form-row">
                <div class="form-label">Name of Sponsors (if any):</div>
                <div class="form-line" style="text-align: left;">${proposalDetails.sponsors || ''}</div>
              </div>
            </div>

          ${renderSignatureBlocksHtml(proposalDetails, user, orgName)}

            <!-- Official Document Footer pinned to bottom -->
            <div class="official-document-footer" style="margin-top: auto; padding-top: 4px; font-family: Arial, Helvetica, sans-serif;">
              <div style="border-top: 1px solid #000; width: 100%; margin-bottom: 4px;"></div>
              <div style="text-align: center; font-size: 8.5px; font-weight: bold; color: #000; margin-bottom: 4px; line-height: 1.2;">
                Office of the Student Organizations- Ground Floor, Roxas Hall, Bulacan State University, City of Malolos, Bulacan Tel No. (044)919-7800 loc.1077
              </div>
              <div style="display: flex; justify-content: space-between; align-items: flex-start; font-size: 8.5px; font-weight: bold; color: #000;">
                <div>
                  <div>BulSU-OP-OSO-02F1</div>
                  <div>Revision: 1</div>
                </div>
                <div style="text-align: right;">
                  Page 1 of 1
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `);
    doc.close();

    printIframe.contentWindow.focus();
    setTimeout(() => {
      printIframe.contentWindow.print();
      setTimeout(() => {
        document.body.removeChild(printIframe);
      }, 2000);
    }, 500);
  };



  const loadDocumentTypes = async () => {
    try {
      const types = await reqService.fetchDocumentTypes();
      setDocTypes(types || []);

      // Fetch dynamic requirement counts
      const reqs = await supabase.from('requirements').select('documentTypeID, subtype_id');
      const counts = {};
      if (reqs.data) {
        reqs.data.forEach(r => {
          const key = r.subtype_id ? `${r.documentTypeID}-${r.subtype_id}` : r.documentTypeID;
          counts[key] = (counts[key] || 0) + 1;
        });
      }
      setReqCounts(counts);

      // Fetch all active subtypes for these document types
      const subtypesRes = await supabase
        .from('document_subtypes')
        .select('*')
        .eq('status', 'active')
        .order('sort_order', { ascending: true });

      if (subtypesRes.data) {
        const subtypesMap = {};
        subtypesRes.data.forEach(st => {
          if (!subtypesMap[st.document_type_id]) subtypesMap[st.document_type_id] = [];
          subtypesMap[st.document_type_id].push(st);
        });
        setDocSubtypes(subtypesMap);
      }

      // Always fetch blocked calendar events directly
      const { data: bEvents } = await supabase
        .from('academic_calendar_events')
        .select('*')
        .or('event_type.eq.blocked_activity,description.eq.BLOCKS_ACTIVITY');
      if (bEvents) {
        setBlockedEvents(bEvents);
      }

      // Fetch document availability
      if (user?.id) {
        const availRes = await apiClient.get(apiUrl('/api/system/document-availability'), {
          params: { userId: user.id },
        });
        if (availRes.data?.success) {
          let frontendAvailability = availRes.data.availability || {};
          if (availRes.data.blockedEvents && availRes.data.blockedEvents.length > 0) {
            setBlockedEvents(availRes.data.blockedEvents);
          }
          const sy = availRes.data.activeSchoolYear;

          if (!sy || availRes.data.message === 'The current date is outside the active School Year.') {
            setGlobalWarning(availRes.data.message || 'No active school year configured.');
            setAvailability(frontendAvailability);
          } else {
            setActiveSchoolYearId(sy.id);
            setAvailability(frontendAvailability);
          }
        }
      }
    } catch (err) {
      showToast('Failed to load categories', 'error');
    } finally {
      setLoading(false);
    }
  };

  const humanizeProposalType = (type) => {
    if (!type) return '';
    return type.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const getAttachedRequirementIds = () => {
    const existingIds = existingAttachments.map((item) => item.requirement_id);
    const uploadedIds = Object.keys(localFiles).map((key) => Number(key));
    return new Set([...existingIds, ...uploadedIds]);
  };

  const loadSubmissionById = async (submissionId) => {
    setLoading(true);
    try {
      const result = await subService.getSubmissionById(submissionId);
      if (!result) {
        showToast('Could not find saved draft.', 'error');
        return;
      }

      const { submission, version } = result;
      console.debug('Loaded submission for editing:', { submission, version });
      let type = submission.documentType;
      if (!type && submission.document_type_id) {
        const { data: dtData } = await supabase.from('document_types').select('*').eq('id', submission.document_type_id).maybeSingle();
        type = dtData;
      }
      if (!type) {
        showToast('Document type information is missing for this submission.', 'error');
        return;
      }

      const isProposal = type?.name?.toLowerCase().includes('activity proposal');
      const rawDetails = version?.activity_proposal_details;
      const details = (Array.isArray(rawDetails) ? rawDetails[0] : rawDetails) || {};

      const proposalTypeStr = isProposal ? humanizeProposalType(submission?.proposal_type) : '';
      let subtypeId = submission?.subtype_id || null;
      let matchedSubtype = null;

      if (!subtypeId && proposalTypeStr) {
        // Fallback mapping for existing records without subtype_id
        const stRes = await supabase.from('document_subtypes').select('*').eq('document_type_id', type.id).eq('name', proposalTypeStr).maybeSingle();
        if (stRes.data) {
          subtypeId = stRes.data.id;
          matchedSubtype = stRes.data;
        }
      } else if (subtypeId) {
        const stRes = await supabase.from('document_subtypes').select('*').eq('id', subtypeId).maybeSingle();
        if (stRes.data) matchedSubtype = stRes.data;
      }

      const subtypeName = matchedSubtype ? matchedSubtype.name : proposalTypeStr;

      const reqs = await subService.getRequirementsForType(type.id, subtypeId, isProposal ? subtypeName : null);

      setRequirements(reqs || []);
      setSelectedType(type);
      setSubType(subtypeName);
      setSelectedSubtypeObj(matchedSubtype);
      setExistingAttachments(version?.submission_attachments || []);
      setActiveDraft({ submissionId: submission.id, versionId: version?.id });
      setLoadedSubmission(submission);
      setDraftNotice('');
      populateDraftFields(details);

      let finalFormObject = { ...defaultForm };
      if (isProposal) {
        const scheds = details.activity_schedules || [];

        let inferredMode = 'single';
        if (scheds.length > 1) {
          inferredMode = 'multiple';
        } else if (scheds.length === 1 && scheds[0].end_date) {
          inferredMode = 'range';
        }
        setScheduleMode(inferredMode);

        finalFormObject = {
          ...defaultForm,
          ...details,
          objectives: ensureArrayOfStrings(details.objectives),
          schedules: scheds.length > 0 ? scheds : (details.target_date ? details.target_date.split(',').map(d => ({
            activity_date: d.trim(),
            start_time: details.target_time || '',
            end_time: details.target_end_time || '',
            is_indefinite: details.is_indefinite_end_time || false,
            duration_minutes: details.duration ? Math.round(parseFloat(details.duration) * 60) : 0
          })).filter(s => s.activity_date) : []),
          activity_dates: details.target_date ? details.target_date.split(',').map(d => d.trim()).filter(Boolean) : [],
          activity_number: extractIncrementNumber(details.activity_number) || await fetchNextActivityNumber(),
          organization_name: details.organization_name || user?.org_name || '',
          adviser_name: details.adviser_name || user?.adviser_name || '',
          person_in_charge: details.person_in_charge || user?.full_name || '',
          student_id_no: details.student_id_no || user?.student_no || '',
          contact_number: details.contact_number || user?.contact_no || ''
        };
        setProposalDetails(finalFormObject);
      } else {
        finalFormObject = {
          ...defaultForm,
          organization_name: user?.org_name || '',
          adviser_name: user?.adviser_name || '',
          person_in_charge: user?.full_name || '',
          student_id_no: user?.student_no || '',
          contact_number: user?.contact_no || ''
        };
        setProposalDetails(finalFormObject);
      }

      initialFormSnapshotRef.current = JSON.stringify(finalFormObject);
      savedStateRef.current = {
        files: '[]',
        details: JSON.stringify(finalFormObject)
      };
      setHasUnsavedChanges(false);
      window.__hasUnsavedChanges = false;
      setLocalFiles({});

      // Evaluate review logs for returned vs approved attachments
      const isReturnedSub = String(submission.status || '').toLowerCase() === 'returned';
      const { data: logsData } = await supabase
        .from('submission_logs')
        .select('*')
        .eq('submission_id', submission.id)
        .order('created_at', { ascending: false });

      const versionAttachments = version?.submission_attachments || [];
      const returnedSet = new Set();
      const approvedSet = new Set();
      const RETURN_REASONS = ['missing-requirements', 'incorrect-format', 'incomplete-information', 'returned', 'revisions-required', 'disapproved'];

      // Check if any attachment has an explicit returned log
      const hasExplicitReturnedAttLog = versionAttachments.some((att) => {
        const fileLog = (logsData || []).find(l => l.attachment_id === att.id);
        const reviewAction = String(fileLog?.review_action || '').toLowerCase();
        return fileLog && RETURN_REASONS.includes(reviewAction);
      });

      versionAttachments.forEach((att) => {
        const reqId = att.requirement_id;
        const fileLog = (logsData || []).find(l => l.attachment_id === att.id);
        const reviewAction = String(fileLog?.review_action || '').toLowerCase();

        if (fileLog && RETURN_REASONS.includes(reviewAction)) {
          returnedSet.add(reqId);
        } else if (fileLog && reviewAction === 'approved') {
          approvedSet.add(reqId);
        } else {
          if (hasExplicitReturnedAttLog) {
            // Other attachments were NOT returned, so mark them as approved/locked
            approvedSet.add(reqId);
          } else if (isReturnedSub) {
            // Default fallback if overall submission was returned without specific attachment logs
            returnedSet.add(reqId);
          }
        }
      });

      setReturnedReqIds(returnedSet);
      setApprovedReqIds(approvedSet);

      // Check if 02F1 Activity Proposal Form (Requirement ID 78 or referenceCode 02F1) is in returnedSet
      const is02F1InReturned = (reqs || []).some(r => {
        if (!returnedSet.has(r.id)) return false;
        const code = String(r.referenceCode || '').toLowerCase();
        const title = String(r.title || '').toLowerCase();
        return r.id === 78 || code.includes('02f1') || title.includes('02f1') || title.includes('activity proposal form');
      });

      setIs02F1Returned(is02F1InReturned);

      // If document is returned and 02F1 is NOT returned, skip Phase 1 and Phase 2, go straight to Phase 3 (Upload Requirements)
      if (isReturnedSub && !is02F1InReturned) {
        setProposalStep(3);
      } else {
        setProposalStep(1);
      }

      setView('form');
    } catch (err) {
      console.error('Failed to load draft by ID:', err);
      showToast(`Could not load saved draft details: ${err.message || err}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchNextActivityNumber = async () => {
    try {
      const { data: userData } = await supabase.from('users').select('abbreviation').eq('id', user.id).single();
      const orgAbbr = userData?.abbreviation || 'ORG';
      const docType = selectedType?.name || 'Activity Proposal';
      const prefix = docType.split(' ').map(w => w[0].toUpperCase()).join('');
      const searchPattern = `${prefix}-${orgAbbr}-%`;

      const { data: existing } = await supabase
        .from('submissions')
        .select('tracking_number')
        .ilike('tracking_number', searchPattern);

      let maxIncrement = 0;
      if (existing && existing.length > 0) {
        existing.forEach(sub => {
          if (sub.tracking_number) {
            const parts = sub.tracking_number.split('-');
            const lastNum = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(lastNum) && lastNum > maxIncrement) {
              maxIncrement = lastNum;
            }
          }
        });
      }
      return String(maxIncrement + 1);
    } catch (e) {
      console.error('Failed to fetch next activity number:', e);
      return '1';
    }
  };

  const initializeSubmissionForm = async (type, subtypeObj = null, subName = '', resumeSubmissionId = null) => {
    setLoading(true);
    try {
      const isProposal = type.name.toLowerCase().includes('activity proposal');
      const subtypeId = subtypeObj ? subtypeObj.id : null;
      const proposalType = isProposal ? subName : null;

      let draft = null;
      if (resumeSubmissionId) {
        draft = await subService.getSubmissionById(resumeSubmissionId);
      }
      const reqs = await subService.getRequirementsForType(type.id, subtypeId, proposalType);

      setRequirements(reqs || []);
      setSelectedType(type);
      setSubType(subName);
      setSelectedSubtypeObj(subtypeObj);
      setShowUnsavedModal(false);
      setLocalFiles({});
      setExistingAttachments([]);
      setActiveDraft({ submissionId: null, versionId: null });
      setDraftNotice('');
      setDraftLoadedFields(new Set());

      if (draft?.submission && draft?.version) {
        const rawDetails = draft.version.activity_proposal_details;
        const details = (Array.isArray(rawDetails) ? rawDetails[0] : rawDetails) || {};
        setExistingAttachments(draft.version.submission_attachments || []);
        setActiveDraft({ submissionId: draft.submission.id, versionId: draft.version.id });
        setDraftNotice('');
        setIsNewDraftThisSession(false);
        populateDraftFields(details);

        const aySnapshot = (draft?.submission?.school_year_id && user?.organization_id)
          ? await fetchHistoricalAySnapshot(user.organization_id, draft.submission.school_year_id)
          : null;

        if (isProposal) {
          const scheds = details.activity_schedules || [];
          let inferredMode = 'single';
          if (scheds.length > 1) {
            inferredMode = 'multiple';
          } else if (scheds.length === 1 && scheds[0].end_date) {
            inferredMode = 'range';
          }
          setScheduleMode(inferredMode);

          setProposalDetails({
            ...defaultForm,
            ...details,
            objectives: ensureArrayOfStrings(details.objectives),
            schedules: scheds.length > 0 ? scheds : (details.target_date ? details.target_date.split(',').map(d => ({
              activity_date: d.trim(),
              start_time: details.target_time || '',
              end_time: details.target_end_time || '',
              is_indefinite: details.is_indefinite_end_time || false,
              duration_minutes: details.duration ? Math.round(parseFloat(details.duration) * 60) : 0
            })).filter(s => s.activity_date) : []),
            activity_dates: details.target_date ? details.target_date.split(',').map(d => d.trim()).filter(Boolean) : [],
            activity_number: extractIncrementNumber(details.activity_number) || await fetchNextActivityNumber(),
            organization_name: details.organization_name || aySnapshot?.org_name || user?.org_name || '',
            adviser_name: details.adviser_name || aySnapshot?.adviser_name || user?.adviser_name || '',
            person_in_charge: details.person_in_charge || aySnapshot?.president_name || user?.full_name || '',
            student_id_no: details.student_id_no || aySnapshot?.student_no || user?.student_no || '',
            contact_number: details.contact_number || aySnapshot?.contact_no || user?.contact_no || ''
          });
        } else {
          setProposalDetails({
            ...defaultForm,
            organization_name: details.organization_name || aySnapshot?.org_name || user?.org_name || '',
            adviser_name: details.adviser_name || aySnapshot?.adviser_name || user?.adviser_name || '',
            person_in_charge: details.person_in_charge || aySnapshot?.president_name || user?.full_name || '',
            student_id_no: details.student_id_no || aySnapshot?.student_no || user?.student_no || '',
            contact_number: details.contact_number || aySnapshot?.contact_no || user?.contact_no || ''
          });
        }
      } else {
        setIsNewDraftThisSession(true);
        setScheduleMode('single');
        if (isProposal) {
          const nextActNum = await fetchNextActivityNumber();
          setProposalDetails({
            ...defaultForm,
            activity_number: nextActNum,
            organization_name: user?.org_name || '',
            adviser_name: user?.adviser_name || '',
            person_in_charge: user?.full_name || '',
            student_id_no: user?.student_no || '',
            contact_number: user?.contact_no || ''
          });
        } else {
          setProposalDetails({
            ...defaultForm,
            organization_name: user?.org_name || '',
            adviser_name: user?.adviser_name || '',
            person_in_charge: user?.full_name || '',
            student_id_no: user?.student_no || '',
            contact_number: user?.contact_no || ''
          });
        }
      }
      savedStateRef.current = {
        files: '[]',
        details: JSON.stringify(proposalDetails)
      };
      setHasUnsavedChanges(false);
      window.__hasUnsavedChanges = false;
      setView('form');
    } catch (err) {
      console.error('Failed to initialize submission:', err);
      showToast('Could not initialize submission', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const submissionId = new URLSearchParams(location.search).get('submissionId');
    if (submissionId) {
      loadSubmissionById(submissionId);
    }
  }, [location.search]);

  const existingAttachmentMap = useMemo(() => {
    return Object.fromEntries(existingAttachments.map((item) => [item.requirement_id, item]));
  }, [existingAttachments]);

  const isReturnedDocument = useMemo(() => {
    return String(loadedSubmission?.status || '').toLowerCase() === 'returned';
  }, [loadedSubmission]);

  const hasFormChanges = useMemo(() => {
    if (!isReturnedDocument) return true;
    if (!initialFormSnapshotRef.current) return false;

    const isDetailsChanged = JSON.stringify(proposalDetails) !== initialFormSnapshotRef.current;
    const isFilesUploaded = Object.keys(localFiles).length > 0;

    return isDetailsChanged || isFilesUploaded;
  }, [isReturnedDocument, proposalDetails, localFiles]);

  const handleFileUpload = (reqId, file) => {
    if (!file) return;

    const fileExt = file.name.split('.').pop().toLowerCase();
    const isPdf = file.type === 'application/pdf' || fileExt === 'pdf';

    if (!isPdf) {
      showToast('Only PDF files (.pdf) are allowed for document attachments.', 'error');
      return;
    }

    setLocalFiles(prev => ({
      ...prev,
      [reqId]: file
    }));
    setHasUnsavedChanges(true);
  };

  const attachedRequirementIds = useMemo(() => {
    const ids = new Set();
    Object.keys(localFiles || {}).forEach(id => ids.add(String(id)));
    (existingAttachments || []).forEach(att => {
      if (att.requirement_id) ids.add(String(att.requirement_id));
    });
    return ids;
  }, [localFiles, existingAttachments]);

  const isAllRequiredAttached = useMemo(() => {
    const docTypeName = (selectedType?.name || '').toLowerCase();
    const isStrictRequirementDoc = 
      docTypeName.includes('mid year') || docTypeName.includes('mid-year') || docTypeName.includes('mid_year') ||
      docTypeName.includes('renewal') ||
      docTypeName.includes('year end') || docTypeName.includes('year-end') || docTypeName.includes('year_end');

    if (isStrictRequirementDoc) {
      if (requirements.length === 0) return true;
      return requirements.every(r => attachedRequirementIds.has(String(r.id)));
    }

    const requiredReqs = requirements.filter(r => {
      const isOpt = r?.is_optional === true || String(r?.is_optional).toLowerCase() === 'true' || String(r?.title || '').toLowerCase().includes('(optional)');
      return !isOpt;
    });

    if (requiredReqs.length === 0) return true;

    return requiredReqs.every(r => attachedRequirementIds.has(String(r.id)));
  }, [selectedType, requirements, attachedRequirementIds]);

  const isResubmitDisabled = useMemo(() => {
    if (isSaving) return true;

    if (!isAllRequiredAttached) {
      return true;
    }

    if (isReturnedDocument) {
      // For returned documents:
      // 1. If 02F1 Activity Proposal Form was returned, hasFormChanges MUST be true
      if (is02F1Returned && !hasFormChanges) return true;

      // 2. All non-optional returned requirements MUST have a replacement file in localFiles
      for (const reqId of returnedReqIds) {
        const reqObj = requirements.find(r => String(r.id) === String(reqId));
        const isOpt = reqObj?.is_optional === true || String(reqObj?.is_optional).toLowerCase() === 'true' || String(reqObj?.title || '').toLowerCase().includes('(optional)');
        if (!isOpt && !localFiles[reqId]) {
          return true;
        }
      }
    }

    return false;
  }, [isSaving, isAllRequiredAttached, isReturnedDocument, is02F1Returned, hasFormChanges, returnedReqIds, localFiles]);

  const getReqCount = (typeId, subtypeObj) => {
    const sId = subtypeObj ? subtypeObj.id : null;
    const specificCount = sId ? (reqCounts[`${typeId}-${sId}`] || 0) : 0;
    const generalCount = reqCounts[typeId] || 0;
    return sId ? specificCount + generalCount : generalCount;
  };

  const handleSelectType = async (type, subtypeObj = null, subName = '') => {
    if (!user) return;
    try {
      setLoading(true);
      const params = {
        userId: user.id,
        documentTypeId: type.id
      };
      if (subtypeObj?.id) {
        params.subtypeId = subtypeObj.id;
      }

      const res = await apiClient.get(apiUrl('/api/system/submission-decision'), { params });

      if (res.data?.action === 'blocked') {
        let msg = res.data.reason;
        if (res.data.submissionWindow) {
          msg += ` (Scheduled: ${new Date(res.data.submissionWindow.start).toLocaleDateString()} - ${new Date(res.data.submissionWindow.end).toLocaleDateString()})`;
        }
        showToast(msg, 'error');
        setLoading(false);
        return;
      } else if (res.data?.action === 'error') {
        showToast(res.data.reason, 'error');
        setLoading(false);
        return;
      }

      const resumeId = res.data?.action === 'resume' ? res.data.submissionId : null;
      await initializeSubmissionForm(type, subtypeObj, subName, resumeId);
    } catch (err) {
      console.error(err);
      showToast('Error checking document availability', 'error');
      setLoading(false);
    }
  };

  const savedStateRef = useRef({
    files: '[]',
    details: ''
  });

  useEffect(() => {
    if (view !== 'form') {
      setHasUnsavedChanges(false);
      window.__hasUnsavedChanges = false;
      return;
    }

    const currentFilesStr = JSON.stringify(Object.keys(localFiles).sort());
    const currentDetailsStr = JSON.stringify(proposalDetails);

    const isFilesChanged = currentFilesStr !== (savedStateRef.current.files || '[]');
    const isDetailsChanged = savedStateRef.current.details ? currentDetailsStr !== savedStateRef.current.details : false;

    if (isFilesChanged || isDetailsChanged) {
      const hasTypedContent =
        Object.keys(localFiles).length > 0 ||
        Boolean(proposalDetails?.activity_title?.trim()) ||
        Boolean(proposalDetails?.target_venue?.trim()) ||
        Boolean(proposalDetails?.target_audience?.trim()) ||
        Boolean(proposalDetails?.nature_of_activity?.trim()) ||
        (proposalDetails?.objectives && proposalDetails.objectives.some(o => o?.trim())) ||
        Boolean(proposalDetails?.satisfaction_goal_1?.trim());

      setHasUnsavedChanges(hasTypedContent);
    } else {
      setHasUnsavedChanges(false);
    }
  }, [proposalDetails, localFiles, view]);

  const processUploadsAndSave = async (status) => {
    if (isSavingRef.current) return;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setNetworkErrorModal({
        title: 'Internet Connection Lost',
        message: 'You are currently offline. Please check your network connection and try again.'
      });
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);
    let isSuccessSubmit = false;
    try {
      let submissionId = activeDraft.submissionId;
      let versionId = activeDraft.versionId;
      let versionNumber = 1;

      // If this is a returned document being resubmitted, use authoritative versioning & attachment replacement
      if (isReturnedDocument && status === 'submitted') {
        const oldVersionId = activeDraft.versionId;

        // 1. Create new version
        const newVersion = await subService.createNewVersion(submissionId, oldVersionId, user.id);
        const targetVersionId = newVersion.id;
        const targetVersionNumber = newVersion.version_number;

        // 2. Identify old returned attachment DB IDs to exclude from copy
        const oldAttachments = existingAttachments || [];
        const returnedAttachmentDbIds = oldAttachments
          .filter(att => returnedReqIds.has(att.requirement_id) || !approvedReqIds.has(att.requirement_id))
          .map(att => att.id);

        // 3. Copy approved attachments from old version to new version
        await subService.copyApprovedAttachments(oldVersionId, targetVersionId, returnedAttachmentDbIds, submissionId);

        // 4. Upload replacement files in localFiles to new version
        const isProposal = selectedType.name.toLowerCase().includes('activity proposal');
        const proposalType = selectedType?.name || subType || null;

        await Promise.all(
          Object.entries(localFiles).map(async ([reqId, file]) => {
            const path = await subService.uploadSubmissionFile(file, selectedType.name, submissionId, targetVersionNumber, proposalType, reqId);
            return await subService.saveAttachmentRecord(targetVersionId, reqId, file.name, path);
          })
        );

        // 5. Save proposal details to new version
        if (isProposal) {
          await subService.saveProposalDetails(targetVersionId, proposalDetails, selectedSubtypeObj?.id || null, subType);
        }

        // 6. Invoke resubmit submission transition
        await subService.resubmitSubmission(submissionId, user.id, oldVersionId);

        if (refreshUser) {
          await refreshUser();
        }
        window.dispatchEvent(new CustomEvent('inbox-updated'));
        window.dispatchEvent(new CustomEvent('document-status-changed'));
        window.dispatchEvent(new CustomEvent('submission-submitted'));
        showToast('Document Resubmitted Successfully!');
        isSuccessSubmit = true;
        setTimeout(() => navigate('/my-documents', { state: { highlightedId: submissionId } }), 500);
        return;
      }

      // 1. Create submission and version records first if not existing
      if (!submissionId || !versionId) {
        const draftRes = await subService.startNewSubmission(user.id, selectedType.id, selectedType.name, activeSchoolYearId, selectedSubtypeObj?.id || null, subType);
        if (draftRes.action === 'blocked') {
          showToast(draftRes.reason || 'Submission creation blocked', 'error');
          setIsSaving(false);
          isSavingRef.current = false;
          return;
        }
        submissionId = draftRes.submissionId;
        versionId = draftRes.versionId;
        setActiveDraft({ submissionId, versionId });
      }

      // 1.5 Delete removed attachments to prevent duplicates
      if (versionId) {
        const { data: dbAttachments } = await supabase
          .from('submission_attachments')
          .select('id, requirement_id')
          .eq('submission_version_id', versionId);

        if (dbAttachments && dbAttachments.length > 0) {
          const validReqIds = existingAttachments.map(a => a.requirement_id);
          const toDeleteIds = dbAttachments
            .filter(dbAtt => !validReqIds.includes(dbAtt.requirement_id))
            .map(a => a.id);

          if (toDeleteIds.length > 0) {
            await supabase.from('submission_attachments').delete().in('id', toDeleteIds);
          }
        }
      }

      // 2. Upload all local files to bucket in parallel
      const newlyUploaded = await Promise.all(
        Object.entries(localFiles).map(async ([reqId, file]) => {
          const path = await subService.uploadSubmissionFile(file, selectedType.name, submissionId, versionNumber, subType, reqId);
          return await subService.saveAttachmentRecord(versionId, reqId, file.name, path);
        })
      );

      // Clear local files to avoid re-uploading the same files on next draft save
      if (status !== 'submitted') {
        setLocalFiles({});
        if (newlyUploaded.length > 0) {
          setExistingAttachments(prev => [...prev, ...newlyUploaded]);
        }

        // Update saved state ref to prevent infinite autosave loop
        savedStateRef.current = {
          files: '[]', // because localFiles is cleared
          details: JSON.stringify(proposalDetails)
        };
      }

      // 3. Save Proposal Details if it's an Activity Proposal
      const isProposal = selectedType.name.toLowerCase().includes('activity proposal');
      if (isProposal) {
        await subService.saveProposalDetails(versionId, proposalDetails, selectedSubtypeObj?.id || null, subType);
      }

      // 4. If status is 'submitted', finalize it
      if (status === 'submitted') {
        await subService.submitForReview(submissionId, versionId, user.id);
        if (refreshUser) {
          await refreshUser();
        }
        window.dispatchEvent(new CustomEvent('inbox-updated'));
        window.dispatchEvent(new CustomEvent('document-status-changed'));
        window.dispatchEvent(new CustomEvent('submission-submitted'));
        showToast('Document Registered Successfully!');
        isSuccessSubmit = true;
        setTimeout(() => navigate('/my-documents', { state: { highlightedId: submissionId } }), 500);
      } else {
        showToast('Progress Saved as Draft!', 'success');
        setHasUnsavedChanges(false);
        window.__hasUnsavedChanges = false;
        const dest = pendingNavPath || '/my-documents';
        setPendingNavPath(null);
        setTimeout(() => navigate(dest), 500);
      }
    } catch (err) {
      console.error('Registration error:', err);
      const errStr = String(err?.message || err || '').toLowerCase();
      const isNetworkIssue = 
        (typeof navigator !== 'undefined' && !navigator.onLine) ||
        errStr.includes('failed to fetch') ||
        errStr.includes('networkerror') ||
        errStr.includes('network error') ||
        errStr.includes('offline') ||
        errStr.includes('timeout') ||
        errStr.includes('connection');

      if (isNetworkIssue) {
        setNetworkErrorModal({
          title: 'Connection Lost / Network Issue',
          message: 'The registration request failed due to a slow or disconnected internet connection. Please check your network connection and try again.'
        });
      } else {
        showToast('Action failed: ' + (err.message || ''), 'error');
      }
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  const handleRegisterDocument = (e) => {
    if (e) e.preventDefault();
    if (isSavingRef.current || isSaving) return;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setNetworkErrorModal({
        title: 'Internet Connection Lost',
        message: 'You are currently offline. Please check your network connection and try again.'
      });
      return;
    }

    // Validate form inputs if proposal
    const isProposal = selectedType.name.toLowerCase().includes('activity proposal');
    if (isProposal) {
      const p = proposalDetails;

      const hasSameDayRange = scheduleMode === 'range' && p.schedules.some(s => s.activity_date && s.end_date && s.activity_date === s.end_date);
      if (hasSameDayRange) {
        showToast("Date Range mode requires the start date and end date to be on different days. Use 'Single Day' mode for single-day activities.", 'error');
        return;
      }

      const hasInvalidSchedule = p.schedules.length === 0 || p.schedules.some(s => {
        if (!s.activity_date) return true;
        if (scheduleMode === 'range') {
          if (!s.end_date || s.activity_date === s.end_date) return true;
        } else {
          if (!s.start_time) return true;
          if (!s.is_indefinite && !s.end_time) return true;
        }
        return false;
      });

      if (
        !p.activity_title ||
        hasInvalidSchedule ||
        !p.person_in_charge ||
        !p.student_id_no ||
        !p.contact_number ||
        !p.target_venue ||
        !p.number_of_students ||
        !p.target_audience ||
        !p.nature_of_activity ||
        p.objectives.length === 0 ||
        !p.satisfaction_goal_1?.trim()
      ) {
        showToast('Please fill in all required form fields.', 'error');
        return;
      }

      if (!/^09\d{9}$/.test(p.contact_number)) {
        showToast('Contact number must start with 09 and have exactly 11 digits.', 'error');
        return;
      }
    }

    const attachedIds = attachedRequirementIds;
    const docTypeName = (selectedType?.name || '').toLowerCase();
    const isStrictRequirementDoc = 
      docTypeName.includes('mid year') || docTypeName.includes('mid-year') || docTypeName.includes('mid_year') ||
      docTypeName.includes('renewal') ||
      docTypeName.includes('year end') || docTypeName.includes('year-end') || docTypeName.includes('year_end');

    if (isStrictRequirementDoc) {
      const missingReqs = requirements.filter(r => !attachedIds.has(String(r.id)));
      if (missingReqs.length > 0) {
        showToast(`Please attach files for all ${requirements.length} required documents before registering.`, 'error');
        return;
      }
    } else {
      const requiredReqs = requirements.filter(r => !r.is_optional && String(r.is_optional) !== 'true' && !r.title.toLowerCase().includes('(optional)'));
      if (attachedIds.size < requiredReqs.length) {
        showToast(`Please attach all ${requiredReqs.length} required documents before registering.`, 'error');
        return;
      }
    }

    processUploadsAndSave('submitted');
  };

  const handleSaveDraft = () => {
    if (isSavingRef.current || isSaving) return;
    if (Object.keys(localFiles).length === 0 && !hasUnsavedChanges) {
      showToast('Nothing to save yet.', 'error');
      return;
    }
    processUploadsAndSave('draft');
  };

  const deleteDraftIfNew = async () => {
    if (activeDraft.submissionId) {
      try {
        await supabase.from('submissions').delete().eq('id', activeDraft.submissionId);
      } catch (e) {
        console.error('Error deleting draft:', e);
      }
    }
  };

  const handleBackNavigation = async () => {
    if (hasUnsavedChanges) {
      setPendingNavPath('/my-documents');
      setShowUnsavedModal(true);
    } else {
      setPendingNavPath(null);
      setShowUnsavedModal(false);
      setHasUnsavedChanges(false);
      window.__hasUnsavedChanges = false;
      navigate('/my-documents');
    }
  };

  const clearFormOptions = (type, silent = false) => {
    if (type === 'details' || type === 'both') setProposalDetails(defaultForm);
    if (type === 'attachments' || type === 'both') setLocalFiles({});
    if (type === 'both') setActiveDraft({ submissionId: null, versionId: null });
    setShowClearModal(false);
    if (!silent) {
      showToast('Cleared successfully', 'info');
    }
  };

  const toggleArrayField = (field, value) => {
    setProposalDetails(prev => {
      const current = ensureArrayOfStrings(prev[field]);
      if (current.includes(value)) {
        return { ...prev, [field]: current.filter(item => item !== value) };
      } else {
        return { ...prev, [field]: [...current, value] };
      }
    });
  };

  const handleAddDate = (dateStr) => {
    if (!dateStr) return;

    const checkStr = dateStr.split('T')[0];

    const blockedEvent = blockedEvents.find(e => {
      if (e.document_type_id && e.document_type_id !== selectedType?.id) return false;
      const evStart = e.start_date ? e.start_date.split('T')[0] : '';
      const evEnd = e.end_date ? e.end_date.split('T')[0] : evStart;
      if (!evStart) return false;
      return checkStr >= evStart && checkStr <= evEnd;
    });

    if (blockedEvent) {
      showToast(`Cannot select ${dateStr}: Blocked by "${blockedEvent.title || 'Academic Calendar'}"`, 'error');
      return;
    }

    if (!proposalDetails.activity_dates.includes(dateStr)) {
      setProposalDetails(prev => ({
        ...prev,
        activity_dates: [...prev.activity_dates, dateStr].sort()
      }));
    }
  };

  const handleRemoveDate = (dateStr) => {
    setProposalDetails(prev => ({
      ...prev,
      activity_dates: prev.activity_dates.filter(d => d !== dateStr)
    }));
  };


  if (loading && view === 'dashboard') {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary-green border-t-transparent rounded-full animate-spin"></div>
          <span className="text-primary-green font-bold tracking-[0.2em] text-xs uppercase animate-pulse">Loading Data...</span>
        </div>
      </div>
    );
  }

  if (isSuspended) {
    let suspensionMessage = 'Your account has been suspended due to system requirements or missing submissions.';
    if (user.status.includes(':')) {
      suspensionMessage = user.status.split(':').slice(1).join(':').trim();
    }

    return (
      <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 flex flex-col animate-in zoom-in-95 duration-300">
          <div className="p-6 text-white flex items-center gap-4 bg-gradient-to-r from-red-600 to-red-500">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-white shrink-0">
              <Lock size={28} />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-wide">ACCOUNT SUSPENDED</h2>
              <p className="text-white/80 text-xs mt-0.5 font-medium">Access to document submission is restricted</p>
            </div>
          </div>

          <div className="p-8 text-gray-800">
            <p className="text-gray-600 text-sm leading-relaxed mb-6 font-medium">
              An administrator has suspended your organization's account. While suspended, you can access your dashboard and view documents, but you cannot submit new documents or new versions.
            </p>

            <div className="mb-6 p-4 bg-red-50 rounded-xl border border-red-100">
              <span className="block text-[10px] font-black text-red-500 uppercase tracking-widest mb-1.5">Suspension Reason</span>
              <p className="text-red-700 text-xs leading-relaxed italic whitespace-pre-wrap">
                "{suspensionMessage}"
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex items-center gap-3">
              <AlertCircle className="text-red-500 shrink-0" size={20} />
              <span className="text-xs text-gray-500 font-medium text-left">
                Please contact the SDS Coordinator at {adminEmail && adminEmail.includes('@') ? (
                  <a href={`mailto:${adminEmail}`} className="text-blue-600 hover:underline font-bold">{adminEmail}</a>
                ) : adminEmail ? (
                  <span className="font-bold text-gray-800">{adminEmail}</span>
                ) : (
                  <span className="font-bold text-gray-800">the administrator</span>
                )} to reactivate your account.
              </span>
            </div>
          </div>

          <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="px-6 py-2.5 bg-primary-green hover:bg-green-700 text-white text-xs font-black rounded-xl transition-all duration-200 shadow-md shadow-green-600/10"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }


  const renderRequirementsList = (isModal = false) => (
    <div className={`space-y-4 ${isModal ? '' : 'w-full max-w-5xl mx-auto'}`}>
      {requirements.map((req, i) => {
        const existing = existingAttachmentMap[req.id];
        const isApprovedReq = isReturnedDocument && (approvedReqIds.has(req.id) || approvedReqIds.has(String(req.id)) || approvedReqIds.has(Number(req.id)));
        const isReturnedReq = isReturnedDocument && (returnedReqIds.has(req.id) || returnedReqIds.has(String(req.id)) || returnedReqIds.has(Number(req.id)));
        const isOptionalReq =
          req?.is_optional === true ||
          String(req?.is_optional).toLowerCase() === 'true' ||
          req?.is_required === false ||
          String(req?.is_required).toLowerCase() === 'false' ||
          String(req?.title || '').toLowerCase().includes('(optional)') ||
          String(req?.requirement_type || '').toLowerCase() === 'optional';

        return (
          <div key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-white rounded-xl shadow-sm border border-gray-100 hover:border-amber-200 transition-all">
            <div className="flex items-start sm:items-center gap-4 sm:gap-6">
              <div className="w-10 h-10 bg-green-100 text-green-800 font-black text-sm flex items-center justify-center rounded-lg shrink-0">
                {i + 1}
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full ${
                    (req.requirement_scope || 'OSAS') === 'OSAS'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-slate-100/90 text-slate-500 border border-slate-200'
                  }`}>
                    {(req.requirement_scope || 'OSAS') === 'OSAS' ? 'OSAS Requirement' : 'LOCAL Requirement'}
                  </span>
                  {isApprovedReq && (
                    <span className="px-2.5 py-0.5 bg-green-100 text-green-700 text-[9px] font-black uppercase rounded flex items-center gap-1">
                      <Lock size={10} /> Approved (Locked)
                    </span>
                  )}
                  {isReturnedReq && isReturnedDocument && (
                    <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-[9px] font-black uppercase rounded">
                      Returned (Action Required)
                    </span>
                  )}
                  {isOptionalReq && (
                    <span className="px-2.5 py-0.5 bg-yellow-100 text-yellow-800 text-[9px] font-black uppercase rounded border border-yellow-200">
                      Optional
                    </span>
                  )}
                </div>
                <h4 className="text-sm font-black text-gray-800 leading-tight uppercase">
                  {req.title}
                </h4>
                <p className="text-[11px] font-bold text-gray-500 mt-1">{req.description || 'Please provide the requested document'}</p>
                <span className="text-[11px] font-bold text-gray-400 mt-2 block">{req.referenceCode || 'REQ'}</span>
              </div>
            </div>

            {isApprovedReq ? (
              <div className="flex items-center gap-3 bg-green-50 px-5 py-2.5 rounded-lg border border-green-200 self-start sm:self-auto shrink-0">
                <Lock className="text-green-600" size={16} />
                <span className="text-xs font-bold text-green-800 max-w-[180px] truncate" title={existing?.file_name || 'Approved Attachment'}>
                  {existing?.file_name || 'Approved File'}
                </span>
                <span className="text-[10px] font-black uppercase tracking-wider text-green-700 bg-green-100 px-2 py-0.5 rounded">Locked</span>
              </div>
            ) : localFiles[req.id] ? (
              <div className="flex items-center gap-3 bg-green-50 px-5 py-2.5 rounded-lg border border-green-100 self-start sm:self-auto shrink-0">
                <Check className="text-green-600" size={16} />
                <span className="text-xs font-bold text-green-700 max-w-[150px] truncate" title={localFiles[req.id].name}>
                  {localFiles[req.id].name}
                </span>
                <button type="button" onClick={() => setLocalFiles(prev => {
                  const next = { ...prev }; delete next[req.id]; return next;
                })} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all ml-2">
                  <Trash2 size={14} />
                </button>
              </div>
            ) : existing && !isReturnedDocument ? (
              <div className="flex flex-col gap-2 bg-yellow-50 px-5 py-3 rounded-lg border border-yellow-100 self-start sm:self-auto shrink-0 max-w-full">
                <div className="flex items-center gap-3">
                  <CheckSquare className="text-amber-600" size={16} />
                  <span className="text-xs font-bold text-amber-700 truncate max-w-[180px]" title={existing.file_name}>{existing.file_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setExistingAttachments(prev => prev.filter(a => a.requirement_id !== req.id))} className="text-xs text-blue-600 font-bold hover:underline">Remove saved file</button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => document.getElementById(`file-${isModal ? 'modal' : 'inline'}-${req.id}`).click()}
                className="px-6 py-2.5 bg-[#f5b027] text-white font-bold rounded-lg hover:bg-amber-500 transition-all text-xs flex items-center justify-center gap-2 self-start sm:self-auto shrink-0 shadow-md"
              >
                <Paperclip size={14} /> Attach File (.pdf)
                <input
                  type="file" id={`file-${isModal ? 'modal' : 'inline'}-${req.id}`} className="hidden" accept=".pdf,application/pdf"
                  onChange={(e) => {
                    handleFileUpload(req.id, e.target.files[0]);
                    e.target.value = '';
                  }}
                />
              </button>
            )}
          </div>
        );
      })}
      {requirements.length === 0 && (
        <div className="py-12 flex flex-col items-center justify-center text-gray-400 bg-white rounded-2xl border border-gray-100">
          <FileText size={48} className="mb-4 opacity-20" />
          <p className="font-bold text-sm">No requirements found for this category.</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-gray-700 font-sans pb-32 relative">
      {toast && (
        <div className={`fixed top-20 right-4 sm:right-10 z-[999999] flex items-center gap-4 px-6 py-4 rounded-xl shadow-xl animate-in slide-in-from-right-full ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-primary-green text-white'
          }`}>
          {toast.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          <span className="font-bold text-sm">{toast.message}</span>
        </div>
      )}

      {/* DASHBOARD VIEW */}
      {view === 'dashboard' && (
        <div className="animate-in fade-in duration-500">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 border-b border-gray-100 pb-6 gap-6">
            <PageHeader
              title="Submit New Document"
              subtitle="Select a category to start your submission"
              icon={FilePlus}
              iconColor="gold"
            />
            <div className="relative w-full max-w-sm">
              <input
                type="text" placeholder="Search"
                className="w-full pl-5 pr-10 py-3 bg-white border border-gray-200 rounded-lg focus:border-primary-green outline-none transition-all shadow-sm text-sm font-bold"
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              />
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            </div>
          </div>

          {globalWarning && (
            <div className="mb-8 p-6 bg-red-50 border-2 border-red-200 rounded-2xl flex items-start gap-4">
              <div className="p-3 bg-red-100 text-red-600 rounded-xl">
                <AlertCircle size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-red-800 uppercase">System Unavailable</h3>
                <p className="text-red-600 font-bold text-sm mt-1">{globalWarning}</p>
                <p className="text-red-500 font-bold text-xs mt-2">Document submissions are currently disabled. Please contact your system administrator to configure the active School Year.</p>
              </div>
            </div>
          )}

          <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 mb-16 ${globalWarning ? 'opacity-50 pointer-events-none' : ''}`}>
            {/* Helper for rendering item */}
            {(() => {
              const renderCategoryItem = (typeObj, subName, isLast = false) => {
                if (!typeObj) return null;
                const avail = availability[typeObj.id];
                const isLocked = avail && !avail.isAvailable;

                if (isLocked) {
                  return (
                    <div key={subName} className={`w-full px-6 py-4 flex flex-col justify-center bg-gray-50/50 ${!isLast ? 'border-b border-gray-100' : ''}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Lock size={16} className="text-gray-400" />
                          <div className="flex flex-col items-start text-left">
                            <span className="text-sm font-bold text-gray-400 line-through">{subName}</span>
                            <span className="text-[10px] font-bold text-red-500 mt-0.5">{avail.lockedReason}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <button
                    key={subName}
                    onClick={() => handleSelectType(typeObj, typeObj.__subtype, subName)}
                    className={`w-full px-6 py-4 flex items-center justify-between hover:bg-white transition-all group/btn ${!isLast ? 'border-b border-gray-50' : ''}`}
                  >
                    <div className="flex items-center gap-6">
                      <span className="text-sm font-bold text-gray-500 group-hover/btn:text-primary-green">{subName}</span>
                      <span className="text-[10px] font-black text-gray-300 uppercase">• {getReqCount(typeObj.id, typeObj.__subtype)} Reqs</span>
                    </div>
                    <ChevronRight size={18} className="text-gray-300 group-hover/btn:text-primary-green" />
                  </button>
                );
              };

              return (
                <>
                  {docTypes.map(typeObj => {
                    const subtypes = docSubtypes[typeObj.id] || [];
                    const isActivityProposal = typeObj.name.toLowerCase().includes('activity proposal');
                    const isReport = typeObj.name.toLowerCase().includes('report');
                    const isRenewal = typeObj.name.toLowerCase().includes('renewal');

                    let icon = <FileText size={24} />;
                    let bg = 'bg-blue-50 text-blue-500';
                    let desc = 'Required documents';

                    if (isReport) { icon = <Calendar size={24} />; bg = 'bg-orange-50 text-orange-500'; desc = 'Annual & Mid-year summaries'; }
                    if (isRenewal) { icon = <RefreshCcw size={24} />; bg = 'bg-amber-50 text-amber-500'; desc = 'Requirements for org renewal'; }

                    return (
                      <div key={typeObj.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                        <div className="p-6 flex items-start gap-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${bg}`}>
                            {icon}
                          </div>
                          <div>
                            <h3 className="text-lg font-black text-gray-800 uppercase">{typeObj.name}</h3>
                            <p className="text-gray-400 text-xs font-bold mt-1">{desc}</p>
                          </div>
                        </div>
                        <div className="mt-auto border-t border-gray-50 bg-gray-50/30">
                          {subtypes.length > 0 ? (
                            <button
                              onClick={() => setSelectedTypeForSubtypes({ typeObj, subtypes })}
                              className="w-full px-6 py-4 flex items-center justify-between hover:bg-white transition-all group/btn"
                            >
                              <span className="text-sm font-bold text-gray-500 group-hover/btn:text-primary-green">Select Subtype</span>
                              <ChevronRight size={18} className="text-gray-300 group-hover/btn:text-primary-green" />
                            </button>
                          ) : (
                            renderCategoryItem(typeObj, typeObj.name, true)
                          )}
                        </div>
                      </div>
                    );
                  })}
                </>
              );
            })()}
          </div>

          {selectedTypeForSubtypes && (
            <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
              <div className="bg-white rounded-[2rem] w-full max-w-3xl p-8 flex flex-col shadow-2xl animate-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between mb-8 border-b border-gray-100 pb-4">
                  <div>
                    <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight">{selectedTypeForSubtypes.typeObj.name} Subtypes</h2>
                    <p className="text-sm font-bold text-gray-400 mt-1">Select the specific category for your submission</p>
                  </div>
                  <button onClick={() => setSelectedTypeForSubtypes(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <X size={24} className="text-gray-400" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {selectedTypeForSubtypes.subtypes.map(st => {
                    const tObj = { ...selectedTypeForSubtypes.typeObj, __subtype: st };
                    const avail = availability[tObj.id] || availability[selectedTypeForSubtypes.typeObj.id];
                    const isLocked = avail && !avail.isAvailable;

                    return (
                      <button
                        key={st.id}
                        disabled={isLocked}
                        onClick={() => {
                          setSelectedTypeForSubtypes(null);
                          handleSelectType(tObj, st, st.name);
                        }}
                        className={`p-6 rounded-xl border text-left transition-all ${isLocked ? 'border-red-100 bg-red-50 opacity-60 cursor-not-allowed' : 'border-gray-200 bg-white hover:border-primary-green hover:shadow-lg hover:-translate-y-1 cursor-pointer'}`}
                      >
                        <h3 className="text-lg font-black text-gray-800 uppercase">{st.name}</h3>
                        {isLocked ? (
                          <p className="text-xs font-bold text-red-500 mt-2 flex items-center gap-1"><Lock size={14} /> Locked: {avail?.lockedReason}</p>
                        ) : (
                          <p className="text-xs font-bold text-gray-500 mt-2 flex items-center gap-1"><FileText size={14} /> {getReqCount(selectedTypeForSubtypes.typeObj.id, st)} Required Documents</p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* FORM VIEW */}
      {view === 'form' && (
        <form ref={formRef} onSubmit={handleRegisterDocument} className="flex flex-col animate-in fade-in duration-500 relative min-h-screen">
          {/* Header - Stretches full width, auto-hides on scroll down */}
          <div className={`hidden md:flex fixed top-16 left-64 right-0 z-10 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between shadow-sm transition-transform duration-300 ${showHeader ? 'translate-y-0' : '-translate-y-full'}`}>
            <div className="flex items-center gap-6">
              <button type="button" onClick={handleBackNavigation} className="p-2 hover:bg-gray-50 rounded-lg transition-all">
                <ArrowLeft size={24} className="text-gray-500" />
              </button>
              <div className="flex items-center gap-4">
                <div className="p-2 bg-primary-green rounded-lg">
                  <FileText className="text-white" size={24} />
                </div>
                <div>
                  <h1 className="text-xl font-black text-gray-800 uppercase">{selectedType.name}</h1>
                  <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest">{subType}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-100 rounded-lg shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              <span className="text-xs font-black text-amber-700 uppercase tracking-widest">Draft Mode</span>
            </div>
          </div>

          <div className="flex-1 p-2 sm:p-4 md:p-8 pb-24 pt-4 md:pt-15 bg-gray-50/20">
            <div className={`w-full max-w-5xl mx-auto space-y-4 sm:space-y-8`}>

              {/* Returned Document Revision Banner */}
              {isReturnedDocument && (
                <div className="p-3.5 sm:p-5 bg-amber-50 border-2 border-amber-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-in fade-in">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-amber-100 text-amber-700 rounded-xl shrink-0">
                      <RefreshCcw size={22} className="animate-spin-slow" />
                    </div>
                    <div>
                      <h4 className="font-black text-amber-900 text-sm uppercase tracking-wider">Returned Document Revision</h4>
                      <p className="text-xs text-amber-700 font-bold mt-0.5">
                        {hasFormChanges
                          ? "Form changes detected! You can now click Resubmit Document to update your submission."
                          : "Edit the form content fields below to make your changes before resubmitting."}
                      </p>
                    </div>
                  </div>
                  <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase shadow-sm tracking-wider shrink-0 ${
                    hasFormChanges ? 'bg-green-600 text-white' : 'bg-amber-200 text-amber-800'
                  }`}>
                    {hasFormChanges ? 'Ready to Resubmit' : 'Awaiting Form Edits'}
                  </span>
                </div>
              )}

              {/* Proposal Stepper Indicator */}
              {isProposal && (
                <div className="bg-white p-3 sm:p-6 rounded-2xl shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between max-w-xl mx-auto relative">
                    <div className="absolute top-1/2 left-0 right-0 h-1 bg-gray-100 -translate-y-1/2 z-0"></div>
                    <div className="absolute top-1/2 left-0 h-1 bg-primary-green -translate-y-1/2 z-0 transition-all duration-500 ease-in-out" style={{ width: proposalStep === 1 ? '15%' : proposalStep === 2 ? '50%' : '85%' }}></div>
                    
                    {[
                      { step: 1, label: 'General Info', icon: <FileText size={14} /> },
                      { step: 2, label: 'Preview & Download', icon: <Download size={14} /> },
                      { step: 3, label: 'Upload Requirements', icon: <Upload size={14} /> },
                    ].map((s) => (
                      <div key={s.step} className="flex flex-col items-center gap-2 relative z-10">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs transition-all duration-300 ${
                          proposalStep >= s.step 
                            ? 'bg-primary-green text-white shadow-md shadow-green-600/20 ring-4 ring-green-50' 
                            : 'bg-white text-gray-400 border-2 border-gray-200'
                        }`}>
                          {proposalStep > s.step ? <Check size={14} strokeWidth={3} /> : s.icon}
                        </div>
                        <span className={`text-[9px] font-black uppercase tracking-widest ${proposalStep >= s.step ? 'text-primary-green' : 'text-gray-400'}`}>{s.label}</span>
                      </div>
                    ))}
                  </div>

                  {proposalStep === 1 && (
                    <div className="bg-white p-4 sm:p-8 md:p-10 rounded-2xl shadow-sm border border-gray-100 space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 mt-4 sm:mt-6">
                      <div className="flex items-center gap-4 pb-6 border-b border-gray-100">
                        <div className="w-10 h-10 bg-primary-green/10 rounded-xl flex items-center justify-center text-primary-green shrink-0">
                          <FileText size={20} />
                        </div>
                        <div>
                          <h2 className="text-xl font-black text-gray-800 uppercase tracking-widest">General Information</h2>
                          <p className="text-xs font-bold text-gray-400 mt-1">Please fill in the required details for your submission</p>
                        </div>
                      </div>

                      <div className="space-y-6">
                        {/* Basic Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                          <div className="space-y-2 md:col-span-2">
                            <label className="text-xs font-black text-gray-600 uppercase">Name of Student Organization <span className="text-red-500">*</span></label>
                            <input type="text" required className="w-full px-4 py-3 bg-gray-100 border-b-2 border-gray-200 text-gray-500 font-bold text-sm outline-none cursor-not-allowed" value={proposalDetails.organization_name} readOnly />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-black text-gray-600 uppercase">Name of Adviser <span className="text-red-500">*</span></label>
                            <input type="text" required className="w-full px-4 py-3 bg-gray-100 border-b-2 border-gray-200 text-gray-500 font-bold text-sm outline-none cursor-not-allowed" value={proposalDetails.adviser_name} readOnly />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-black text-gray-600 uppercase">Activity Number</label>
                            <input type="text" className="w-full px-4 py-3 bg-gray-100 text-gray-500 border-b-2 border-gray-200 font-bold text-sm outline-none" value={proposalDetails.activity_number} readOnly />
                          </div>
                          <div className={`space-y-2 md:col-span-2 ${showValidationHighlights && isFieldSkipped('activity_title') ? 'skipped-field-highlight' : ''}`}>
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-black text-gray-600 uppercase">Activity Title <span className="text-red-500">*</span></label>
                              {showValidationHighlights && isFieldSkipped('activity_title') && (
                                <span className="text-[10px] font-black text-red-600 bg-red-100 border border-red-200 px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
                                  <AlertCircle size={10} /> Field Required
                                </span>
                              )}
                            </div>
                            <input 
                              type="text" 
                              required 
                              className={`w-full px-4 py-3 border-2 font-bold text-sm outline-none transition-all rounded-xl ${
                                showValidationHighlights && isFieldSkipped('activity_title')
                                  ? 'border-red-500 bg-red-50/70 text-red-900 ring-2 ring-red-400/30'
                                  : draftLoadedFields.has('activity_title')
                                    ? 'bg-amber-50/70 border-amber-200 text-gray-800'
                                    : 'bg-gray-50 border-gray-200 focus:border-primary-green text-gray-800'
                              }`} 
                              value={proposalDetails.activity_title} 
                              onChange={e => {
                                setProposalDetails({ ...proposalDetails, activity_title: e.target.value });
                                clearDraftField('activity_title');
                              }} 
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-black text-gray-600 uppercase">Name of Person-In-Charge <span className="text-red-500">*</span></label>
                            <input type="text" required className="w-full px-4 py-3 bg-gray-100 border-b-2 border-gray-200 text-gray-500 font-bold text-sm outline-none cursor-not-allowed" value={proposalDetails.person_in_charge} readOnly />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-black text-gray-600 uppercase">Student ID No. <span className="text-red-500">*</span></label>
                            <input type="text" required className="w-full px-4 py-3 bg-gray-100 border-b-2 border-gray-200 text-gray-500 font-bold text-sm outline-none cursor-not-allowed" value={proposalDetails.student_id_no} readOnly />
                          </div>
                          <div className={`space-y-2 md:col-span-2 ${showValidationHighlights && isFieldSkipped('contact_number') ? 'skipped-field-highlight' : ''}`}>
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-black text-gray-600 uppercase">Contact Number of Person-In-Charge <span className="text-red-500">*</span></label>
                              {showValidationHighlights && isFieldSkipped('contact_number') && (
                                <span className="text-[10px] font-black text-red-600 bg-red-100 border border-red-200 px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
                                  <AlertCircle size={10} /> 11-Digit Number Required (09...)
                                </span>
                              )}
                            </div>
                            <input 
                              type="text" 
                              required 
                              maxLength={11} 
                              pattern="^09\d{9}$" 
                              className={`w-full px-4 py-3 border-2 font-bold text-sm outline-none transition-all rounded-xl ${
                                showValidationHighlights && isFieldSkipped('contact_number')
                                  ? 'border-red-500 bg-red-50/70 text-red-900 ring-2 ring-red-400/30'
                                  : draftLoadedFields.has('contact_number')
                                    ? 'bg-amber-50/70 border-amber-200 text-gray-800'
                                    : 'bg-gray-50 border-gray-200 focus:border-primary-green text-gray-800'
                              }`} 
                              value={proposalDetails.contact_number} 
                              onChange={e => {
                                setProposalDetails({ ...proposalDetails, contact_number: e.target.value.replace(/[^0-9]/g, '') });
                                clearDraftField('contact_number');
                              }} 
                            />
                          </div>
                          <div className={`space-y-2 md:col-span-2 ${showValidationHighlights && isFieldSkipped('target_venue') ? 'skipped-field-highlight' : ''}`}>
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-black text-gray-600 uppercase">Target Venue <span className="text-red-500">*</span></label>
                              {showValidationHighlights && isFieldSkipped('target_venue') && (
                                <span className="text-[10px] font-black text-red-600 bg-red-100 border border-red-200 px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
                                  <AlertCircle size={10} /> Field Required
                                </span>
                              )}
                            </div>
                            <input 
                              type="text" 
                              required 
                              className={`w-full px-4 py-3 border-2 font-bold text-sm outline-none transition-all rounded-xl ${
                                showValidationHighlights && isFieldSkipped('target_venue')
                                  ? 'border-red-500 bg-red-50/70 text-red-900 ring-2 ring-red-400/30'
                                  : draftLoadedFields.has('target_venue')
                                    ? 'bg-amber-50/70 border-amber-200 text-gray-800'
                                    : 'bg-gray-50 border-gray-200 focus:border-primary-green text-gray-800'
                              }`} 
                              value={proposalDetails.target_venue} 
                              onChange={e => {
                                setProposalDetails({ ...proposalDetails, target_venue: e.target.value });
                                clearDraftField('target_venue');
                              }} 
                            />
                          </div>

                          {/* Schedules */}
                          <div className={`space-y-4 md:col-span-2 p-4 rounded-xl border-2 transition-all ${
                            showValidationHighlights && isFieldSkipped('schedules')
                              ? 'border-red-500 bg-red-50/40 ring-2 ring-red-400/30 skipped-field-highlight'
                              : 'border-transparent'
                          }`}>
                            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-100 pb-4 gap-4">
                              <div className="flex items-center gap-2">
                                <label className="text-xs font-black text-gray-600 uppercase">Activity Schedules <span className="text-red-500">*</span></label>
                                {showValidationHighlights && isFieldSkipped('schedules') && (
                                  <span className="text-[10px] font-black text-red-600 bg-red-100 border border-red-200 px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
                                    <AlertCircle size={10} /> Schedule Incomplete
                                  </span>
                                )}
                              </div>

                              <div className="flex bg-gray-100 p-1 rounded-xl">
                                {['single', 'range'].map(mode => (
                                  <button
                                    key={mode}
                                    type="button"
                                    onClick={() => {
                                      setScheduleMode(mode);
                                      if (mode === 'single') {
                                        setProposalDetails(prev => ({ ...prev, schedules: [{ activity_date: '', start_time: '', end_time: '', is_indefinite: false, duration_minutes: 0 }] }));
                                      } else {
                                        setProposalDetails(prev => ({ ...prev, schedules: [{ activity_date: '', end_date: '', start_time: null, end_time: null, is_indefinite: false, duration_minutes: null }] }));
                                      }
                                    }}
                                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all capitalize ${scheduleMode === mode ? 'bg-white text-primary-green shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                  >
                                    {mode === 'single' ? 'Single Date' : 'Date Range'}
                                  </button>
                                ))}
                              </div>
                            </div>



                            {proposalDetails.schedules.length === 0 ? (
                              <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                <p className="text-xs font-bold text-gray-400 uppercase">No schedules added yet.</p>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                {proposalDetails.schedules.map((sched, idx) => (
                                  <div key={idx} className="bg-white border border-gray-200 rounded-xl p-4 relative group hover:border-primary-green transition-colors">
                                    {scheduleMode === 'range' ? (
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="space-y-1">
                                          <label htmlFor={`sched-start-date-${idx}`} className="text-[10px] font-bold text-gray-400 uppercase">Start Date</label>
                                          <CustomDatePicker
                                            id={`sched-start-date-${idx}`}
                                            name={`sched_start_date_${idx}`}
                                            required
                                            min={getMinAllowedDate()}
                                            blockedEvents={blockedEvents}
                                            onBlockedDateClick={(dateStr) => validateDateSelection(dateStr)}
                                            value={sched.activity_date}
                                            onChange={val => {
                                              if (!validateDateSelection(val)) return;
                                              const newScheds = [...proposalDetails.schedules];
                                              newScheds[idx].activity_date = val;
                                              if (scheduleMode === 'range' && newScheds[idx].end_date && val === newScheds[idx].end_date) {
                                                showToast("Date Range mode requires the start date and end date to be on different days. Use 'Single Day' mode for single-day activities.", "error");
                                                newScheds[idx].end_date = '';
                                              }
                                              setProposalDetails(prev => ({ ...prev, schedules: newScheds }));
                                            }}
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <label htmlFor={`sched-end-date-${idx}`} className="text-[10px] font-bold text-gray-400 uppercase">End Date</label>
                                          <CustomDatePicker
                                            id={`sched-end-date-${idx}`}
                                            name={`sched_end_date_${idx}`}
                                            required
                                            min={sched.activity_date || getMinAllowedDate()}
                                            blockedEvents={blockedEvents}
                                            onBlockedDateClick={(dateStr) => validateDateSelection(dateStr)}
                                            value={sched.end_date || ''}
                                            onChange={val => {
                                              if (!validateDateSelection(val)) return;
                                              if (scheduleMode === 'range' && sched.activity_date && val === sched.activity_date) {
                                                showToast("Date Range mode requires the end date to be different from the start date. Use 'Single Day' mode for single-day activities.", "error");
                                                return;
                                              }
                                              const newScheds = [...proposalDetails.schedules];
                                              newScheds[idx].end_date = val;
                                              setProposalDetails(prev => ({ ...prev, schedules: newScheds }));
                                            }}
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <label htmlFor={`sched-range-duration-${idx}`} className="text-[10px] font-bold text-gray-400 uppercase">Duration</label>
                                          <div id={`sched-range-duration-${idx}`} className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-700 font-bold text-xs flex items-center justify-between min-h-[38px]">
                                            <span>
                                              {(() => {
                                                if (!sched.activity_date || !sched.end_date) return '0 Days';
                                                const start = new Date(sched.activity_date);
                                                const end = new Date(sched.end_date);
                                                if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return '0 Days';
                                                const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
                                                return `${diffDays} Day${diffDays === 1 ? '' : 's'}`;
                                              })()}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <div className="space-y-1">
                                          <label htmlFor={`sched-single-date-${idx}`} className="text-[10px] font-bold text-gray-400 uppercase">Date</label>
                                          <CustomDatePicker
                                            id={`sched-single-date-${idx}`}
                                            name={`sched_single_date_${idx}`}
                                            required
                                            min={getMinAllowedDate()}
                                            blockedEvents={blockedEvents}
                                            onBlockedDateClick={(dateStr) => validateDateSelection(dateStr)}
                                            value={sched.activity_date}
                                            onChange={val => {
                                              if (!validateDateSelection(val)) return;
                                              const newScheds = [...proposalDetails.schedules];
                                              newScheds[idx].activity_date = val;
                                              setProposalDetails(prev => ({ ...prev, schedules: newScheds }));
                                            }}
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <label htmlFor={`sched-start-time-${idx}`} className="text-[10px] font-bold text-gray-400 uppercase">Start Time</label>
                                          <input
                                            id={`sched-start-time-${idx}`}
                                            name={`sched_start_time_${idx}`}
                                            type="time"
                                            required
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:border-primary-green font-bold text-xs outline-none"
                                            value={sched.start_time}
                                            onChange={e => {
                                              const newScheds = [...proposalDetails.schedules];
                                              newScheds[idx].start_time = e.target.value;
                                              if (newScheds[idx].start_time && newScheds[idx].end_time && !newScheds[idx].is_indefinite) {
                                                const start = new Date(`1970-01-01T${newScheds[idx].start_time}`);
                                                const end = new Date(`1970-01-01T${newScheds[idx].end_time}`);
                                                let diff = (end - start) / (1000 * 60);
                                                if (diff < 0) diff += 24 * 60;
                                                newScheds[idx].duration_minutes = Math.round(diff);
                                              }
                                              setProposalDetails(prev => ({ ...prev, schedules: newScheds }));
                                            }}
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <label htmlFor={`sched-end-time-${idx}`} className="text-[10px] font-bold text-gray-400 uppercase">End Time</label>
                                          <input
                                            id={`sched-end-time-${idx}`}
                                            name={`sched_end_time_${idx}`}
                                            type="time"
                                            required={!sched.is_indefinite}
                                            disabled={sched.is_indefinite}
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:border-primary-green font-bold text-xs outline-none disabled:opacity-50"
                                            value={sched.end_time || ''}
                                            onChange={e => {
                                              const newScheds = [...proposalDetails.schedules];
                                              newScheds[idx].end_time = e.target.value;
                                              if (newScheds[idx].start_time && newScheds[idx].end_time && !newScheds[idx].is_indefinite) {
                                                const start = new Date(`1970-01-01T${newScheds[idx].start_time}`);
                                                const end = new Date(`1970-01-01T${newScheds[idx].end_time}`);
                                                let diff = (end - start) / (1000 * 60);
                                                if (diff < 0) diff += 24 * 60;
                                                newScheds[idx].duration_minutes = Math.round(diff);
                                              }
                                              setProposalDetails(prev => ({ ...prev, schedules: newScheds }));
                                            }}
                                          />
                                          <label htmlFor={`sched-indefinite-${idx}`} className="flex items-center gap-2 cursor-pointer mt-1">
                                            <input
                                              id={`sched-indefinite-${idx}`}
                                              name={`sched_indefinite_${idx}`}
                                              type="checkbox"
                                              checked={sched.is_indefinite}
                                              onChange={e => {
                                                const newScheds = [...proposalDetails.schedules];
                                                newScheds[idx].is_indefinite = e.target.checked;
                                                if (e.target.checked) {
                                                  newScheds[idx].end_time = '';
                                                  newScheds[idx].duration_minutes = 0;
                                                }
                                                setProposalDetails(prev => ({ ...prev, schedules: newScheds }));
                                              }}
                                              className="rounded text-primary-green focus:ring-primary-green"
                                            />
                                            <span className="text-[10px] font-bold text-gray-500">Indefinite</span>
                                          </label>
                                        </div>
                                        <div className="space-y-1">
                                          <label htmlFor={`sched-single-duration-${idx}`} className="text-[10px] font-bold text-gray-400 uppercase">Duration</label>
                                          <div id={`sched-single-duration-${idx}`} className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-gray-700 font-bold text-xs flex items-center justify-between min-h-[38px]">
                                            <span>
                                              {(() => {
                                                if (sched.is_indefinite) return 'Indefinite (N/A)';
                                                const minutes = sched.duration_minutes || 0;
                                                if (minutes <= 0) return '0 Minutes';
                                                const hrs = Math.floor(minutes / 60);
                                                const mins = minutes % 60;
                                                const parts = [];
                                                if (hrs > 0) parts.push(`${hrs} Hour${hrs === 1 ? '' : 's'}`);
                                                if (mins > 0) parts.push(`${mins} Minute${mins === 1 ? '' : 's'}`);
                                                return parts.join(' ');
                                              })()}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className={`space-y-2 ${showValidationHighlights && isFieldSkipped('number_of_students') ? 'skipped-field-highlight' : ''}`}>
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-black text-gray-600 uppercase">Number of Student Involved <span className="text-red-500">*</span></label>
                              {showValidationHighlights && isFieldSkipped('number_of_students') && (
                                <span className="text-[10px] font-black text-red-600 bg-red-100 border border-red-200 px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
                                  <AlertCircle size={10} /> Field Required
                                </span>
                              )}
                            </div>
                            {proposalDetails.target_audience === 'Members only' && user?.no_member && (
                              <div className="pt-0.5">
                                <span className="text-[11px] font-bold text-primary-green bg-green-50 border border-green-200 px-2.5 py-1 rounded-full inline-flex items-center gap-1.5">
                                  <Users size={12} /> Auto-filled from Org Profile ({user.no_member} members)
                                </span>
                              </div>
                            )}
                            <input 
                              type="text" 
                              required 
                              className={`w-full px-4 py-3 border-2 font-bold text-sm outline-none transition-all rounded-xl ${
                                showValidationHighlights && isFieldSkipped('number_of_students')
                                  ? 'border-red-500 bg-red-50/70 text-red-900 ring-2 ring-red-400/30'
                                  : draftLoadedFields.has('number_of_students')
                                    ? 'bg-amber-50/70 border-amber-200 text-gray-800'
                                    : 'bg-gray-50 border-gray-200 focus:border-primary-green text-gray-800'
                              }`} 
                              value={proposalDetails.number_of_students} 
                              onChange={e => {
                                setProposalDetails({ ...proposalDetails, number_of_students: e.target.value.replace(/[^0-9]/g, '') });
                                clearDraftField('number_of_students');
                              }} 
                            />
                          </div>
                        </div>

                        {/* Checkboxes Section */}
                        <div className="pt-6 border-t border-gray-100 space-y-6">
                          <div className={`space-y-3 p-3.5 rounded-xl border-2 transition-all ${
                            showValidationHighlights && isFieldSkipped('target_audience')
                              ? 'border-red-500 bg-red-50/40 ring-2 ring-red-400/30 skipped-field-highlight'
                              : draftLoadedFields.has('target_audience') ? 'bg-amber-50/60 border-amber-200/60' : 'border-transparent'
                          }`}>
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-black text-gray-800 uppercase">Target Audience/Participants <span className="text-red-500">*</span></label>
                              {showValidationHighlights && isFieldSkipped('target_audience') && (
                                <span className="text-[10px] font-black text-red-600 bg-red-100 border border-red-200 px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
                                  <AlertCircle size={10} /> Option Required
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-8 p-1">
                              {['Members only', 'BulSUans only', 'Open to the public'].map(opt => (
                                <label key={opt} className="flex items-center gap-3 cursor-pointer group">
                                  <div className={`w-5 h-5 rounded-full flex items-center justify-center border-2 ${proposalDetails.target_audience === opt ? 'border-primary-green' : 'border-gray-300 group-hover:border-primary-green'}`}>
                                    {proposalDetails.target_audience === opt && <div className="w-2.5 h-2.5 bg-primary-green rounded-full" />}
                                  </div>
                                  <span className="text-sm font-bold text-gray-600">{opt}</span>
                                  <input 
                                    type="radio" 
                                    name="target_audience" 
                                    className="hidden" 
                                    checked={proposalDetails.target_audience === opt} 
                                    onChange={() => {
                                      const nextDetails = { ...proposalDetails, target_audience: opt };
                                      if (opt === 'Members only' && user?.no_member) {
                                        nextDetails.number_of_students = String(user.no_member);
                                        clearDraftField('number_of_students');
                                      }
                                      setProposalDetails(nextDetails);
                                      clearDraftField('target_audience');
                                    }} 
                                  />
                                </label>
                              ))}
                            </div>
                          </div>

                          <div className={`space-y-3 p-3.5 rounded-xl border-2 transition-all ${
                            showValidationHighlights && isFieldSkipped('nature_of_activity')
                              ? 'border-red-500 bg-red-50/40 ring-2 ring-red-400/30 skipped-field-highlight'
                              : draftLoadedFields.has('nature_of_activity') ? 'bg-amber-50/60 border-amber-200/60' : 'border-transparent'
                          }`}>
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-black text-gray-800 uppercase">Nature of Activity <span className="text-red-500">*</span></label>
                              {showValidationHighlights && isFieldSkipped('nature_of_activity') && (
                                <span className="text-[10px] font-black text-red-600 bg-red-100 border border-red-200 px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
                                  <AlertCircle size={10} /> Option Required
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-8 p-1">
                              {['Co-Curricular', 'Extra-Curricular'].map(opt => (
                                <label key={opt} className="flex items-center gap-3 cursor-pointer group">
                                  <div className={`w-5 h-5 rounded-full flex items-center justify-center border-2 ${proposalDetails.nature_of_activity === opt ? 'border-primary-green' : 'border-gray-300 group-hover:border-primary-green'}`}>
                                    {proposalDetails.nature_of_activity === opt && <div className="w-2.5 h-2.5 bg-primary-green rounded-full" />}
                                  </div>
                                  <span className="text-sm font-bold text-gray-600">{opt}</span>
                                  <input 
                                    type="radio" 
                                    name="nature" 
                                    className="hidden" 
                                    checked={proposalDetails.nature_of_activity === opt} 
                                    onChange={() => {
                                      setProposalDetails({ ...proposalDetails, nature_of_activity: opt });
                                      clearDraftField('nature_of_activity');
                                    }} 
                                  />
                                </label>
                              ))}
                            </div>
                          </div>

                          <div className={`space-y-4 p-3.5 rounded-xl border-2 transition-all ${
                            showValidationHighlights && isFieldSkipped('objectives')
                              ? 'border-red-500 bg-red-50/40 ring-2 ring-red-400/30 skipped-field-highlight'
                              : draftLoadedFields.has('objectives') ? 'bg-amber-50/60 border-amber-200/60' : 'border-transparent'
                          }`}>
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-black text-gray-800 uppercase">Objectives of the Activity <span className="text-red-500">*</span></label>
                              {showValidationHighlights && isFieldSkipped('objectives') && (
                                <span className="text-[10px] font-black text-red-600 bg-red-100 border border-red-200 px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
                                  <AlertCircle size={10} /> At least 1 objective required
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-1">
                              {[
                                'Leadership Development and Formation',
                                'Membership Development and Formation',
                                'Organizational Program Management',
                                'Values Enrichment',
                                'Skills Enhancement'
                              ].map(opt => {
                                const currentObjs = ensureArrayOfStrings(proposalDetails.objectives);
                                const isChecked = currentObjs.includes(opt);
                                return (
                                  <label key={opt} className="flex items-center gap-3 cursor-pointer group">
                                    <div className={`w-5 h-5 rounded flex items-center justify-center border-2 shrink-0 ${isChecked ? 'bg-primary-green border-primary-green text-white' : 'border-gray-300 group-hover:border-primary-green'}`}>
                                      {isChecked && <Check size={14} strokeWidth={3} />}
                                    </div>
                                    <span className="text-sm font-bold text-gray-600 leading-tight">{opt}</span>
                                    <input 
                                      type="checkbox" 
                                      className="hidden" 
                                      checked={isChecked} 
                                      onChange={() => {
                                        toggleArrayField('objectives', opt);
                                        clearDraftField('objectives');
                                      }} 
                                    />
                                  </label>
                                );
                              })}
                              {(() => {
                                const currentObjs = ensureArrayOfStrings(proposalDetails.objectives);
                                const isOthersChecked = currentObjs.includes('Others');
                                return (
                                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full col-span-1 md:col-span-2 min-w-0">
                                    <label className="flex items-center gap-3 cursor-pointer group shrink-0">
                                      <div className={`w-5 h-5 rounded flex items-center justify-center border-2 ${isOthersChecked ? 'bg-primary-green border-primary-green text-white' : 'border-gray-300 group-hover:border-primary-green'}`}>
                                        {isOthersChecked && <Check size={14} strokeWidth={3} />}
                                      </div>
                                      <span className="text-sm font-bold text-gray-600">Others</span>
                                      <input 
                                        type="checkbox" 
                                        className="hidden" 
                                        checked={isOthersChecked} 
                                        onChange={() => {
                                          toggleArrayField('objectives', 'Others');
                                          clearDraftField('objectives');
                                        }} 
                                      />
                                    </label>
                                    <input 
                                      type="text" 
                                      className={`flex-1 min-w-0 w-full px-4 py-2 border-2 font-bold text-sm outline-none transition-all rounded-xl ${
                                        showValidationHighlights && isOthersChecked && !proposalDetails.others_objective?.trim()
                                          ? 'border-red-500 bg-red-50/70 text-red-900 ring-2 ring-red-400/30'
                                          : draftLoadedFields.has('others_objective')
                                            ? 'bg-amber-50/70 border-amber-200 text-gray-800'
                                            : 'bg-gray-50 border-gray-200 focus:border-primary-green'
                                      }`} 
                                      value={proposalDetails.others_objective || ''} 
                                      onChange={e => {
                                        setProposalDetails({ ...proposalDetails, others_objective: e.target.value });
                                        clearDraftField('others_objective');
                                      }} 
                                      placeholder="Specify other objective..."
                                      disabled={!isOthersChecked} 
                                    />
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </div>

                        {/* Needs and Goals */}
                        <div className="pt-6 border-t border-gray-100 space-y-4">
                          <div className="flex items-center justify-between gap-4">
                            <label className="text-xs font-bold text-gray-600 italic">
                              Describe how this activity will satisfy the needs of the organization and how it will help the organization achieve its goals <span className="text-red-500">*</span>
                            </label>
                            {showValidationHighlights && isFieldSkipped('satisfaction_goal_1') && (
                              <span className="text-[10px] font-black text-red-600 bg-red-100 border border-red-200 px-2 py-0.5 rounded-full uppercase flex items-center gap-1 shrink-0">
                                <AlertCircle size={10} /> Field Required
                              </span>
                            )}
                          </div>
                          <div className="space-y-3">
                            <div className={`space-y-1 ${showValidationHighlights && isFieldSkipped('satisfaction_goal_1') ? 'skipped-field-highlight' : ''}`}>
                              <div className="flex items-start gap-4">
                                <span className="font-bold text-gray-600 mt-2">1.</span>
                                <input 
                                  type="text" 
                                  className={`flex-1 px-4 py-2 border-2 font-bold text-sm outline-none transition-all rounded-xl ${
                                    showValidationHighlights && isFieldSkipped('satisfaction_goal_1')
                                      ? 'border-red-500 bg-red-50/70 text-red-900 ring-2 ring-red-400/30'
                                      : draftLoadedFields.has('satisfaction_goal_1')
                                        ? 'bg-amber-50/70 border-amber-200 text-gray-800'
                                        : 'bg-gray-50 border-gray-200 focus:border-primary-green'
                                  }`} 
                                  value={proposalDetails.satisfaction_goal_1} 
                                  onChange={e => {
                                    const val = e.target.value;
                                    setProposalDetails(prev => ({
                                      ...prev,
                                      satisfaction_goal_1: val,
                                      satisfaction_goal_2: val ? prev.satisfaction_goal_2 : '',
                                      satisfaction_goal_3: val ? prev.satisfaction_goal_3 : ''
                                    }));
                                    clearDraftField('satisfaction_goal_1');
                                  }} 
                                />
                              </div>
                            </div>
                            <div className="flex items-start gap-4">
                              <span className="font-bold text-gray-600 mt-2">2.</span>
                              <input 
                                type="text" 
                                className={`flex-1 px-4 py-2 border-b-2 font-bold text-sm outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                                  draftLoadedFields.has('satisfaction_goal_2')
                                    ? 'bg-amber-50/70 border-amber-200 text-gray-800'
                                    : 'bg-gray-50 border-gray-200 focus:border-primary-green'
                                }`} 
                                disabled={!proposalDetails.satisfaction_goal_1} 
                                value={proposalDetails.satisfaction_goal_2} 
                                onChange={e => {
                                  const val = e.target.value;
                                  setProposalDetails(prev => ({
                                    ...prev,
                                    satisfaction_goal_2: val,
                                    satisfaction_goal_3: val ? prev.satisfaction_goal_3 : ''
                                  }));
                                  clearDraftField('satisfaction_goal_2');
                                }} 
                              />
                            </div>
                            <div className="flex items-start gap-4">
                              <span className="font-bold text-gray-600 mt-2">3.</span>
                              <input 
                                type="text" 
                                className={`flex-1 px-4 py-2 border-b-2 font-bold text-sm outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                                  draftLoadedFields.has('satisfaction_goal_3')
                                    ? 'bg-amber-50/70 border-amber-200 text-gray-800'
                                    : 'bg-gray-50 border-gray-200 focus:border-primary-green'
                                }`} 
                                disabled={!proposalDetails.satisfaction_goal_2} 
                                value={proposalDetails.satisfaction_goal_3} 
                                onChange={e => {
                                  setProposalDetails({ ...proposalDetails, satisfaction_goal_3: e.target.value });
                                  clearDraftField('satisfaction_goal_3');
                                }} 
                              />
                            </div>
                          </div>
                        </div>

                        {/* Partners & Sponsors */}
                        <div className="pt-6 border-t border-gray-100 space-y-4">
                          <div className="space-y-2">
                            <label className="text-xs font-black text-gray-600 uppercase">Name of Partners (if any)</label>
                            <input 
                              type="text" 
                              className={`w-full px-4 py-3 border-b-2 font-bold text-sm outline-none transition-all ${
                                draftLoadedFields.has('partners')
                                  ? 'bg-amber-50/70 border-amber-200 text-gray-800'
                                  : 'bg-gray-50 border-gray-200 focus:border-primary-green'
                              }`} 
                              value={proposalDetails.partners} 
                              onChange={e => {
                                setProposalDetails({ ...proposalDetails, partners: e.target.value });
                                clearDraftField('partners');
                              }} 
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-black text-gray-600 uppercase">Name of Sponsors (if any)</label>
                            <input 
                              type="text" 
                              className={`w-full px-4 py-3 border-b-2 font-bold text-sm outline-none transition-all ${
                                draftLoadedFields.has('sponsors')
                                  ? 'bg-amber-50/70 border-amber-200 text-gray-800'
                                  : 'bg-gray-50 border-gray-200 focus:border-primary-green'
                              }`} 
                              value={proposalDetails.sponsors} 
                              onChange={e => {
                                setProposalDetails({ ...proposalDetails, sponsors: e.target.value });
                                clearDraftField('sponsors');
                              }} 
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {proposalStep === 2 && (
                    <div className="bg-white p-3 sm:p-6 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-right-4 duration-500 overflow-hidden">
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-primary-green/10 rounded-xl flex items-center justify-center text-primary-green shrink-0">
                            <Eye size={20} />
                          </div>
                          <div>
                            <h2 className="text-xl font-black text-gray-800 uppercase tracking-widest">Preview & Download Form</h2>
                            <p className="text-xs font-bold text-gray-400 mt-1">Review your generated proposal and save it as a PDF before proceeding.</p>
                          </div>
                        </div>
                        {hasDownloadedProposal && (
                          <div className="flex items-center gap-2 text-primary-green bg-green-50 px-4 py-2 rounded-lg shrink-0">
                            <CheckCircle2 size={16} />
                            <span className="text-xs font-black uppercase tracking-widest">Document Ready</span>
                          </div>
                        )}
                      </div>
                      
                      {!hasDownloadedProposal && (
                        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3 items-start animate-in fade-in zoom-in-95">
                          <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={18} />
                          <div>
                            <p className="text-sm font-bold text-amber-800">Important Action Required</p>
                            <p className="text-xs font-medium text-amber-700 mt-1">
                              You must download this generated Activity Proposal Form. You will be required to upload it as one of the requirements in the next phase.
                            </p>
                          </div>
                        </div>
                      )}
                      
                      <div className="w-full">
                        <ActivityProposalPreviewModal
                          inline={true}
                          isOpen={true}
                          proposalDetails={proposalDetails}
                          user={user}
                          onDownload={() => setHasDownloadedProposal(true)}
                        />
                      </div>
                    </div>
                  )}

                  {proposalStep === 3 && (
                    <div className="bg-white p-4 sm:p-8 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-right-4 duration-500">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pb-6 border-b border-gray-100 mb-6">
                        <div className="w-10 h-10 bg-primary-green/10 rounded-xl flex items-center justify-center text-primary-green shrink-0">
                          <Upload size={20} />
                        </div>
                        <div>
                          <h2 className="text-xl font-black text-gray-800 uppercase tracking-widest">Upload Requirements</h2>
                          <p className="text-xs font-bold text-gray-400 mt-1">Please provide all necessary documents below to complete your submission</p>
                        </div>
                        <div className="sm:ml-auto">
                          <span className="text-xs font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg uppercase tracking-widest">
                            {attachedRequirementIds.size} / {requirements.length} attached
                          </span>
                        </div>
                      </div>

                      {renderRequirementsList(true)}
                    </div>
                  )}
                </div>
              )}

              {/* Conditional Non-Proposal List */}
              {!isProposal && renderRequirementsList(false)}
            </div>
          </div>

          {/* Fixed Bottom Action Bar */}
          <div className="fixed bottom-0 left-0 md:left-64 right-0 bg-white/95 backdrop-blur-md border-t border-gray-100 shadow-[0_-5px_20px_rgba(0,0,0,0.08)] z-50 p-2.5 sm:p-4 flex justify-center w-full md:w-[calc(100%-16rem)]">
            <div className="max-w-[90rem] w-full flex items-center justify-between sm:justify-end gap-1.5 sm:gap-3 px-1 sm:px-4">

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end">
                {isProposal ? (
                  <>
                    {proposalStep > 1 && !(isReturnedDocument && !is02F1Returned) && (
                      <button
                        type="button"
                        onClick={() => setProposalStep(prev => prev - 1)}
                        className="px-2.5 sm:px-4 py-2 sm:py-2.5 bg-white border border-gray-200 text-gray-500 font-black rounded-lg hover:bg-gray-50 transition-all flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] uppercase shadow-sm tracking-tight sm:tracking-widest mr-auto shrink-0"
                      >
                        <ArrowLeft size={13} /> <span>Back</span>
                      </button>
                    )}

                    {proposalStep === 1 && (
                      <button
                        type="button"
                        onClick={() => setShowClearModal(true)}
                        className="px-2.5 sm:px-4 py-2 sm:py-2.5 bg-white border border-gray-200 text-gray-500 font-black rounded-lg hover:bg-gray-50 transition-all flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] uppercase shadow-sm tracking-tight sm:tracking-widest shrink-0"
                      >
                        <Eraser size={13} /> <span className="hidden xs:inline">Clear Form</span><span className="xs:hidden">Clear</span>
                      </button>
                    )}

                    {proposalStep === 3 && (Object.keys(localFiles).length > 0 || existingAttachments.length > 0) && (
                      <button
                        type="button"
                        onClick={() => clearFormOptions('attachments')}
                        className="px-2.5 sm:px-4 py-2 sm:py-2.5 bg-white border border-gray-200 text-gray-500 font-black rounded-lg hover:bg-gray-50 transition-all flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] uppercase shadow-sm tracking-tight sm:tracking-widest shrink-0"
                      >
                        <Eraser size={13} /> <span className="hidden xs:inline">Clear Attachments</span><span className="xs:hidden">Clear</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleSaveDraft}
                      disabled={isSaving}
                      className="px-3 sm:px-5 py-2 sm:py-2.5 bg-amber-50 text-amber-600 border border-amber-200 font-black rounded-lg hover:bg-amber-100 transition-all flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] uppercase shadow-sm tracking-tight sm:tracking-widest shrink-0"
                    >
                      <Save size={13} /> <span>Save Draft</span>
                    </button>

                    {proposalStep === 1 && (
                      <button
                        type="button"
                        onClick={handleNextFromStep1}
                        disabled={isReturnedDocument && is02F1Returned && !hasFormChanges}
                        className="px-4 sm:px-8 py-2 sm:py-2.5 bg-primary-green text-white font-black rounded-lg hover:bg-green-700 hover:scale-105 active:scale-95 transition-all shadow-md shadow-green-600/20 flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] uppercase disabled:opacity-50 tracking-tight sm:tracking-widest shrink-0"
                        title={
                          isReturnedDocument && is02F1Returned && !hasFormChanges
                            ? "Make changes to the form content before proceeding"
                            : "Click to validate and proceed to next step"
                        }
                      >
                        <span>Next Step</span> <ChevronRight size={13} />
                      </button>
                    )}

                    {proposalStep === 2 && (
                      <button
                        type="button"
                        onClick={() => setProposalStep(3)}
                        disabled={!hasDownloadedProposal}
                        className="px-4 sm:px-8 py-2 sm:py-2.5 bg-primary-green text-white font-black rounded-lg hover:bg-green-700 hover:scale-105 active:scale-95 transition-all shadow-md shadow-green-600/20 flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] uppercase disabled:opacity-50 tracking-tight sm:tracking-widest shrink-0"
                        title={!hasDownloadedProposal ? "Please download the form to continue" : "Proceed to next step"}
                      >
                        <span>Next Step</span> <ChevronRight size={13} />
                      </button>
                    )}

                    {proposalStep === 3 && (
                      <button
                        type="submit"
                        disabled={isResubmitDisabled || isSaving}
                        className={`px-4 sm:px-6 py-2 sm:py-2.5 font-black rounded-lg transition-all shadow-md flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] uppercase tracking-tight sm:tracking-widest shrink-0 ${
                          isResubmitDisabled || isSaving
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-60'
                            : 'bg-primary-green text-white hover:bg-green-700 hover:scale-105 active:scale-95 shadow-green-600/20'
                        }`}
                        title={
                          isResubmitDisabled
                            ? (is02F1Returned && !hasFormChanges
                                ? "Edit the form content fields to enable the Resubmit button."
                                : "Please upload replacement .pdf files for all returned attachments.")
                            : "Resubmit Document"
                        }
                      >
                        {isSaving ? <Loader2 className="animate-spin" size={13} /> : (isReturnedDocument ? <RefreshCcw size={13} /> : <Send size={13} />)}
                        <span>{isReturnedDocument ? 'Resubmit' : 'Register'}</span>
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    {(Object.keys(localFiles).length > 0 || existingAttachments.length > 0) && (
                      <button
                        type="button"
                        onClick={() => clearFormOptions('attachments')}
                        className="px-2.5 sm:px-4 py-2 sm:py-2.5 bg-white border border-gray-200 text-gray-500 font-black rounded-lg hover:bg-gray-50 transition-all flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] uppercase shadow-sm tracking-tight sm:tracking-widest shrink-0"
                      >
                        <Eraser size={13} /> <span className="hidden xs:inline">Clear Attachments</span><span className="xs:hidden">Clear</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleSaveDraft}
                      disabled={isSaving}
                      className="px-3 sm:px-5 py-2 sm:py-2.5 bg-amber-50 text-amber-600 border border-amber-200 font-black rounded-lg hover:bg-amber-100 transition-all flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] uppercase shadow-sm tracking-tight sm:tracking-widest shrink-0"
                    >
                      <Save size={13} /> <span>Save Draft</span>
                    </button>
                    <button
                      type="submit"
                      disabled={isResubmitDisabled || isSaving}
                      className={`px-4 sm:px-6 py-2 sm:py-2.5 font-black rounded-lg transition-all shadow-md flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] uppercase tracking-tight sm:tracking-widest shrink-0 ${
                        isResubmitDisabled || isSaving
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-60'
                          : 'bg-primary-green text-white hover:bg-green-700 hover:scale-105 active:scale-95 shadow-green-600/20'
                      }`}
                      title={
                        isResubmitDisabled
                          ? (isReturnedDocument
                              ? "Upload replacement .pdf files for all returned attachments."
                              : "Please attach files for all required documents before registering.")
                          : ""
                      }
                    >
                      {isSaving ? <Loader2 className="animate-spin" size={13} /> : (isReturnedDocument ? <RefreshCcw size={13} /> : <Send size={13} />)}
                      <span>{isReturnedDocument ? 'Resubmit' : 'Register'}</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Upload Requirements Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col animate-in zoom-in-95">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-black text-gray-800 uppercase">Required Attachments</h2>
                <p className="text-xs font-bold text-gray-400 mt-1">Please provide all necessary documents below</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg uppercase tracking-widest">
                  {attachedRequirementIds.size} / {requirements.length} attached
                </span>
                <button type="button" onClick={() => setShowUploadModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-all text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
              {renderRequirementsList(true)}
            </div>

            <div className="p-6 border-t border-gray-100 flex justify-end bg-white rounded-b-2xl">
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="px-6 py-2.5 bg-gray-900 text-white font-black rounded-lg hover:bg-black transition-all shadow-md text-xs uppercase tracking-widest"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center animate-in zoom-in-95">
            <h3 className="text-lg font-black text-gray-800 mb-4 uppercase">Clear Progress</h3>
            <p className="text-sm font-bold text-gray-500 mb-6">What would you like to clear?</p>
            <div className="space-y-3">
              {isProposal && (
                <button type="button" onClick={() => clearFormOptions('details')} className="w-full py-3 bg-gray-50 hover:bg-gray-100 font-bold rounded-lg text-sm transition-all text-gray-700">Clear Form Details Only</button>
              )}
              <button type="button" onClick={() => clearFormOptions('attachments')} className="w-full py-3 bg-gray-50 hover:bg-gray-100 font-bold rounded-lg text-sm transition-all text-gray-700">Remove All Attachments</button>
              <button type="button" onClick={() => clearFormOptions('both')} className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-lg text-sm transition-all">Clear Everything</button>
              <button type="button" onClick={() => setShowClearModal(false)} className="w-full py-3 text-gray-400 font-bold text-sm hover:text-gray-600 transition-all mt-2">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Unsaved Changes Warning Modal */}
      {showUnsavedModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center animate-in zoom-in-95">
            <AlertCircle size={56} className="text-amber-500 mx-auto mb-6" />
            {isReturnedDocument ? (
              <>
                <h3 className="text-2xl font-black text-gray-800 mb-2 uppercase tracking-tight">Leave Revision</h3>
                <p className="text-sm font-bold text-gray-500 mb-8">Changes will not be saved. Are you sure you want to leave?</p>
                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUnsavedModal(false);
                      setLocalFiles({});
                      setHasUnsavedChanges(false);
                      window.__hasUnsavedChanges = false;
                      const dest = pendingNavPath || '/my-documents';
                      setPendingNavPath(null);
                      navigate(dest);
                    }}
                    className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl transition-all uppercase tracking-widest text-sm shadow-lg shadow-red-600/20"
                  >
                    OK
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowUnsavedModal(false);
                      setPendingNavPath(null);
                    }}
                    className="w-full py-3 text-gray-400 font-bold text-sm hover:text-gray-600 transition-all uppercase tracking-widest"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-2xl font-black text-gray-800 mb-2 uppercase tracking-tight">Unsaved Progress</h3>
                <p className="text-sm font-bold text-gray-500 mb-8">You have unsaved changes. Would you like to save them as a draft before leaving?</p>
                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUnsavedModal(false);
                      handleSaveDraft();
                    }}
                    className="w-full py-3.5 bg-primary-green text-white font-black rounded-xl hover:bg-green-700 transition-all uppercase tracking-widest text-sm shadow-lg shadow-green-600/20"
                  >
                    Save as Draft
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setShowUnsavedModal(false);
                      await deleteDraftIfNew();
                      clearFormOptions('both', true);
                      setHasUnsavedChanges(false);
                      window.__hasUnsavedChanges = false;
                      const dest = pendingNavPath || '/my-documents';
                      setPendingNavPath(null);
                      navigate(dest);
                    }}
                    className="w-full py-3.5 bg-red-50 text-red-600 hover:bg-red-100 font-black rounded-xl transition-all uppercase tracking-widest text-sm"
                  >
                    Discard Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowUnsavedModal(false);
                      setPendingNavPath(null);
                    }}
                    className="w-full py-3 text-gray-400 font-bold text-sm hover:text-gray-600 transition-all mt-2 uppercase tracking-widest"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}


      {/* Blocked Date Modal */}
      {blockedDateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] w-full max-w-md p-8 flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 text-gray-800 relative overflow-hidden border border-gray-100">
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-red-500 via-amber-500 to-red-500"></div>

            <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mb-5 mx-auto border border-red-100 shadow-inner">
              <Calendar size={28} />
            </div>

            <h3 className="text-xl font-extrabold text-center text-gray-900 tracking-tight">Date Unavailable</h3>
            <p className="text-center font-semibold text-gray-500 text-xs mt-1 uppercase tracking-wider">{blockedDateModal.date}</p>

            <div className="my-6 bg-red-50/60 border border-red-100 rounded-2xl p-5 text-center space-y-2">
              <p className="text-sm font-bold text-red-900 leading-relaxed">
                {blockedDateModal.date} is blocked because of <span className="underline font-black">{blockedDateModal.title}</span>.
              </p>
              {blockedDateModal.reason && blockedDateModal.reason !== `${blockedDateModal.date} is blocked because of ${blockedDateModal.title}.` && (
                <p className="text-xs text-red-700 leading-relaxed font-medium">
                  {blockedDateModal.reason}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => setBlockedDateModal(null)}
              className="w-full py-3.5 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl text-xs uppercase tracking-widest transition-all shadow-md active:scale-95"
            >
              Understood
            </button>
          </div>
        </div>
      )}

      {/* Validation Guidance Error Modal */}
      {validationErrorModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] w-full max-w-lg p-8 flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 text-gray-800 relative overflow-hidden border border-gray-100">
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-500 via-red-500 to-amber-500"></div>

            <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-4 mx-auto border border-amber-100 shadow-inner">
              <AlertCircle size={28} />
            </div>

            <h3 className="text-xl font-extrabold text-center text-gray-900 tracking-tight">Unable to Continue</h3>
            <p className="text-center font-bold text-gray-500 text-xs mt-1 uppercase tracking-wider">Please complete the following required fields:</p>

            <div className="my-6 max-h-60 overflow-y-auto space-y-2.5 pr-1">
              {validationErrorModal.missingFields.map((err, idx) => (
                <div key={idx} className="bg-red-50/70 border border-red-100 rounded-xl p-3 flex items-start gap-3">
                  <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 mt-1.5" />
                  <div>
                    <p className="text-xs font-black text-red-900 uppercase tracking-wider">{err.field}</p>
                    <p className="text-xs text-red-700 font-medium mt-0.5">{err.message}</p>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-[11px] font-bold text-gray-400 text-center mb-6">
              💡 Please review all fields marked with a red asterisk (<span className="text-red-500">*</span>).
            </p>

            <button
              type="button"
              onClick={() => setValidationErrorModal(null)}
              className="w-full py-3.5 bg-primary-green hover:bg-green-700 text-white font-black rounded-xl text-xs uppercase tracking-widest transition-all shadow-md active:scale-95"
            >
              Understood, I'll Fix These
            </button>
          </div>
        </div>
      )}

      {/* Network Connection Error Modal */}
      {networkErrorModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] w-full max-w-md p-8 flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 text-gray-800 relative overflow-hidden border border-gray-100 text-center">
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-500 via-red-500 to-amber-500"></div>

            <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-5 mx-auto border border-amber-100 shadow-inner">
              <WifiOff size={28} />
            </div>

            <h3 className="text-xl font-extrabold text-gray-900 tracking-tight mb-2">
              {networkErrorModal.title || 'Network Connection Issue'}
            </h3>

            <div className="my-4 bg-amber-50/60 border border-amber-100 rounded-2xl p-5 text-center space-y-2">
              <p className="text-xs text-amber-900 leading-relaxed font-semibold">
                {networkErrorModal.message || 'We lost connection to the server or your internet connection is slow/unstable. Please check your network connection and try again.'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setNetworkErrorModal(null)}
              className="w-full py-3.5 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl text-xs uppercase tracking-widest transition-all shadow-md active:scale-95 mt-2"
            >
              Understood
            </button>
          </div>
        </div>
      )}

      <ActivityProposalPreviewModal
        isOpen={isActivityPreviewOpen}
        onClose={() => setIsActivityPreviewOpen(false)}
        proposalDetails={proposalDetails}
        user={user}
      />
    </div>
  );
};

export default SubmitNewDocument;
