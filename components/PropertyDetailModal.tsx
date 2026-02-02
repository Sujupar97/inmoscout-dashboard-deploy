import React from 'react';
import { Property, PropertyStatus } from '../types';
import { propertyStatusTranslations } from '../utils/translations';
import { LightBulbIcon } from './icons/LightBulbIcon';

interface PropertyDetailModalProps {
  property: Property;
  onClose: () => void;
  onUpdateStatus: (propertyId: string, status: PropertyStatus) => void;
}

const statusOptions = Object.values(PropertyStatus);

export const PropertyDetailModal: React.FC<PropertyDetailModalProps> = ({ property, onClose, onUpdateStatus }) => {
  
  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onUpdateStatus(property.id, e.target.value as PropertyStatus);
  };

  const isOpportunity = property.discountPercentage !== undefined && property.discountPercentage <= -30;

  const potentialSaving = isOpportunity && property.averagePricePerSqm && property.total_calculated_sqm
    ? (property.averagePricePerSqm - (property.calculated_price_per_sqm || 0)) * property.total_calculated_sqm
    : 0;
  
  const calculatedUncoveredArea = (property.area && property.covered_area && property.area > property.covered_area)
    ? property.area - property.covered_area
    : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm z-[1000] flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div 
        className="bg-[var(--bg-secondary)] rounded-lg shadow-2xl w-full max-w-md lg:max-w-4xl h-full max-h-[95vh] flex flex-col overflow-hidden border border-[var(--border-primary)]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-[var(--border-primary)] flex-shrink-0">
          <h2 className="text-lg sm:text-xl font-bold text-[var(--text-primary)] truncate pr-4">{property.title}</h2>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-white transition-colors p-1 rounded-full hover:bg-[var(--bg-tertiary)] flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-4 sm:p-6 bg-[var(--bg-primary)]">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3">
              <img src={property.imageUrl || `https://picsum.photos/seed/prop${property.id}/800/600`} alt={property.title} className="w-full h-64 sm:h-80 object-cover rounded-lg mb-6 border border-[var(--border-primary)]"/>
              <div>
                <h3 className="font-semibold text-[var(--primary-accent-text)] mb-2">Descripción</h3>
                <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap">{property.description || 'No hay descripción disponible.'}</p>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <div className="bg-[var(--bg-secondary)] p-4 rounded-lg border border-[var(--border-primary)]">
                <h3 className="font-semibold text-[var(--primary-accent-text)] mb-3">Datos Principales</h3>
                <div className="space-y-3 text-[var(--text-primary)] text-sm">
                  <p><strong>Ubicación:</strong> {property.location}</p>
                  <p><strong>Precio:</strong> {property.currency} {property.price.toLocaleString('es-AR')}</p>
                  <p><strong>Ambientes:</strong> {property.bedrooms ?? 'N/A'}</p>
                  <p><strong>Baños:</strong> {property.bathrooms ?? 'N/A'}</p>
                </div>
              </div>

              <div className="bg-[var(--bg-secondary)] p-4 rounded-lg border border-[var(--border-primary)]">
                <h3 className="font-semibold text-[var(--primary-accent-text)] mb-3">Análisis de Superficie</h3>
                <div className="space-y-3 text-[var(--text-primary)] text-sm">
                  <p><strong>Área Total:</strong> {property.area || 'N/A'} m²</p>
                  <p><strong>Cubierta:</strong> {property.covered_area || 0} m²</p>
                  {calculatedUncoveredArea !== null && (
                     <p><strong>Descubierta (calc.):</strong> {calculatedUncoveredArea} m²</p>
                  )}
                  <p className="font-bold border-t border-[var(--border-primary)] pt-2 mt-2"><strong>Total Ponderado:</strong> {property.total_calculated_sqm?.toFixed(2) || 0} m²</p>
                  <p className="font-bold text-[var(--primary-accent-text)]"><strong>Precio/m² Ponderado:</strong> USD {property.calculated_price_per_sqm?.toLocaleString('es-AR', {maximumFractionDigits: 0}) || 'N/A'}</p>
                </div>
              </div>

              {isOpportunity && (
                <div className="bg-green-900/30 p-4 rounded-lg border border-green-500/30">
                   <div className="flex items-start mb-3">
                     <LightBulbIcon className="h-6 w-6 text-green-400 mr-3 flex-shrink-0 mt-1" />
                     <h3 className="font-semibold text-green-200 text-base">Análisis de Oportunidad</h3>
                   </div>
                   <div className="space-y-3 text-green-300 text-sm">
                     <p>Esta propiedad está un <strong className="text-green-100">{Math.abs(property.discountPercentage!).toFixed(1)}%</strong> por debajo del precio/m² promedio para <strong className="text-green-100">{property.propertyType ? `${property.propertyType}s` : 'propiedades'}</strong> en <strong className="text-green-100">{property.zona}</strong>.</p>
                      <div className="text-center space-y-1 bg-[var(--bg-secondary)] p-2 rounded-md">
                          <p>Promedio Zona ({property.propertyType}): <strong className="text-green-200">USD {property.averagePricePerSqm!.toFixed(0)}/m²</strong></p>
                          <p>Esta Propiedad: <strong className="text-green-200">USD {property.calculated_price_per_sqm!.toFixed(0)}/m²</strong></p>
                      </div>
                      <p className="font-bold border-t border-green-500/30 pt-2 mt-2">Valor potencial de ahorro: <strong className="text-green-100">USD {potentialSaving.toLocaleString('es-AR', {maximumFractionDigits: 0})}</strong></p>
                   </div>
                 </div>
              )}

              <div className="bg-[var(--bg-secondary)] p-4 rounded-lg border border-[var(--border-primary)]">
                <h3 className="font-semibold text-[var(--primary-accent-text)] mb-3">Información de Publicación</h3>
                <div className="space-y-3 text-[var(--text-primary)] text-sm">
                  {property.portal && (
                    <p><strong>Portal:</strong> {property.portal}</p>
                  )}
                  {property.seller_name && (
                    <p><strong>Vendedor:</strong> {property.seller_name}</p>
                  )}
                  {property.days_on_market != null && (
                    <p><strong>Días en Mercado:</strong> {property.days_on_market}</p>
                  )}
                  {property.visualizaciones != null && (
                    <p><strong>Visualizaciones:</strong> {property.visualizaciones.toLocaleString('es-AR')}</p>
                  )}
                </div>
              </div>
              
              <div className="bg-[var(--bg-secondary)] p-4 rounded-lg border border-[var(--border-primary)]">
                <h3 className="font-semibold text-[var(--primary-accent-text)] mb-2">Gestión</h3>
                <label htmlFor="status" className="block text-sm font-medium text-[var(--text-primary)] mb-1">Actualizar Estado</label>
                <select id="status" name="status" value={property.status} onChange={handleStatusChange} className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary-accent)] focus:border-[var(--primary-accent)] sm:text-sm">
                  {/* FIX: Cast `s` to `PropertyStatus` for indexing `propertyStatusTranslations`. */}
                  {statusOptions.map(s => <option key={s} value={s}>{propertyStatusTranslations[s as PropertyStatus]}</option>)}
                </select>
                <a href={property.link} target="_blank" rel="noopener noreferrer" className="block w-full text-center mt-3 bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-md transition-colors">
                  Ver Anuncio Original
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};