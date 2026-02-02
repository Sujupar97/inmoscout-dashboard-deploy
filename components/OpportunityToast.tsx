import React, { useEffect } from 'react';
import { Property } from '../types';
import { TagIcon } from './icons/TagIcon';

interface OpportunityToastProps {
  property: Property;
  onClose: () => void;
  onView: (property: Property) => void;
}

export const OpportunityToast: React.FC<OpportunityToastProps> = ({ property, onClose, onView }) => {
  // Auto-dismiss after 10 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 10000); // 10 seconds

    return () => clearTimeout(timer);
  }, [property, onClose]);

  const handleViewClick = () => {
    onView(property);
  };

  return (
    <div
      className="fixed bottom-24 right-4 w-full max-w-sm bg-[var(--bg-secondary)] rounded-lg shadow-2xl border border-[var(--border-primary)] z-[1001] animate-toast-in"
      role="alert"
      aria-live="assertive"
    >
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0 pt-0.5">
            <div className="p-2 rounded-full bg-green-900/50">
              <TagIcon className="h-6 w-6 text-green-400" />
            </div>
          </div>
          <div className="ml-3 w-0 flex-1">
            <p className="text-sm font-bold text-green-300">
              ¡Nueva Oportunidad Detectada!
            </p>
            <p className="mt-1 text-sm text-[var(--text-primary)] truncate" title={property.title}>
              {property.title}
            </p>
            <div className="mt-3">
              <button
                onClick={handleViewClick}
                className="w-full text-center bg-[var(--primary-accent)] hover:bg-[var(--primary-accent-hover)] text-white font-bold py-2 px-4 rounded-md transition-colors text-sm"
              >
                Ver Detalles
              </button>
            </div>
          </div>
          <div className="ml-4 flex-shrink-0 flex">
            <button
              onClick={onClose}
              className="inline-flex rounded-md p-1 text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-tertiary)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-green-500"
              aria-label="Cerrar notificación"
            >
              <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
