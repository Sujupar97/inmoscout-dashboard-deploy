import React, { useState } from 'react';
import { Property, OwnerStatus } from '../types';
import { addOwner } from '../services/crmService';

interface AddToCRMModalProps {
  property: Property;
  onClose: () => void;
  onSuccess: () => void;
}

const inputStyle = "mt-1 block w-full bg-[var(--bg-tertiary)] border-[var(--border-primary)] rounded-md shadow-sm focus:ring-[var(--primary-accent)] focus:border-[var(--primary-accent)] sm:text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]";

export const AddToCRMModal: React.FC<AddToCRMModalProps> = ({ property, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    nombre_propietario: '',
    email: '',
    telefono: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre_propietario) {
      setError("El nombre del propietario es obligatorio.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const newOwnerData = {
        ...formData,
        direccion_propiedad: property.location,
        estado: OwnerStatus.NuevoLead,
        notas: `Lead generado desde la propiedad: ${property.title} (Portal: ${property.portal || 'N/A'}) (${property.link})`,
        fecha_visita: null,
        valor_tasacion: null,
      };
      await addOwner(newOwnerData);
      onSuccess();
    } catch (err) {
      setError("Error al añadir el propietario al CRM.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-[var(--bg-secondary)] rounded-lg shadow-2xl w-full max-w-md flex flex-col overflow-hidden border border-[var(--border-primary)]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-[var(--border-primary)]">
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Añadir Propietario a CRM</h2>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-white">&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <p className="text-sm text-[var(--text-secondary)]">
              Estás añadiendo el propietario de la propiedad: <br/>
              <strong className="text-[var(--primary-accent-text)]">{property.title}</strong>
            </p>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)]">Nombre del Propietario</label>
              <input type="text" name="nombre_propietario" value={formData.nombre_propietario} onChange={handleChange} className={inputStyle} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)]">Email</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} className={inputStyle} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)]">Teléfono</label>
              <input type="tel" name="telefono" value={formData.telefono} onChange={handleChange} className={inputStyle} />
            </div>
          </div>
          <div className="flex justify-end p-4 bg-black/30 border-t border-[var(--border-primary)]">
            <button type="button" onClick={onClose} className="bg-[var(--bg-tertiary)] py-2 px-4 border border-[var(--border-primary)] rounded-md shadow-sm text-sm font-medium text-[var(--text-primary)] hover:bg-opacity-80">Cancelar</button>
            <button type="submit" disabled={loading} className="ml-3 bg-[var(--primary-accent)] text-white py-2 px-4 rounded-md shadow-sm text-sm font-medium hover:bg-[var(--primary-accent-hover)] disabled:bg-gray-500">
              {loading ? 'Añadiendo...' : 'Añadir a CRM'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};