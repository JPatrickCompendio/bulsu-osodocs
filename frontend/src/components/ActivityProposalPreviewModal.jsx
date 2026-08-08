import React, { useEffect, useState, useRef, useMemo } from 'react';
import { X, Printer, Edit3 } from 'lucide-react';
import JoditEditor from 'jodit-react';
import HEADER_LOGO_IMG from '../assets/headerLOGO.png';

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

const ActivityProposalPreviewModal = ({
  isOpen,
  onClose,
  proposalDetails,
  user,
  inline = false,
  onDownload
}) => {
  const [content, setContent] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [headerLogoBase64, setHeaderLogoBase64] = useState('');
  
  const editorRef = useRef(null);

  const config = useMemo(() => ({
    readonly: false,
    height: 'auto',
    width: '100%',
    toolbarAdaptive: false,
    buttons: [
      'bold', 'italic', 'underline', 'strikethrough', '|',
      'font', 'fontsize', 'brush', 'paragraph', '|',
      'image', 'table', 'link', '|',
      'align', 'undo', 'redo', 'hr', 'eraser'
    ],
    uploader: { insertImageAsBase64URI: true }
  }), []);

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
    img.onerror = () => resolve(src);
  });

  useEffect(() => {
    const loadDefaultImages = async () => {
      if (!headerLogoBase64) setHeaderLogoBase64(await getBase64(HEADER_LOGO_IMG));
    };
    if (isOpen || inline) loadDefaultImages();
  }, [isOpen, inline]);

  useEffect(() => {
    if (!isOpen && !inline) {
      setIsInitialized(false);
      setContent('');
      return;
    }
    if (isInitialized) return;

    const buildInitialHtml = async () => {
      const renderCheckbox = (label, isChecked) => `
        <div style="display: flex; align-items: center; margin-right: 25px; font-size: 12px; font-weight: bold; margin-bottom: 4px;">
          <div style="display: flex; justify-content: center; align-items: center; width: 13px; height: 13px; border: 1.5px solid black; margin-right: 6px; font-size: 12px; flex-shrink: 0;">
            ${isChecked ? '✓' : ''}
          </div>
          ${label}
        </div>
      `;

      const getObjectiveChecked = (val) => proposalDetails.objectives?.includes(val);

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

      const initialHtml = `
        <style>
          .form-row { display: flex; align-items: flex-end; margin-bottom: 7px; }
          .form-label { font-weight: bold; font-size: 12px; margin-right: 5px; white-space: nowrap; }
          .form-line { flex-grow: 1; border-bottom: 1.5px solid black; min-height: 15px; font-size: 12px; font-weight: normal; padding-bottom: 1px; text-align: left; padding-left: 8px; }
          .section-title { font-weight: bold; font-size: 12px; margin-top: 8px; margin-bottom: 4px; }
        </style>
        <div style="padding: 10px 15px; font-family: Arial, Helvetica, sans-serif; color: black; background: white; font-size: 12px; display: flex; flex-direction: column; min-height: 1040px; box-sizing: border-box;">
          
          <div style="text-align: center; margin-bottom: 6px;">
            <img src="${headerLogoBase64 || HEADER_LOGO_IMG}" style="height: 70px; width: auto; object-fit: contain; margin: 0 auto; display: block;" alt="BulSU Logo" />
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
            <div class="form-line">${proposalDetails.activity_number || proposalDetails.tracking_number || ''}</div>
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
              ${(proposalDetails.schedules && proposalDetails.schedules.length > 0) ? proposalDetails.schedules.map(sched => {
                const startStr = sched.activity_date ? new Date(sched.activity_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'TBD';
                if (sched.end_date) {
                  const endStr = new Date(sched.end_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                  return `${startStr} – ${endStr}`;
                }
                return `${startStr} — ${formatTime(sched.start_time)} – ${sched.is_indefinite ? 'INDEFINITE' : formatTime(sched.end_time)}`;
              }).join(' | ') : (proposalDetails.activity_dates && proposalDetails.activity_dates.length > 0 ? proposalDetails.activity_dates.map(d => new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })).join(', ') : '—')}
            </div>
          </div>

          <div class="form-row">
            <div class="form-label">Duration:</div>
            <div class="form-line">${proposalDetails.is_indefinite_end_time ? 'INDEFINITE' : formatDuration(Math.round(parseFloat(proposalDetails.duration || 0) * 60))}</div>
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
      `;

      setContent(initialHtml);
      setIsInitialized(true);
    };

    buildInitialHtml();
  }, [isOpen, isInitialized, proposalDetails, user]);

  if (!isOpen && !inline) return null;

  const handlePrint = () => {
    const printIframe = document.createElement('iframe');
    printIframe.style.position = 'absolute';
    printIframe.style.width = '0px';
    printIframe.style.height = '0px';
    printIframe.style.border = 'none';
    document.body.appendChild(printIframe);

    const doc = printIframe.contentWindow.document;
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
            ${content}
          </div>
        </body>
      </html>
    `);
    doc.close();

    const originalTitle = document.title;
    document.title = "Activity Proposal Form";

    printIframe.contentWindow.focus();
    setTimeout(() => {
      printIframe.contentWindow.print();
      document.title = originalTitle;
      
      if (onDownload) onDownload();
      setTimeout(() => {
        document.body.removeChild(printIframe);
      }, 2000);
    }, 500);
  };

  return (
    <div className={inline ? "w-full animate-in fade-in duration-300" : "fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-300"}>
      <div className={`bg-white overflow-hidden flex flex-col ${inline ? 'rounded-2xl border border-gray-200 shadow-sm' : 'rounded-3xl w-full max-w-5xl h-[90vh] shadow-2xl shadow-black/20'}`}>
        
        {/* Header */}
        {!inline && (
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0 relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                <Edit3 size={20} />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-gray-900 tracking-tight">Advanced Document Editor</h2>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mt-0.5">Edit Layout & Content</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="w-10 h-10 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        )}

        {/* Toolbar */}
        <div className="px-6 py-3 border-b border-gray-100 bg-gray-50/50 flex flex-wrap items-center gap-4 shrink-0 relative z-10">
          <div className="flex-1"></div>
          
          <button 
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2 bg-primary-green hover:bg-green-700 text-white rounded-xl text-sm font-bold shadow-md shadow-green-600/20 transition-all active:scale-95"
          >
            <Printer size={16} />
            Print / Save as PDF
          </button>
        </div>

        {/* Editor Area Wrapper */}
        <div className={`flex-1 w-full bg-gray-200 p-4 md:p-8 ${inline ? '' : 'overflow-y-auto custom-scrollbar'}`}>
          
          {/* Paper Container */}
          <div 
            className={`max-w-[794px] mx-auto min-h-[1123px] flex flex-col relative bg-white ${inline ? 'origin-top scale-[0.80] mb-[-224px]' : ''}`}
            style={{
              boxShadow: '0 0 20px rgba(0,0,0,0.15)'
            }}
          >
            {/* Jodit Content (Body) */}
            <div className="flex-1 jodit-seamless-wrapper relative">
              {!isInitialized ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
                </div>
              ) : (
                <>
                  <style>{`
                    .jodit-seamless-wrapper .jodit-container {
                      border: none !important;
                    }
                    .jodit-seamless-wrapper .jodit-toolbar__box {
                      position: sticky;
                      top: 0;
                      z-index: 50;
                      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    }
                    .jodit-seamless-wrapper .jodit-workplace {
                      background: transparent !important;
                    }
                    .jodit-seamless-wrapper .jodit-wysiwyg {
                      background: transparent !important;
                      padding: 0 !important;
                    }
                  `}</style>
                  <JoditEditor
                    ref={editorRef}
                    value={content}
                    config={config}
                    onBlur={newContent => setContent(newContent)}
                    onChange={() => {}} 
                  />
                </>
              )}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

export default ActivityProposalPreviewModal;
