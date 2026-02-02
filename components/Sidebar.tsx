import React from 'react';
import { View, UserProfile, Role } from '../types';
import { HomeIcon } from './icons/HomeIcon';
import { EyeIcon } from './icons/EyeIcon';
import { BriefcaseIcon } from './icons/BriefcaseIcon';
import { TrendingUpIcon } from './icons/TrendingUpIcon';
import { CogIcon } from './icons/CogIcon';
import { UsersIcon } from './icons/UsersIcon';
import { supabase } from '../supabase';
import { LogoutIcon } from './icons/LogoutIcon';
import { ExclamationCircleIcon } from './icons/ExclamationCircleIcon';

interface SidebarProps {
  activeView: View;
  setActiveView: (view: View) => void;
  user: UserProfile;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

const NavItem: React.FC<{
  icon: React.ElementType;
  label: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ icon: Icon, label, isActive, onClick }) => {
  const baseClasses = "flex items-center px-3 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors w-full text-left";
  const activeClasses = "bg-[var(--bg-tertiary)] text-[var(--text-primary)]";
  const inactiveClasses = "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]";

  return (
    <button onClick={onClick} className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}>
      <Icon className="h-6 w-6 mr-3 flex-shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
};

const Logo: React.FC = () => (
    <img src="https://storage.googleapis.com/msgsndr/672ygNPnlPDz5UHb9LAN/media/68c8c91e440460923b8c842a.png" alt="InmoScout Logo" className="h-12 w-auto" />
);

export const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView, user, isOpen, setIsOpen }) => {
  
  const handleItemClick = (view: View) => {
    setActiveView(view);
    setIsOpen(false);
  }

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
  };

  return (
    <aside className={`fixed inset-y-0 left-0 bg-[var(--bg-secondary)] border-r border-[var(--border-primary)] flex flex-col w-64 transform transition-transform duration-300 ease-in-out z-40 md:relative md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex items-center justify-between h-16 flex-shrink-0 px-4 border-b border-[var(--border-primary)]">
        <Logo />
         <button onClick={() => setIsOpen(false)} className="md:hidden text-gray-400 hover:text-white">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
         </button>
      </div>
      <div className="flex-grow overflow-y-auto flex flex-col">
        <nav className="flex-1 px-2 py-4 space-y-1">
          <NavItem 
            icon={TrendingUpIcon}
            label="Métricas"
            isActive={activeView === 'metrics'}
            onClick={() => handleItemClick('metrics')}
          />
           <NavItem 
            icon={BriefcaseIcon}
            label="Inventario"
            isActive={activeView === 'inventory'}
            onClick={() => handleItemClick('inventory')}
          />
          <NavItem 
            icon={EyeIcon} 
            label="Oportunidades" 
            isActive={activeView === 'opportunities'}
            onClick={() => handleItemClick('opportunities')}
          />
           <NavItem 
            icon={ExclamationCircleIcon}
            label="Revisión de Anomalías"
            isActive={activeView === 'anomalies'}
            onClick={() => handleItemClick('anomalies')}
          />
          <NavItem 
            icon={HomeIcon} // Re-using for simplicity
            label="Análisis Comparativo" 
            isActive={activeView === 'analysis'}
            onClick={() => handleItemClick('analysis')}
          />
          {user && user.role === Role.SUPER_ADMIN && (
            <>
              <div className="pt-4 mt-4 border-t border-[var(--border-primary)]">
                  <h3 className="px-3 text-xs font-semibold uppercase text-[var(--text-tertiary)] tracking-wider">Administración</h3>
              </div>
              <div className="space-y-1 mt-2">
                <NavItem 
                  icon={CogIcon}
                  label="Orquestador" 
                  isActive={activeView === 'orchestrator'}
                  onClick={() => handleItemClick('orchestrator')}
                />
                 <NavItem 
                  icon={UsersIcon}
                  label="Usuarios" 
                  isActive={activeView === 'user_management'}
                  onClick={() => handleItemClick('user_management')}
                />
              </div>
            </>
          )}
        </nav>
        
        <div className="px-2 py-4 border-t border-[var(--border-primary)] mt-auto flex-shrink-0">
          <div className="p-2 bg-[var(--bg-primary)] rounded-lg">
            <p className="text-sm font-semibold text-[var(--text-primary)] truncate" title={user.email}>{user.email}</p>
            <p className="text-xs text-[var(--text-secondary)]">{user.role.replace('_', ' ')}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-3 py-2 mt-2 rounded-md text-sm font-medium cursor-pointer transition-colors text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
          >
            <LogoutIcon className="h-6 w-6 mr-3" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </div>
    </aside>
  );
};