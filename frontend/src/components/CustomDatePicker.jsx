import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Lock, X } from 'lucide-react';

const CustomDatePicker = ({
  value = '',
  onChange,
  min = '',
  blockedEvents = [],
  onBlockedDateClick,
  placeholder = 'Select date',
  className = '',
  disabled = false,
  id,
  name,
  required = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Parse initial view date (Year, Month)
  const getInitialViewDate = () => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m] = value.split('-').map(Number);
      return new Date(y, m - 1, 1);
    }
    if (min && /^\d{4}-\d{2}-\d{2}$/.test(min)) {
      const [y, m] = min.split('-').map(Number);
      return new Date(y, m - 1, 1);
    }
    return new Date();
  };

  const [currentMonthDate, setCurrentMonthDate] = useState(getInitialViewDate);

  useEffect(() => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m] = value.split('-').map(Number);
      setCurrentMonthDate(new Date(y, m - 1, 1));
    }
  }, [value]);

  // Handle click outside to close popover
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();

  const prevMonth = () => {
    setCurrentMonthDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonthDate(new Date(year, month + 1, 1));
  };

  const formatDisplayDate = (dateStr) => {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return '';
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      return dateObj.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  };

  const getBlockedEventForDate = (dateStr) => {
    if (!blockedEvents || blockedEvents.length === 0) return null;
    return blockedEvents.find(ev => {
      const evStart = ev.start_date ? ev.start_date.split('T')[0] : '';
      const evEnd = ev.end_date ? ev.end_date.split('T')[0] : evStart;
      if (!evStart) return false;
      return dateStr >= evStart && dateStr <= evEnd;
    });
  };

  const [dropUp, setDropUp] = useState(false);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      // Calendar height is ~340px and footer is ~75px.
      // If space below input is less than 420px, open UPWARD above input box!
      if (spaceBelow < 420) {
        setDropUp(true);
      } else {
        setDropUp(false);
      }
    }
  }, [isOpen]);

  // Calendar calculations
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const daysGrid = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    daysGrid.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    daysGrid.push(d);
  }

  return (
    <div ref={containerRef} className="relative inline-block w-full">
      {/* Input Field */}
      <div className="relative flex items-center">
        <input
          id={id}
          name={name}
          type="text"
          readOnly
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          value={formatDisplayDate(value)}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={`w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:border-primary-green font-bold text-xs outline-none cursor-pointer pr-9 transition-all ${className}`}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className="absolute right-2.5 text-gray-500 hover:text-primary-green p-1 transition-colors"
          tabIndex={-1}
        >
          <CalendarIcon size={16} />
        </button>
      </div>

      {/* Calendar Popover */}
      {isOpen && (
        <div className={`absolute left-0 ${dropUp ? 'bottom-full mb-1' : 'top-full mt-1'} z-[99999] bg-white border border-gray-200 rounded-2xl shadow-2xl p-4 w-[290px] animate-in fade-in-50 zoom-in-95 duration-150`}>
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="font-black text-xs text-gray-800 uppercase tracking-wide">
              {monthNames[month]} {year}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Legend indicator */}
          <div className="flex items-center justify-between pt-2 pb-2 text-[10px] font-bold">
            <span className="flex items-center gap-1 text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              Red = Blocked Date
            </span>
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setIsOpen(false);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          {/* Weekday Labels */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {weekDays.map(wd => (
              <div key={wd} className="text-[10px] font-black text-gray-400 uppercase py-1">
                {wd}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {daysGrid.map((dayNum, idx) => {
              if (dayNum === null) {
                return <div key={`empty-${idx}`} className="h-8" />;
              }

              const mStr = String(month + 1).padStart(2, '0');
              const dStr = String(dayNum).padStart(2, '0');
              const dateStr = `${year}-${mStr}-${dStr}`;

              const blockedEvent = getBlockedEventForDate(dateStr);
              const isBlocked = !!blockedEvent;
              const isMinDisabled = min && dateStr < min;
              const isSelected = value === dateStr;

              if (isBlocked) {
                const eventTitle = blockedEvent.title || blockedEvent.event_name || 'Blocked Date';
                return (
                  <button
                    key={dateStr}
                    type="button"
                    title={`BLOCKED: ${eventTitle} (Click for details)`}
                    onClick={() => {
                      if (onBlockedDateClick) {
                        onBlockedDateClick(dateStr, blockedEvent);
                      }
                    }}
                    className="h-8 w-8 rounded-lg flex flex-col items-center justify-center text-xs font-black bg-red-500 text-white border-2 border-red-600 shadow-xs hover:bg-red-600 hover:scale-105 active:scale-95 transition-all relative group"
                  >
                    <span>{dayNum}</span>
                    <span className="w-1 h-1 rounded-full bg-white absolute bottom-0.5" />
                  </button>
                );
              }

              if (isMinDisabled) {
                return (
                  <button
                    key={dateStr}
                    type="button"
                    disabled
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-xs font-medium text-gray-300 bg-gray-50 cursor-not-allowed"
                  >
                    {dayNum}
                  </button>
                );
              }

              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => {
                    onChange(dateStr);
                    setIsOpen(false);
                  }}
                  className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
                    isSelected
                      ? 'bg-primary-green text-white font-black shadow-md scale-105'
                      : 'text-gray-700 hover:bg-emerald-50 hover:text-primary-green hover:font-black'
                  }`}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomDatePicker;
