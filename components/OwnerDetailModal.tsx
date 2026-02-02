import React, { useState, useEffect } from 'react';
import { Owner, OwnerStatus } from '../types';
import { updateOwner } from '../services/crmService';

interface OwnerDetailModalProps {
  owner: Owner;
  onClose: () => void;
  onOwnerUpdated: (updatedOwner: Owner) => void;
}

const inputStyle = "mt-1 block w-full bg-[var(--bg-tertiary)] border-[var(--border-primary)] rounded-md shadow-sm focus:ring-[var(--primary-accent)] focus:border-[var(--primary-accent)] sm:text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]";

export const OwnerDetailModal: React.FC<OwnerDetailModalProps> = ({ owner, onClose, onOwnerUpdated }) => {
  const [formData, setFormData] = useState<Partial<Owner>>(owner);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFormData(owner);
  }, [owner]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value ? new Date(value).toISOString() : null }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const updatedOwner = await updateOwner(owner.id, formData);
      onOwnerUpdated(updatedOwner);
      onClose();
    } catch (err) {
      setError("Error al actualizar el propietario.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-[var(--bg-secondary)] rounded-lg shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden border border-[var(--border-primary)] max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-[var(--border-primary)]">
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Detalles del Propietario</h2>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-white">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="flex-grow overflow-y-auto">
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)]">Nombre</label>
              <input type="text" name="nombre_propietario" value={formData.nombre_propietario || ''} onChange={handleChange} className={inputStyle} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)]">Dirección</label>
              <input type="text" name="direccion_propiedad" value={formData.direccion_propiedad || ''} onChange={handleChange} className={inputStyle} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)]">Email</label>
              <input type="email" name="email" value={formData.email || ''} onChange={handleChange} className={inputStyle} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)]">Teléfono</label>
              <input type="tel" name="telefono" value={formData.telefono || ''} onChange={handleChange} className={inputStyle} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)]">Estado</label>
              <select name="estado" value={formData.estado || ''} onChange={handleChange} className={inputStyle}>
                {Object.values(OwnerStatus).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)]">Fecha de Visita</label>
                <input type="datetime-local" name="fecha_visita" 
                       value={formData.fecha_visita ? new Date(formData.fecha_visita).toISOString().substring(0, 16) : ''}
                       onChange={handleDateChange} className={inputStyle} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-[var(--text-secondary)]">Valor de Tasación (USD)</label>
              <input type="number" name="valor_tasacion" value={formData.valor_tasacion || ''} onChange={handleChange} className={inputStyle} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-[var(--text-secondary)]">Notas</label>
              <textarea name="notas" value={formData.notas || ''} onChange={handleChange} rows={4} className={inputStyle}></textarea>
            </div>
            {error && <p className="text-red-400 text-sm md:col-span-2">{error}</p>}
          </div>
          <div className="flex justify-end p-4 bg-black/30 border-t border-[var(--border-primary)]">
              <button type="button" onClick={onClose} className="bg-[var(--bg-tertiary)] py-2 px-4 border border-[var(--border-primary)] rounded-md shadow-sm text-sm font-medium text-[var(--text-primary)] hover:bg-opacity-80">Cerrar</button>
              <button type="submit" disabled={loading} className="ml-3 bg-[var(--primary-accent)] text-white py-2 px-4 rounded-md shadow-sm text-sm font-medium hover:bg-[var(--primary-accent-hover)] disabled:bg-gray-500">
                  {loading ? 'Actualizando...' : 'Guardar Cambios'}
              </button>
          </div>
        </form>
      </div>
    </div>
  );
};