import React from 'react';
import { LayoutDashboard, BarChart2, Bell, User } from 'lucide-react';

interface BottomNavProps {
  currentTab: string;
  onTabChange: (tab: 'dashboard' | 'history' | 'alerts' | 'profile') => void;
  alertCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onTabChange, alertCount }) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 text-white py-4 px-6 flex justify-between items-center z-50 rounded-t-2xl shadow-2xl">
      <button 
        onClick={() => onTabChange('dashboard')}
        className={`flex flex-col items-center gap-1 ${currentTab === 'dashboard' ? 'text-blue-500' : 'text-slate-500'}`}
      >
        <LayoutDashboard className="w-6 h-6" />
        <span className="text-[10px] font-medium">Tableau de bord</span>
      </button>

      <button 
        onClick={() => onTabChange('history')}
        className={`flex flex-col items-center gap-1 ${currentTab === 'history' ? 'text-blue-500' : 'text-slate-500'}`}
      >
        <BarChart2 className="w-6 h-6" />
        <span className="text-[10px] font-medium">Historique</span>
      </button>

      <button 
        onClick={() => onTabChange('alerts')}
        className={`flex flex-col items-center gap-1 relative ${currentTab === 'alerts' ? 'text-blue-500' : 'text-slate-500'}`}
      >
        <div className="relative">
          <Bell className="w-6 h-6" />
          {alertCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full border-2 border-slate-900">
              {alertCount}
            </span>
          )}
        </div>
        <span className="text-[10px] font-medium">Alertes</span>
      </button>

      <button 
        onClick={() => onTabChange('profile')}
        className={`flex flex-col items-center gap-1 ${currentTab === 'profile' ? 'text-blue-500' : 'text-slate-500'}`}
      >
        <User className="w-6 h-6" />
        <span className="text-[10px] font-medium">Profil</span>
      </button>
    </div>
  );
};