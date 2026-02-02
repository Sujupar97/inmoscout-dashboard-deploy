import React, { useState } from 'react';
import { supabase } from '../supabase';
import { Role } from '../types';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const inputStyle = "mt-1 block w-full bg-[var(--bg-tertiary)] border-[var(--border-primary)] rounded-md shadow-sm focus:ring-[var(--primary-accent)] focus:border-[var(--primary-accent)] sm:text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]";

export const AddUserModal: React.FC<AddUserModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>(Role.USER);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Email y contraseña son obligatorios.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // This securely calls the 'create-user' Edge Function.
      // Ensure this function is deployed in your Supabase project.
      const { data, error: functionError } = await supabase.functions.invoke('create-user', {
        body: { email, password, role },
      });

      if (functionError) {
        // The `functionError` from supabase-js is an instance of FunctionsError
        // which has a 'context' property with the raw fetch response.
        const context = (functionError as any).context;
        if (context && context.status === 409) {
           const errorBody = await context.json();
           setError(errorBody.error || 'Un usuario con este email ya existe.');
        } else {
           setError(`Error en la función: ${functionError.message}. Asegúrate de que la Edge Function 'create-user' esté desplegada y funcionando.`);
        }
        return; // Stop execution
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Un error inesperado ocurrió al crear el usuario.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[var(--bg-secondary)] rounded-lg shadow-2xl w-full max-w-md flex flex-col overflow-hidden border border-[var(--border-primary)]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-[var(--border-primary)]">
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Añadir Nuevo Usuario</h2>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-white">&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            {error && <p className="text-red-300 bg-red-900/50 p-3 rounded-md text-sm border border-red-500/30">{error}</p>}
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)]">Email del Usuario</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputStyle} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)]">Contraseña Provisional</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputStyle} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)]">Rol</label>
              <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={inputStyle}>
                {Object.values(Role).map(r => (
                  <option key={r} value={r}>{r.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end p-4 bg-black/30 border-t border-[var(--border-primary)]">
            <button type="button" onClick={onClose} className="bg-[var(--bg-tertiary)] py-2 px-4 border border-[var(--border-primary)] rounded-md shadow-sm text-sm font-medium text-[var(--text-primary)] hover:bg-opacity-80">Cancelar</button>
            <button type="submit" disabled={loading} className="ml-3 bg-[var(--primary-accent)] text-white py-2 px-4 rounded-md shadow-sm text-sm font-medium hover:bg-[var(--primary-accent-hover)] disabled:bg-gray-500">
              {loading ? 'Creando...' : 'Crear Usuario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};