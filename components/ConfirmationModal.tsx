import React from 'react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isLoading: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirmar', cancelText = 'Cancelar', isLoading }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[var(--bg-secondary)] rounded-lg shadow-2xl w-full max-w-md flex flex-col border border-[var(--border-primary)]" onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <h3 className="text-lg font-bold text-red-400">{title}</h3>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">{message}</p>
        </div>
        <div className="flex justify-end p-4 bg-black/30 border-t border-[var(--border-primary)] space-x-3">
          <button onClick={onClose} disabled={isLoading} className="bg-[var(--bg-tertiary)] py-2 px-4 border border-[var(--border-primary)] rounded-md text-sm font-medium text-[var(--text-primary)] hover:bg-opacity-80 disabled:opacity-50">
            {cancelText}
          </button>
          <button onClick={onConfirm} disabled={isLoading} className="bg-red-600 text-white py-2 px-4 rounded-md text-sm font-medium hover:bg-red-700 disabled:bg-red-800 disabled:cursor-not-allowed">
            {isLoading ? 'Eliminando...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};