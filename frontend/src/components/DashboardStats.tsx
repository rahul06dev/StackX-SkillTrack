import React from 'react';

interface StatsProps {
  total: number;
  active: number;
  completed: number;
  overdue: number;
}

const DashboardStats: React.FC<StatsProps> = ({ total, active, completed, overdue }) => {
  const stats = [
    // Add the custom class for each card
    { label: 'Total Projects', value: total, icon: 'fa-folder-open', className: 'stats-card-total' },
    { label: 'Active', value: active, icon: 'fa-clock', className: 'stats-card-active' },
    { label: 'Completed', value: completed, icon: 'fa-check-circle', className: 'stats-card-completed' },
    { label: 'Overdue', value: overdue, icon: 'fa-exclamation-triangle', className: 'stats-card-overdue' },
  ];

  return (
    <div className="flex gap-6 mb-8">
      {stats.map((s) => (
        // Use the custom class for the gradient and shadow
        <div key={s.label} className={`flex-1 p-6 rounded-xl text-white ${s.className}`}>
          <div className="flex justify-between items-start mb-2">
             <div className="text-lg font-medium">{s.label}</div>
             {/* Use the icon property */}
             <i className={`fa ${s.icon} text-3xl opacity-70`}></i>
          </div>
          <div className="text-4xl font-bold mb-1">{s.value}</div>
        </div>
      ))}
    </div>
  );
};
export default DashboardStats;
