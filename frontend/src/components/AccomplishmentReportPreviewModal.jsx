import React, { useEffect, useState, useRef, useMemo } from 'react';
import { X, Printer, Edit3, Image as ImageIcon } from 'lucide-react';
import JoditEditor from 'jodit-react';
import DEFAULT_HEADER_IMG from '../assets/HEADER.png';
import DEFAULT_FOOTER_IMG from '../assets/FOOTER.png';

const AccomplishmentReportPreviewModal = ({
  isOpen,
  onClose,
  submission,
  accomplishmentReport,
  proofImages = [],
  schoolYear = ''
}) => {
  const [content, setContent] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [headerBase64, setHeaderBase64] = useState('');
  const [footerBase64, setFooterBase64] = useState('');

  const editorRef = useRef(null);
  const headerInputRef = useRef(null);
  const footerInputRef = useRef(null);

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
    img.onerror = () => resolve(null);
  });

  useEffect(() => {
    const loadDefaultImages = async () => {
      if (!headerBase64) setHeaderBase64(await getBase64(DEFAULT_HEADER_IMG));
      if (!footerBase64) setFooterBase64(await getBase64(DEFAULT_FOOTER_IMG));
    };
    if (isOpen) loadDefaultImages();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setIsInitialized(false);
      setContent('');
      return;
    }
    if (isInitialized) return;

    const buildInitialHtml = async () => {
      let proofsHtml = '';
      if (proofImages && proofImages.length > 0) {
        const loadedProofs = await Promise.all(
          proofImages.map(async (img) => {
            if (!img.file_url && !img.url) return null;
            const b64 = await getBase64(img.file_url || img.url);
            return b64 ? `<div style="margin-bottom: 20px;"><img src="${b64}" class="default-center-img" style="max-width: 80%; max-height: 400px; object-fit: contain;" /></div>` : '';
          })
        );
        proofsHtml = loadedProofs.filter(Boolean).join('');
      }

      const subtypeName = submission?.document_subtypes?.name || 'MAIN CAMPUS';
      const sy = schoolYear || submission?.school_years?.name || '2025-2026';
      const cleanSy = sy.replace(/S\.Y\.\s*/ig, '').replace(/S\.Y\s*/ig, '').trim();

      const details = Array.isArray(submission?.submission_versions?.[0]?.activity_proposal_details)
        ? submission?.submission_versions[0].activity_proposal_details[submission.submission_versions[0].activity_proposal_details.length - 1]
        : submission?.submission_versions?.[0]?.activity_proposal_details || {};

      const orgName = details?.organization_name || submission?.users?.org_name || 'Organization Name';

      let actNoDisplay = '';
      if (submission?.tracking_number) {
        const parts = String(submission.tracking_number).split('-');
        const lastPart = parts[parts.length - 1];
        actNoDisplay = lastPart ? lastPart.trim() : submission.tracking_number;
      }

      const formatList = (val) => {
        if (!val) return '';
        let items = [];
        try {
          const parsed = typeof val === 'string' ? JSON.parse(val) : val;
          if (Array.isArray(parsed)) {
            items = parsed.map(v => String(v || '').trim()).filter(Boolean);
          }
        } catch (e) { }

        if (items.length === 0) {
          if (Array.isArray(val)) {
            items = val.map(v => String(v || '').trim()).filter(Boolean);
          } else {
            items = String(val)
              .split('\n')
              .map(l => l.trim().replace(/^[•-]\s*/, ''))
              .filter(Boolean);
          }
        }

        if (items.length === 0) return '';
        if (items.length === 1 && !Array.isArray(val) && !String(val).includes('\n') && !String(val).startsWith('[')) {
          return items[0];
        }

        return `<ul style="margin: 0; padding-left: 20px; list-style-type: disc; list-style-position: outside;">` +
          items.map(item => `<li style="margin-bottom: 3px; line-height: 1.4;">${item}</li>`).join('') +
          `</ul>`;
      };

      let dateStrings = [];
      if (details?.activity_schedules && details.activity_schedules.length > 0) {
        dateStrings = details.activity_schedules.map(sched => {
          const d = new Date(sched.activity_date).toLocaleDateString('en-US', { year: '2-digit', month: '2-digit', day: '2-digit' });
          if (sched.end_date) {
            const e = new Date(sched.end_date).toLocaleDateString('en-US', { year: '2-digit', month: '2-digit', day: '2-digit' });
            return `${d} – ${e}`;
          }
          const t = `${sched.start_time} - ${sched.is_indefinite ? 'Indefinite' : sched.end_time}`;
          return `${d} ${t}`;
        });
      } else if (details?.target_date) {
        const targetDateStr = new Date(details.target_date).toLocaleDateString('en-US', { year: '2-digit', month: '2-digit', day: '2-digit' });
        const targetTime = details?.target_time || '';
        if (targetDateStr) {
          dateStrings.push([targetDateStr, targetTime].filter(Boolean).join(', '));
        }
      }

      const place = 'Bulacan State University - Bustos Campus';
      const dateTimePlace = dateStrings.length > 0 ? dateStrings.join(' | ') + ', ' + place : place;

      const initialHtml = `
        <div style="padding: 30px 40px;">
          <div style="text-align: center; font-family: 'Times New Roman', Times, serif; font-size: 14px; margin-bottom: 20px;">
            <strong>STUDENT ORGANIZATIONS-${subtypeName.toUpperCase()} ACCOMPLISHMENT REPORT</strong><br/>
            FOR S.Y. ${cleanSy}<br/><br/>
            <strong style="text-decoration: underline;">${orgName.toUpperCase()}</strong><br/>
            Name of Organization
          </div>
          
          <table style="width: 100%; border-collapse: collapse; border: 1px solid black; font-family: 'Times New Roman', Times, serif; font-size: 13px;">
            <tbody>
              <tr>
                <td style="border: 1px solid black; padding: 8px; width: 35%; font-weight: bold;">Activity No.</td>
                <td style="border: 1px solid black; padding: 8px; width: 65%; font-weight: bold;">${actNoDisplay}</td>
              </tr>
              <tr>
                <td style="border: 1px solid black; padding: 8px; font-weight: bold;">Name of Activity</td>
                <td style="border: 1px solid black; padding: 8px;">${details?.activity_title || submission?.documentType?.name || 'Activity'}</td>
              </tr>
              <tr>
                <td style="border: 1px solid black; padding: 8px; font-weight: bold;">Date/Time/Place</td>
                <td style="border: 1px solid black; padding: 8px;">${dateTimePlace}</td>
              </tr>
              <tr>
                <td style="border: 1px solid black; padding: 8px; font-weight: bold;">Description</td>
                <td style="border: 1px solid black; padding: 8px;">${formatList(details?.nature_of_activity || details?.satisfy_needs)}</td>
              </tr>
              <tr>
                <td style="border: 1px solid black; padding: 8px; font-weight: bold;">Objective/s</td>
                <td style="border: 1px solid black; padding: 8px;">${formatList(details?.objectives || details?.satisfy_goals)}</td>
              </tr>
              <tr>
                <td style="border: 1px solid black; padding: 8px; font-weight: bold;">Participants (College/Unit & Year Level)</td>
                <td style="border: 1px solid black; padding: 8px;">${accomplishmentReport?.participants || ''}</td>
              </tr>
              <tr>
                <td style="border: 1px solid black; padding: 8px; font-weight: bold;">Benefiting Group</td>
                <td style="border: 1px solid black; padding: 8px;">${accomplishmentReport?.benefiting_group || ''}</td>
              </tr>
              <tr>
                <td style="border: 1px solid black; padding: 8px; font-weight: bold;">Resources Used</td>
                <td style="border: 1px solid black; padding: 8px;">${accomplishmentReport?.resources_used || ''}</td>
              </tr>
              <tr>
                <td style="border: 1px solid black; padding: 8px; font-weight: bold;">Co-sponsor (If any)</td>
                <td style="border: 1px solid black; padding: 8px;">${details?.sponsors || 'N/A'}</td>
              </tr>
              <tr>
                <td style="border: 1px solid black; padding: 8px; font-weight: bold;">Problem Encountered</td>
                <td style="border: 1px solid black; padding: 8px;">${accomplishmentReport?.problems_encountered || 'N/A'}</td>
              </tr>
            </tbody>
          </table>
          <br/>
          <div style="text-align: center; font-weight: bold; font-family: 'Times New Roman', Times, serif; font-size: 14px; margin-top: 30px; margin-bottom: 20px;">
            PROOF OF ACTIVITY IMPLEMENTATION
          </div>
          ${proofsHtml}
        </div>
      `;

      setContent(initialHtml);
      setIsInitialized(true);
    };

    buildInitialHtml();
  }, [isOpen, isInitialized, submission, accomplishmentReport, schoolYear, proofImages]);

  if (!isOpen) return null;

  const handleImageUpload = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === 'header') setHeaderBase64(reader.result);
        if (type === 'footer') setFooterBase64(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

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
          <title>Accomplishment Report Document</title>
          <style>
            @media print {
              html, body {
                margin: 0;
                padding: 0;
                background: white;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              @page {
                margin: 0;
                size: A4 portrait;
              }
              thead {
                display: table-header-group;
              }
              tfoot {
                display: table-footer-group;
              }
              tr, table, figure, p, div {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              img {
                max-width: 100% !important;
                height: auto !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              .print-footer-fixed {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                width: 100%;
                z-index: 9999;
                background: white;
              }
            }
            body {
              font-family: 'Times New Roman', Times, serif;
              color: black;
              background: white;
              margin: 0;
              padding: 0;
            }
            .default-center-img {
              display: block;
              margin: 0 auto;
            }
            .header-img {
              width: 100%;
              display: block;
              max-height: 160px;
              object-fit: fill;
            }
            .footer-img {
              width: 100%;
              display: block;
              max-height: 120px;
              object-fit: fill;
            }
            .print-main-table {
              width: 100%;
              border-collapse: collapse;
              border: none;
              margin: 0;
              padding: 0;
            }
            .print-main-table td {
              border: none;
              padding: 0;
            }
            .content-padding {
              padding: 10px 40px;
              box-sizing: border-box;
            }
            .print-footer-fixed {
              position: fixed;
              bottom: 0;
              left: 0;
              right: 0;
              width: 100%;
              z-index: 9999;
              background: white;
            }
          </style>
        </head>
        <body>
          <table class="print-main-table">
            ${headerBase64 ? `
              <thead>
                <tr>
                  <td>
                    <img src="${headerBase64}" class="header-img" alt="Header" />
                  </td>
                </tr>
              </thead>
            ` : ''}
            <tbody>
              <tr>
                <td>
                  <div class="content-padding">
                    ${content}
                  </div>
                </td>
              </tr>
            </tbody>
            ${footerBase64 ? `
              <tfoot>
                <tr>
                  <td style="border: none; padding: 0;">
                    <div style="height: 125px; width: 100%;"></div>
                  </td>
                </tr>
              </tfoot>
            ` : ''}
          </table>
          ${footerBase64 ? `
            <div class="print-footer-fixed">
              <img src="${footerBase64}" class="footer-img" alt="Footer" />
            </div>
          ` : ''}
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

  return (
    <div
      className="fixed inset-0 bg-slate-900/85 z-[999999] flex flex-col items-center justify-start pt-2 sm:pt-4 pb-2 sm:pb-4 px-2 sm:px-4 backdrop-blur-md overflow-hidden"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* ALWAYS VISIBLE FLOATING SOLID RED CLOSE BUTTON */}
      <button
        onClick={onClose}
        className="fixed top-2 right-2 sm:top-4 sm:right-4 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white p-3 rounded-full shadow-2xl z-[1000000] transition-all hover:scale-110 flex items-center justify-center cursor-pointer border-2 border-white"
        title="Close modal"
        aria-label="Close modal"
      >
        <X size={24} className="stroke-[3]" />
      </button>

      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-[1000px] w-full h-[96vh] sm:h-[95vh] shadow-2xl border border-gray-100 overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>

        {/* Sticky Header Bar */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-3 sm:px-6 py-2.5 sm:py-4 flex items-center justify-between gap-2 shrink-0 z-50 w-full shadow-xs">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
              <Edit3 size={16} className="sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-xs sm:text-lg font-bold text-gray-800 truncate">Accomplishment Report</h3>
              <p className="text-[10px] sm:text-xs font-medium text-gray-500 hidden sm:block">Hover over Header/Footer to change images</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={handlePrint} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-[11px] sm:text-sm font-bold transition-all shadow-md">
              <Printer size={15} />
              <span>Print / Save as PDF</span>
            </button>
            <button 
              onClick={onClose} 
              className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl text-[11px] sm:text-sm font-black transition-all shadow-md shrink-0 cursor-pointer" 
              title="Close modal"
            >
              <X size={18} className="stroke-[3]" />
              <span>CLOSE</span>
            </button>
          </div>
        </div>

        {/* Editor Area Wrapper */}
        <div className="flex-1 w-full bg-gray-200 overflow-auto p-2 sm:p-4 md:p-8 custom-scrollbar">

          <input type="file" ref={headerInputRef} accept="image/*" className="hidden" onChange={e => handleImageUpload(e, 'header')} />
          <input type="file" ref={footerInputRef} accept="image/*" className="hidden" onChange={e => handleImageUpload(e, 'footer')} />

          {/* Paper Container */}
          <div
            className="w-[794px] max-w-full sm:max-w-[794px] shrink-0 mx-auto min-h-[1123px] flex flex-col relative bg-white"
            style={{
              boxShadow: '0 0 20px rgba(0,0,0,0.15)'
            }}
          >

            {/* Visual Header */}
            {headerBase64 && (
              <div
                className="relative w-full cursor-pointer group"
                onClick={() => headerInputRef.current.click()}
              >
                <img src={headerBase64} alt="Header" className="w-full max-h-[160px] object-fill block" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity text-white">
                  <ImageIcon size={24} className="mb-2" />
                  <span className="font-bold text-sm tracking-wider uppercase">Change Header</span>
                </div>
              </div>
            )}

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
                    /* Hide the image properties (pencil) button in popups */
                    button[aria-label="Image properties"],
                    button[aria-label="Image"],
                    .jodit-toolbar-button_image,
                    .jodit-toolbar-button_pencil {
                      display: none !important;
                    }
                    /* Class to natively center images but allow Jodit inline overrides */
                    .default-center-img {
                      display: block;
                      margin: 0 auto;
                    }
                  `}</style>
                  <JoditEditor
                    ref={editorRef}
                    value={content}
                    config={config}
                    onBlur={newContent => setContent(newContent)}
                    onChange={() => { }}
                  />
                </>
              )}
            </div>

            {/* Visual Footer */}
            {footerBase64 && (
              <div
                className="relative w-full cursor-pointer group mt-auto"
                onClick={() => footerInputRef.current.click()}
              >
                <img src={footerBase64} alt="Footer" className="w-full max-h-[120px] object-fill block" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity text-white">
                  <ImageIcon size={24} className="mb-2" />
                  <span className="font-bold text-sm tracking-wider uppercase">Change Footer</span>
                </div>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
};

export default AccomplishmentReportPreviewModal;
