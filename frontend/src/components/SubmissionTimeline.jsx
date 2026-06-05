import React from 'react';
import { Eye, Paperclip, X, FileText } from 'lucide-react';
import { supabase } from '../supabaseClient';
import {
  buildTimelineDisplayLogs,
  formatLogActionLabel,
  getTimelineActorDisplay,
  isLogApproved,
  isLogPending,
  isLogReturned
} from '../utils/submissionLogUtils';

const escapeRegExp = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const extractProofReference = (log) => {
  const text = `${log?.comment || ''} ${log?.description || ''}`;

  const explicitMatch = text.match(/Proof(?:\s+attachment)?:\s*([^\n]+)/gi);
  if (explicitMatch?.length) {
    return explicitMatch[0].replace(/^Proof(?:\s+attachment)?:\s*/i, '').trim();
  }

  const fallbackMatch = text.match(/https?:\/\/[^\s)]+/gi);
  return fallbackMatch?.[0] || null;
};

const isImageUrl = (url) => /\.(png|jpe?g|webp|gif|bmp)$/i.test(String(url || ''));

const stripProofReferenceFromText = (text) => {
  const rawText = String(text || '').trim();
  if (!rawText) return '';

  const proofReference = extractProofReference({ comment: rawText, description: '' });
  if (!proofReference) return rawText;

  const cleaned = rawText
    .replace(new RegExp(`Proof(?:\\s+attachment)?:\\s*${escapeRegExp(proofReference)}`, 'gi'), '')
    .replace(new RegExp(escapeRegExp(proofReference), 'gi'), '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.!?])/g, '$1')
    .trim();

  return cleaned;
};

const getStorageReference = (reference) => {
  const raw = String(reference || '').trim();
  if (!raw) return { bucket: 'documents', path: '' };

  try {
    const parsed = new URL(raw);
    const parts = parsed.pathname.split('/').filter(Boolean);

    if (parts[0] === 'storage' && parts[1] === 'v1' && parts[2] === 'object') {
      const accessType = parts[3];
      const bucket = parts[4];
      const path = parts.slice(5).join('/');
      if (bucket && accessType && path) {
        return { bucket, path: decodeURIComponent(path) };
      }
    }
  } catch (error) {
    // Ignore invalid URLs and use the raw storage path below.
  }

  return {
    bucket: 'documents',
    path: raw.replace(/^documents\//, '').replace(/^public\//, '')
  };
};

const SubmissionTimeline = ({
  timelineLogs,
  submissionStatus,
  allVersions,
  viewingVersionId,
  currentVersionId,
  title = 'Submission Lifecycle & Timeline',
  subtitle = 'Full chronological audit history of reviews, actions and comments',
  className = 'mb-12 text-gray-800 bg-gray-50/50 rounded-3xl p-8 border border-gray-100',
  emptyMessage = 'No actions have been logged yet for this submission.',
  hasDeliveryProof = false,
  onViewDeliveryProof = null
}) => {
  const [proofLinks, setProofLinks] = React.useState({});
  const [selectedProof, setSelectedProof] = React.useState(null);

  const { displayLogs, historyCount } = buildTimelineDisplayLogs(timelineLogs, {
    submissionStatus,
    allVersions,
    viewingVersionId,
    currentVersionId
  });

  const resolveProofUrl = async (reference) => {
    const raw = String(reference || '').trim();
    if (!raw) return null;

    const { bucket, path } = getStorageReference(reference);
    if (path) {
      try {
        const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
        if (!error && data?.signedUrl) return data.signedUrl;
      } catch (err) {
        console.error('Failed to resolve proof URL:', err);
      }
    }

    return /^https?:\/\//i.test(raw) ? raw : null;
  };

  const handleOpenProof = async (log) => {
    const reference = extractProofReference(log);
    const resolvedUrl = await resolveProofUrl(reference);

    setSelectedProof({
      log,
      previewUrl: resolvedUrl || reference || null,
      comment: log?.comment || log?.description || ''
    });
  };

  React.useEffect(() => {
    let cancelled = false;

    const resolveProofLinks = async () => {
      const nextLinks = {};

      for (const [index, log] of displayLogs.entries()) {
        const proofKey = log.id || `${log.created_at || 'pending'}-${index}`;
        const reference = extractProofReference(log);
        const isHttpReference = /^https?:\/\//i.test(String(reference || ''));
        const storagePathMatch = String(reference || '').match(/\/storage\/v1\/object\/(?:public\/)?(.+)/i);
        const cleanPath = storagePathMatch
          ? storagePathMatch[1].replace(/^documents\//, '')
          : String(reference || '').replace(/^documents\//, '');

        if (!reference || (isHttpReference && !storagePathMatch)) {
          nextLinks[proofKey] = reference || null;
          continue;
        }
        try {
          const { data, error } = await supabase.storage.from('documents').createSignedUrl(cleanPath, 3600);
          if (!cancelled && !error && data?.signedUrl) {
            nextLinks[proofKey] = data.signedUrl;
          }
        } catch (err) {
          console.error('Failed to resolve proof link:', err);
        }
      }

      if (!cancelled) setProofLinks(nextLinks);
    };

    resolveProofLinks();

    return () => {
      cancelled = true;
    };
  }, [displayLogs]);

  return (
    <>
    <div className={className}>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wider">{title}</h4>
          <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
        </div>
        <span className="px-3 py-1 bg-white border border-gray-200 text-gray-400 text-[10px] font-bold rounded-lg uppercase tracking-wider shadow-sm">
          {historyCount} History Logs
        </span>
      </div>

      <div className="relative border-l-2 border-dashed border-gray-200 pl-8 ml-3 space-y-8">
        {displayLogs.length > 0 ? (
          displayLogs.map((log, idx) => {
            const isPending = isLogPending(log);
            const isApprove = isLogApproved(log);
            const isReturn = isLogReturned(log);
            const isAttachReview = String(log.action_type || '').toLowerCase() === 'attachment_review';
            const actor = getTimelineActorDisplay(log);
            const proofKey = log.id || `${log.created_at}-${idx}`;
            const proofUrl = proofLinks[proofKey] || extractProofReference(log);
            const visibleComment = stripProofReferenceFromText(log.comment || log.description || '');

            const formattedTime = log.created_at
              ? new Date(log.created_at).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                })
              : 'Pending';

            const dotClass = isPending
              ? 'bg-slate-300 border-dashed'
              : isApprove
                ? 'bg-green-500'
                : isReturn
                  ? 'bg-amber-500'
                  : isAttachReview
                    ? 'bg-indigo-500'
                    : 'bg-blue-500';

            const badgeClass = isPending
              ? 'bg-slate-100 text-slate-500 border border-dashed border-slate-300'
              : isApprove
                ? 'bg-green-50 text-green-700'
                : isReturn
                  ? 'bg-amber-50 text-amber-700'
                  : isAttachReview
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'bg-blue-50 text-blue-700';

            return (
              <div
                key={log.id || idx}
                className={`relative group animate-in fade-in duration-300 ${isPending ? 'opacity-90' : ''}`}
              >
                <div
                  className={`absolute -left-10 top-1 w-6 h-6 rounded-full border-4 border-white flex items-center justify-center shadow-sm z-10 ${dotClass}`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${isPending ? 'bg-slate-500' : 'bg-white'}`} />
                </div>

                <div
                  className={`rounded-2xl p-5 border shadow-sm transition-shadow ${
                    isPending
                      ? 'bg-slate-50/80 border-dashed border-slate-300'
                      : 'bg-white border-gray-200 hover:shadow-md'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-bold ${isPending ? 'text-slate-500' : 'text-gray-800'}`}>
                        {actor.name}
                      </span>
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-400 text-[10px] font-bold rounded uppercase tracking-wider">
                        {actor.role}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-semibold ${
                        isPending ? 'text-slate-400 uppercase tracking-wider' : 'text-gray-400'
                      }`}
                    >
                      {formattedTime}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${badgeClass}`}>
                      {isPending ? 'pending' : formatLogActionLabel(log)}
                    </span>

                    {log.attachment_id && (
                      <span className="px-2 py-0.5 bg-slate-50 border border-slate-100 text-slate-500 text-[10px] font-bold rounded uppercase flex items-center gap-1">
                        <Paperclip size={10} /> Attachment
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
                    {proofUrl ? (
                      <button
                        type="button"
                        onClick={() => handleOpenProof(log)}
                        className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 hover:bg-emerald-100"
                      >
                        <Eye size={12} /> View proof
                      </button>
                    ) : (hasDeliveryProof && log.workflow_phase === 'external-review' && log.action_type === 'forwarded') ? (
                      <button
                        type="button"
                        onClick={onViewDeliveryProof}
                        className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 hover:bg-emerald-100"
                      >
                        <Eye size={12} /> View Proof of Delivery
                      </button>
                    ) : (
                      <span />
                    )}
                  </div>

                  {visibleComment ? (
                    <div
                      className={`rounded-xl p-4 text-xs font-medium border italic leading-relaxed ${
                        isPending
                          ? 'bg-white/60 text-slate-500 border-slate-200'
                          : 'bg-gray-50 text-gray-600 border-gray-100'
                      }`}
                    >
                      &ldquo;{visibleComment}&rdquo;
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })
        ) : (
          <div className="relative pl-2 py-4">
            <p className="text-gray-400 text-xs font-semibold italic">{emptyMessage}</p>
          </div>
        )}
      </div>
    </div>

    {selectedProof && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-sm">
        <div className="w-full max-w-4xl rounded-3xl bg-white shadow-2xl border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <div>
              <h3 className="text-base font-bold text-gray-800">Proof Preview</h3>
              <p className="text-xs text-gray-400">Review the uploaded proof and its note.</p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedProof(null)}
              className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <X size={18} />
            </button>
          </div>

          <div className={`grid gap-6 p-6 ${stripProofReferenceFromText(selectedProof.comment || '') ? 'md:grid-cols-[1.1fr_0.9fr]' : 'md:grid-cols-1'}`}>
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 min-h-[420px] flex items-center justify-center overflow-hidden">
              {selectedProof.previewUrl && isImageUrl(selectedProof.previewUrl) ? (
                <img
                  src={selectedProof.previewUrl}
                  alt="Proof preview"
                  className="h-full max-h-[70vh] w-full rounded-xl object-contain"
                />
              ) : selectedProof.previewUrl ? (
                <iframe
                  src={selectedProof.previewUrl}
                  title="Proof preview"
                  className="h-[70vh] w-full rounded-xl border-0"
                />
              ) : (
                <div className="text-center text-gray-400">
                  <FileText size={40} className="mx-auto mb-3" />
                  <p className="text-sm font-semibold">No preview available for this proof.</p>
                  <p className="text-xs">You can open the original file from the stored log entry.</p>
                </div>
              )}
            </div>

            {stripProofReferenceFromText(selectedProof.comment || '') ? (
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                <p className="text-[11px] uppercase tracking-[0.2em] text-gray-400">Optional note</p>
                <p className="mt-3 rounded-xl border border-gray-100 bg-white p-4 text-sm text-gray-600 italic">
                  {stripProofReferenceFromText(selectedProof.comment || '')}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default SubmissionTimeline;
