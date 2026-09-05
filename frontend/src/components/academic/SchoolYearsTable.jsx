import React, { useState, useEffect } from 'react';
import { 
  ChevronRight, ChevronDown, MoreHorizontal, Plus, Edit3, Lock, Archive, Trash2 
} from 'lucide-react';
import { formatDateRange, parseDateSafe } from '../../utils/academicLifecycle';
import { isAfter } from 'date-fns';

export function SchoolYearsTable({ 
  schoolYears = [], 
  semesters = [],
  canEdit = true,
  onNewSchoolYear,
  onEdit, 
  onClose, 
  onArchive, 
  onDelete,
  onNewSemester,
  onEditSemester,
  onArchiveSemester
}) {
  const [expandedSyIds, setExpandedSyIds] = useState(() => {
    const active = schoolYears.find(s => s.is_active) || schoolYears[0];
    return new Set(active ? [active.id] : []);
  });

  const [activeMenu, setActiveMenu] = useState(null);

  useEffect(() => {
    const handleDocumentClick = () => setActiveMenu(null);
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, []);

  const toggleExpand = (syId) => {
    setExpandedSyIds(prev => {
      const next = new Set(prev);
      if (next.has(syId)) {
        next.delete(syId);
      } else {
        next.add(syId);
      }
      return next;
    });
  };

  const sortedYears = [...schoolYears].sort((a, b) => {
    const aDate = new Date(a.start_date || 0);
    const bDate = new Date(b.start_date || 0);
    return bDate - aDate;
  });

  const getSyBadge = (sy) => {
    if (sy.is_active) {
      return {
        label: 'Active',
        pillClass: 'bg-[#e6f4ea] text-[#137333]',
        dotClass: 'bg-[#137333]'
      };
    }
    if (sy.is_closed || sy.status === 'closed' || sy.is_archived || sy.status === 'archived') {
      return {
        label: sy.status === 'archived' || sy.is_archived ? 'Archived' : 'Completed',
        pillClass: 'bg-[#f1f3f4] text-[#5f6368]',
        dotClass: 'bg-[#5f6368]'
      };
    }
    const today = new Date();
    const end = parseDateSafe(sy.end_date);
    if (end && isAfter(today, end)) {
      return {
        label: 'Completed',
        pillClass: 'bg-[#f1f3f4] text-[#5f6368]',
        dotClass: 'bg-[#5f6368]'
      };
    }
    return {
      label: 'Upcoming',
      pillClass: 'bg-[#fef7e0] text-[#b06000]',
      dotClass: 'bg-[#b06000]'
    };
  };

  const getSemBadge = (sem) => {
    if (sem.is_active) {
      return {
        label: 'Current term',
        pillClass: 'bg-[#e6f4ea] text-[#137333]',
        dotClass: 'bg-[#137333]'
      };
    }
    if (sem.status === 'archived' || sem.is_archived) {
      return {
        label: 'Archived',
        pillClass: 'bg-[#f1f3f4] text-[#5f6368]',
        dotClass: 'bg-[#5f6368]'
      };
    }
    const today = new Date();
    const end = parseDateSafe(sem.end_date);
    if (end && isAfter(today, end)) {
      return {
        label: 'Completed',
        pillClass: 'bg-[#f1f3f4] text-[#5f6368]',
        dotClass: 'bg-[#5f6368]'
      };
    }
    return {
      label: 'Upcoming',
      pillClass: 'bg-[#fef7e0] text-[#b06000]',
      dotClass: 'bg-[#b06000]'
    };
  };

  if (sortedYears.length === 0) {
    return (
      <div className="bg-white border border-gray-200/90 rounded-2xl p-12 text-center text-gray-500 shadow-2xs">
        <p className="font-semibold text-sm">No school years found.</p>
        <p className="text-xs text-gray-400 mt-1">Create a new school year to configure terms and semesters.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {/* Action Row right under Current Academic Year header */}
      {canEdit && onNewSchoolYear && (
        <div className="flex justify-end pb-1">
          <button
            type="button"
            onClick={onNewSchoolYear}
            className="bg-[#0f523c] hover:bg-[#0b3d2c] text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm transition cursor-pointer"
          >
            <Plus size={16} />
            <span>Add School Year</span>
          </button>
        </div>
      )}

      {/* Column Headers */}
      <div className="grid grid-cols-12 items-center px-6 py-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider select-none">
        <div className="col-span-12 sm:col-span-6 md:col-span-5">
          SCHOOL YEAR
        </div>
        <div className="hidden sm:block sm:col-span-3 md:col-span-4">
          DURATION
        </div>
        <div className="col-span-8 sm:col-span-2 md:col-span-2">
          STATUS
        </div>
        <div className="col-span-4 sm:col-span-1 md:col-span-1 text-right">
        </div>
      </div>

      {/* Cards List */}
      <div className="space-y-3.5">
        {sortedYears.map((sy) => {
          const badge = getSyBadge(sy);
          const sySemesters = semesters
            .filter((sem) => sem.school_year_id === sy.id)
            .sort((a, b) => new Date(a.start_date || 0) - new Date(b.start_date || 0));
          const isExpanded = expandedSyIds.has(sy.id);

          return (
            <div
              key={sy.id}
              className="bg-white border border-gray-200/90 rounded-2xl shadow-2xs overflow-hidden transition"
            >
              {/* Main School Year Row */}
              <div
                onClick={() => toggleExpand(sy.id)}
                className="grid grid-cols-12 items-center px-6 py-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
              >
                {/* School Year Info */}
                <div className="col-span-12 sm:col-span-6 md:col-span-5 flex items-start gap-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpand(sy.id);
                    }}
                    className="mt-0.5 text-gray-400 hover:text-gray-600 transition shrink-0"
                    aria-label={isExpanded ? 'Collapse semesters' : 'Expand semesters'}
                  >
                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </button>
                  <div>
                    <h3 className="font-bold text-gray-900 text-[15px] leading-tight">
                      {sy.name}
                    </h3>
                    <p className="text-xs text-gray-400 font-normal mt-1">
                      {sySemesters.length} {sySemesters.length === 1 ? 'semester' : 'semesters'}
                    </p>
                  </div>
                </div>

                {/* Duration */}
                <div className="hidden sm:block sm:col-span-3 md:col-span-4 text-sm text-gray-600 font-normal">
                  {formatDateRange(sy.start_date, sy.end_date)}
                </div>

                {/* Status Badge */}
                <div className="col-span-8 sm:col-span-2 md:col-span-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold ${badge.pillClass}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${badge.dotClass}`} />
                    {badge.label}
                  </span>
                </div>

                {/* Actions Menu */}
                <div
                  className="col-span-4 sm:col-span-1 md:col-span-1 flex justify-end relative"
                  onClick={(e) => e.stopPropagation()}
                >
                  {canEdit && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setActiveMenu(activeMenu === `sy-${sy.id}` ? null : `sy-${sy.id}`)}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
                        title="School Year Options"
                      >
                        <MoreHorizontal size={18} />
                      </button>

                      {activeMenu === `sy-${sy.id}` && (
                        <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-30 text-left text-xs font-semibold text-gray-700">
                          {onEdit && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenu(null);
                                onEdit(sy);
                              }}
                              className="w-full px-3.5 py-2 hover:bg-gray-50 flex items-center gap-2.5 text-gray-700 transition"
                            >
                              <Edit3 size={14} className="text-gray-400" />
                              <span>Edit school year</span>
                            </button>
                          )}



                          {onArchive && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenu(null);
                                onArchive(sy);
                              }}
                              disabled={sy.is_active}
                              className={`w-full px-3.5 py-2 flex items-center gap-2.5 transition ${
                                sy.is_active ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-gray-50 text-gray-700'
                              }`}
                            >
                              <Archive size={14} className={sy.is_active ? 'text-gray-300' : 'text-gray-400'} />
                              <span>Archive</span>
                            </button>
                          )}

                          {onDelete && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenu(null);
                                onDelete(sy.id);
                              }}
                              className="w-full px-3.5 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2.5 transition"
                            >
                              <Trash2 size={14} className="text-red-500" />
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Expanded Semesters List */}
              {isExpanded && (
                <div className="border-t border-gray-100">
                  {sySemesters.length === 0 ? (
                    <div className="px-6 py-4 pl-[54px] text-xs text-gray-400 font-medium italic">
                      No semesters added to this academic year yet.
                    </div>
                  ) : (
                    sySemesters.map((sem) => {
                      const semBadge = getSemBadge(sem);
                      return (
                        <div
                          key={sem.id}
                          className="grid grid-cols-12 items-center px-6 py-3.5 border-b border-gray-100/60 last:border-b-0 hover:bg-gray-50/40 transition-colors"
                        >
                          {/* Semester Name */}
                          <div className="col-span-12 sm:col-span-6 md:col-span-5 pl-[30px] font-semibold text-gray-900 text-sm">
                            {sem.name}
                          </div>

                          {/* Semester Duration */}
                          <div className="hidden sm:block sm:col-span-3 md:col-span-4 text-sm text-gray-600 font-normal">
                            {formatDateRange(sem.start_date, sem.end_date)}
                          </div>

                          {/* Semester Status */}
                          <div className="col-span-8 sm:col-span-2 md:col-span-2">
                            <span
                              className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold ${semBadge.pillClass}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${semBadge.dotClass}`} />
                              {semBadge.label}
                            </span>
                          </div>

                          {/* Semester Actions */}
                          <div
                            className="col-span-4 sm:col-span-1 md:col-span-1 flex justify-end relative"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {canEdit && (
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setActiveMenu(activeMenu === `sem-${sem.id}` ? null : `sem-${sem.id}`)
                                  }
                                  className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
                                  title="Semester Options"
                                >
                                  <MoreHorizontal size={18} />
                                </button>

                                {activeMenu === `sem-${sem.id}` && (
                                  <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-30 text-left text-xs font-semibold text-gray-700">
                                    {onEditSemester && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveMenu(null);
                                          onEditSemester(sem);
                                        }}
                                        className="w-full px-3.5 py-2 hover:bg-gray-50 flex items-center gap-2.5 text-gray-700 transition"
                                      >
                                        <Edit3 size={14} className="text-gray-400" />
                                        <span>Edit</span>
                                      </button>
                                    )}

                                    {onArchiveSemester && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveMenu(null);
                                          onArchiveSemester(sem.id);
                                        }}
                                        className="w-full px-3.5 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2.5 transition"
                                      >
                                        <Trash2 size={14} className="text-red-500" />
                                        <span>Archive</span>
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* + Add semester */}
                  {canEdit && onNewSemester && (
                    <div className="px-6 py-3.5 pl-[54px] border-t border-gray-100/60">
                      <button
                        type="button"
                        onClick={() => onNewSemester(sy.id)}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0f523c] hover:text-[#0b3d2c] transition cursor-pointer"
                      >
                        <Plus size={16} />
                        <span>Add semester</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
