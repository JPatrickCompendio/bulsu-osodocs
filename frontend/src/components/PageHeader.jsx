import React from 'react';

const PageHeader = ({ title, subtitle, icon: Icon, iconColor = 'blue' }) => {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100/50',
    green: 'bg-green-50 text-green-600 border-green-100/50',
    gold: 'bg-amber-50 text-amber-600 border-amber-100/50',
    purple: 'bg-purple-50 text-purple-600 border-purple-100/50',
    pink: 'bg-pink-50 text-pink-600 border-pink-100/50',
    slate: 'bg-slate-50 text-slate-600 border-slate-100/50',
  };
  
  return (
    <div className="flex items-center gap-4">
      {Icon && (
        <div className={`p-3.5 rounded-2xl shadow-sm border ${colorMap[iconColor] || colorMap.blue}`}>
          <Icon size={28} className="stroke-[2.5]" />
        </div>
      )}
      <div>
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs font-bold text-gray-500 mt-1 uppercase tracking-wider">{subtitle}</p>}
      </div>
    </div>
  );
};

export default PageHeader;
