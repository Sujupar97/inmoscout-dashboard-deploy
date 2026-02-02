import React from 'react';
import { View } from '../types';
import { RetryIcon } from './icons/RetryIcon';

interface HeaderProps {
  activeView: View;
  onMenuClick: () => void;
  onRefresh: () => void;
}

const viewTitles: Record<View, string> = {
  inventory: 'Inventario de Propiedades',
  opportunities: 'Prospección de Oportunidades',
  anomalies: 'Revisión de Anomalías',
  analysis: 'Análisis de Mercado',
  metrics: 'Métricas y Estadísticas',
  orchestrator: 'Orquestador de Scrapers',
  user_management: 'Centro de Mando: Usuarios',
};

export const Header: React.FC<HeaderProps> = ({ activeView, onMenuClick, onRefresh }) => {
  return (
    <header className="bg-[var(--bg-secondary)] flex-shrink-0 border-b border-[var(--border-primary)]">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
           <div className="flex items-center">
            <button
                onClick={onMenuClick}
                className="md:hidden mr-4 text-gray-400 hover:text-white"
                aria-label="Abrir menú"
            >
                <svg className="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
            </button>
            <h1 className="text-lg md:text-xl font-bold text-[var(--text-primary)] tracking-tight">{viewTitles[activeView]}</h1>
          </div>
          <div className="flex items-center">
            <button
              onClick={onRefresh}
              className="p-2 text-[var(--text-secondary)] hover:text-white rounded-full hover:bg-[var(--bg-tertiary)] transition-colors"
              aria-label="Refrescar datos"
              title="Refrescar datos de propiedades"
            >
              <RetryIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};