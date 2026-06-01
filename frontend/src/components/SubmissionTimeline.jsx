import React from 'react';
import { Paperclip } from 'lucide-react';
import {
  buildTimelineDisplayLogs,
  formatLogActionLabel,
  getTimelineActorDisplay,
  isLogApproved,
  isLogPending,
  isLogReturned
} from '../utils/submissionLogUtils';

const SubmissionTimeline = ({
  timelineLogs,
  submissionStatus,
  allVersions,
  viewingVersionId,
  currentVersionId,
  title = 'Submission Lifecycle & Timeline',
  subtitle = 'Full chronological audit history of reviews, actions and comments',
  className = 'mb-12 text-gray-800 bg-gray-50/50 rounded-3xl p-8 border border-gray-100',
  emptyMessage = 'No actions have been logged yet for this submission.'
}) => {
  const { displayLogs, historyCount } = buildTimelineDisplayLogs(timelineLogs, {
    submissionStatus,
    allVersions,
    viewingVersionId,
    currentVersionId
  });

  return (
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
                  className={`absolute -left-[41px] top-1 w-6 h-6 rounded-full border-4 border-white flex items-center justify-center shadow-sm z-10 ${dotClass}`}
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

                  {log.comment ? (
                    <div
                      className={`rounded-xl p-4 text-xs font-medium border italic leading-relaxed ${
                        isPending
                          ? 'bg-white/60 text-slate-500 border-slate-200'
                          : 'bg-gray-50 text-gray-600 border-gray-100'
                      }`}
                    >
                      &ldquo;{log.comment}&rdquo;
                    </div>
                  ) : log.description ? (
                    <div
                      className={`rounded-xl p-4 text-xs font-medium border italic leading-relaxed ${
                        isPending
                          ? 'bg-white/60 text-slate-500 border-slate-200'
                          : 'bg-gray-50 text-gray-600 border-gray-100'
                      }`}
                    >
                      &ldquo;{log.description}&rdquo;
                    </div>
                  ) : (
                    <p className="text-gray-400 text-xs italic font-medium">No comments provided.</p>
                  )}
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
  );
};

export default SubmissionTimeline;
