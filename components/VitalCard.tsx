import React from 'react';
import { Activity, Thermometer, Droplets, HeartPulse } from 'lucide-react';

interface VitalCardProps {
  title: string;
  value: string | number;
  unit: string;
  icon: 'heart' | 'temp' | 'oxygen' | 'bp';
  colorTheme: 'red' | 'blue' | 'orange' | 'purple';
}

export const VitalCard: React.FC<VitalCardProps> = ({ title, value, unit, icon, colorTheme }) => {
  const getThemeStyles = () => {
    switch (colorTheme) {
      case 'red': return { bg: 'bg-red-900/20', text: 'text-red-400', iconBg: 'bg-red-900/30' };
      case 'blue': return { bg: 'bg-sky-900/20', text: 'text-sky-400', iconBg: 'bg-sky-900/30' };
      case 'orange': return { bg: 'bg-orange-900/20', text: 'text-orange-400', iconBg: 'bg-orange-900/30' };
      case 'purple': return { bg: 'bg-purple-900/20', text: 'text-purple-400', iconBg: 'bg-purple-900/30' };
      default: return { bg: 'bg-slate-800', text: 'text-slate-400', iconBg: 'bg-slate-700' };
    }
  };

  const getIcon = () => {
    switch (icon) {
      case 'heart': return <Activity className="w-6 h-6" />;
      case 'temp': return <Thermometer className="w-6 h-6" />;
      case 'oxygen': return <Droplets className="w-6 h-6" />;
      case 'bp': return <Activity className="w-6 h-6" />; // Using Activity for BP as generic pulse
      default: return <Activity className="w-6 h-6" />;
    }
  };

  const theme = getThemeStyles();

  return (
    <div className="bg-slate-800 p-5 rounded-3xl shadow-sm border border-slate-700 flex flex-col justify-between h-40">
      <div className={`w-12 h-12 rounded-full ${theme.iconBg} flex items-center justify-center ${theme.text} mb-2`}>
        {getIcon()}
      </div>
      <div>
        <h3 className="text-slate-400 text-sm font-medium">{title}</h3>
        <div className="flex items-end gap-1">
          <span className={`text-3xl font-bold ${theme.text}`}>{value}</span>
          <span className="text-sm text-slate-500 mb-1 font-medium">{unit}</span>
        </div>
      </div>
    </div>
  );
};