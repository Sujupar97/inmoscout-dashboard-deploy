import React, { useMemo, useState, useEffect } from 'react';
import { Filters, Property, PropertyStatus, View } from '../types';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { propertyStatusTranslations } from '../utils/translations';
import { FilterIcon } from './icons/FilterIcon';
import { PORTAL_NAMES } from '../utils/translations';
import { FilterValues } from '../services/propertyService';

interface AdvancedFilterPanelProps {
  filters: Filters;
  onFilterChange: React.Dispatch<React.SetStateAction<Filters>>;
  properties?: Property[];
  initialFilters: Filters;
  activeView: View;
  isOpen: boolean;
  onClose: () => void;
  filterValues?: FilterValues;
}

const statusOptions = ['All', ...Object.values(PropertyStatus)];

const inputBaseClasses = "w-full bg-[var(--bg-tertiary)] border-[var(--border-primary)] rounded-md shadow-sm py-2 px-3 text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-accent)] focus:border-[var(--primary-accent)] sm:text-sm";
const selectBaseClasses = "appearance-none w-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-md shadow-sm py-2 px-3 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-accent)] focus:border-[var(--primary-accent)] sm:text-sm";

// Componente auxiliar para un diseño coherente
const FilterInputGroup: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">{label}</label>
    {children}
  </div>
);

export const AdvancedFilterPanel: React.FC<AdvancedFilterPanelProps> = ({
  filters,
  onFilterChange,
  properties,
  initialFilters,
  activeView,
  isOpen,
  onClose,
  filterValues,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const portalOptions = useMemo(() => {
    if (filterValues?.portals?.length) return ['All', ...filterValues.portals];
    return ['All', ...PORTAL_NAMES];
  }, [filterValues]);
  const isOpportunitiesView = activeView === 'opportunities';

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (e.target.type === 'checkbox') {
        onFilterChange(prev => ({...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
        onFilterChange(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleDiscountRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const clearValue = isOpportunitiesView ? '-30' : '0';
    onFilterChange(prev => ({ ...prev, minDiscount: value === clearValue ? '' : value }));
  };

  const handleDiscountNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    if (rawValue === '' || rawValue === '-') {
       onFilterChange(prev => ({ ...prev, minDiscount: rawValue === '-' ? '' : '' }));
       return;
    }
    let value = parseInt(rawValue, 10);
    if (isNaN(value)) {
      onFilterChange(prev => ({...prev, minDiscount: ''}));
      return;
    }

    const maxDiscount = isOpportunitiesView ? -30 : 0;
    if (value > maxDiscount) value = maxDiscount;
    if (value < -100) value = -100;

    const clearValue = isOpportunitiesView ? -30 : 0;
    onFilterChange(prev => ({ ...prev, minDiscount: value === clearValue ? '' : String(value) }));
  };

  const uniqueZonas = useMemo(() => {
    if (filterValues?.zonas?.length) return ['All', ...filterValues.zonas];
    if (properties?.length) return ['All', ...[...new Set(properties.map(p => p.zona).filter(Boolean) as string[])].sort()];
    return ['All'];
  }, [filterValues, properties]);

  const uniquePropertyTypes = useMemo(() => {
    if (filterValues?.propertyTypes?.length) return ['All', ...filterValues.propertyTypes];
    if (properties?.length) return ['All', ...[...new Set(properties.map(p => p.propertyType).filter(Boolean) as string[])].sort()];
    return ['All'];
  }, [filterValues, properties]);
  
  const discountSliderMax = isOpportunitiesView ? -30 : 0;
  const discountValueForSlider = filters.minDiscount ? parseInt(filters.minDiscount, 10) : discountSliderMax;

  return (
    <>
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        aria-hidden="true"
      ></div>

      <div 
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-[var(--bg-secondary)] border-l border-[var(--border-primary)] shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="filter-panel-title"
      >
        <div className="flex justify-between items-center p-4 border-b border-[var(--border-primary)] flex-shrink-0">
          <h2 id="filter-panel-title" className="text-xl font-bold text-[var(--text-primary)] flex items-center"><FilterIcon className="h-5 w-5 mr-3"/>Filtros</h2>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-white transition-colors p-1 rounded-full hover:bg-[var(--bg-tertiary)]" aria-label="Cerrar panel de filtros">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-grow p-4 overflow-y-auto">
          {/* Filtros Principales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <div className="sm:col-span-2">
              <FilterInputGroup label="Barrio">
                <div className="relative">
                  <select id="location" name="location" value={filters.location} onChange={handleInputChange} className={selectBaseClasses}>
                    {uniqueZonas.map(option => (<option key={option} value={option}>{option === 'All' ? 'Todos' : option}</option>))}
                  </select>
                  <ChevronDownIcon className="h-5 w-5 text-[var(--text-tertiary)] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </FilterInputGroup>
            </div>
            <div className="sm:col-span-2">
              <FilterInputGroup label="Portal">
                <div className="relative">
                  <select id="portal" name="portal" value={filters.portal} onChange={handleInputChange} className={selectBaseClasses}>
                    {portalOptions.map(option => (<option key={option} value={option}>{option === 'All' ? 'Todos' : option}</option>))}
                  </select>
                  <ChevronDownIcon className="h-5 w-5 text-[var(--text-tertiary)] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </FilterInputGroup>
            </div>
             <div className="sm:col-span-2">
              <FilterInputGroup label="Tipo de Propiedad">
                <div className="relative">
                  <select id="propertyType" name="propertyType" value={filters.propertyType} onChange={handleInputChange} className={selectBaseClasses}>
                    {uniquePropertyTypes.map(option => (<option key={option} value={option}>{option === 'All' ? 'Todos' : option}</option>))}
                  </select>
                  <ChevronDownIcon className="h-5 w-5 text-[var(--text-tertiary)] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </FilterInputGroup>
            </div>
            <div className="sm:col-span-2">
              <FilterInputGroup label="Precio (USD)">
                <div className="flex items-center space-x-2">
                  <input type="number" name="minPrice" id="minPrice" value={filters.minPrice} onChange={handleInputChange} placeholder="Mínimo" className={inputBaseClasses} />
                  <span className="text-[var(--text-secondary)]">-</span>
                  <input type="number" name="maxPrice" id="maxPrice" value={filters.maxPrice} onChange={handleInputChange} placeholder="Máximo" className={inputBaseClasses} />
                </div>
              </FilterInputGroup>
            </div>
            <div className="sm:col-span-2">
              <FilterInputGroup label={`Descuento Mínimo: ${discountValueForSlider}%`}>
                <div className="flex items-center space-x-2">
                  <input
                        type="range"
                        name="minDiscount"
                        min="-100" max={discountSliderMax} step="5"
                        value={discountValueForSlider}
                        onChange={handleDiscountRangeChange}
                        className="w-full h-2 bg-[var(--bg-tertiary)] rounded-lg appearance-none cursor-pointer accent-[var(--primary-accent)]"
                    />
                    <input
                        type="number"
                        max={discountSliderMax} min="-100"
                        value={filters.minDiscount}
                        onChange={handleDiscountNumberChange}
                        className={`${inputBaseClasses} w-20 text-center`}
                        placeholder='%'
                    />
                </div>
              </FilterInputGroup>
            </div>
            <FilterInputGroup label="Superficie Ponderada (m²)">
              <div className="flex items-center space-x-2">
                <input type="number" name="minArea" value={filters.minArea} onChange={handleInputChange} placeholder="Mín" className={inputBaseClasses} />
                  <span className="text-[var(--text-secondary)]">-</span>
                <input type="number" name="maxArea" value={filters.maxArea} onChange={handleInputChange} placeholder="Máx" className={inputBaseClasses} />
              </div>
            </FilterInputGroup>
            <FilterInputGroup label="Ambientes">
               <div className="flex items-center space-x-2">
                <input type="number" name="minBeds" value={filters.minBeds} onChange={handleInputChange} placeholder="Mín" className={inputBaseClasses} />
                <span className="text-[var(--text-secondary)]">-</span>
                <input type="number" name="maxBeds" value={filters.maxBeds} onChange={handleInputChange} placeholder="Máx" className={inputBaseClasses} />
              </div>
            </FilterInputGroup>
            
            <div className="sm:col-span-2 pt-2 space-y-3">
              <div className="relative flex items-center">
                  <div className="flex h-5 items-center">
                      <input
                          id="isPotentialOpportunity"
                          name="isPotentialOpportunity"
                          type="checkbox"
                          checked={filters.isPotentialOpportunity}
                          onChange={handleInputChange}
                          className="h-4 w-4 rounded border-[var(--border-primary)] bg-[var(--bg-tertiary)] text-[var(--primary-accent)] focus:ring-[var(--primary-accent)]"
                      />
                  </div>
                  <div className="ml-3 text-sm">
                      <label htmlFor="isPotentialOpportunity" className="font-medium text-[var(--text-primary)]">
                          Mostrar sólo Oportunidades Potenciales
                      </label>
                  </div>
              </div>
              <div className="relative flex items-center">
                  <div className="flex h-5 items-center">
                      <input
                          id="showOnlyDiscarded"
                          name="showOnlyDiscarded"
                          type="checkbox"
                          checked={filters.showOnlyDiscarded}
                          onChange={handleInputChange}
                          className="h-4 w-4 rounded border-[var(--border-primary)] bg-[var(--bg-tertiary)] text-[var(--primary-accent)] focus:ring-[var(--primary-accent)]"
                      />
                  </div>
                  <div className="ml-3 text-sm">
                      <label htmlFor="showOnlyDiscarded" className="font-medium text-[var(--text-primary)]">
                          Mostrar sólo Descartadas
                      </label>
                  </div>
              </div>
            </div>
          </div>
          
          <button 
            onClick={() => setIsExpanded(!isExpanded)} 
            className="w-full flex items-center justify-center space-x-2 text-sm text-[var(--primary-accent-text)] hover:text-green-300 font-medium transition-colors mt-6 bg-[var(--bg-tertiary)]/50 py-2 rounded-md"
          >
            <span>{isExpanded ? 'Ocultar Filtros Avanzados' : 'Más Filtros'}</span>
            <ChevronDownIcon className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </button>

          {/* Filtros Avanzados (Plegables) */}
          {isExpanded && (
            <div className="mt-4 pt-4 border-t border-[var(--border-primary)]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                <div className="sm:col-span-2">
                    <FilterInputGroup label="Buscar por URL del Anuncio">
                        <input
                            type="url"
                            name="searchUrl"
                            value={filters.searchUrl}
                            onChange={handleInputChange}
                            placeholder="Pega la URL del portal aquí..."
                            className={inputBaseClasses}
                        />
                    </FilterInputGroup>
                </div>
                <FilterInputGroup label="Precio/m² Ponderado (USD)">
                  <div className="flex items-center space-x-2">
                    <input type="number" name="minPricePerSqm" value={filters.minPricePerSqm} onChange={handleInputChange} placeholder="Mín" className={inputBaseClasses} />
                    <span className="text-[var(--text-secondary)]">-</span>
                    <input type="number" name="maxPricePerSqm" value={filters.maxPricePerSqm} onChange={handleInputChange} placeholder="Máx" className={inputBaseClasses} />
                  </div>
                </FilterInputGroup>
                <FilterInputGroup label="Precio/m² (USD)">
                  <div className="flex items-center space-x-2">
                    <input type="number" name="minPricePerTotalSqm" value={filters.minPricePerTotalSqm} onChange={handleInputChange} placeholder="Mín" className={inputBaseClasses} />
                    <span className="text-[var(--text-secondary)]">-</span>
                    <input type="number" name="maxPricePerTotalSqm" value={filters.maxPricePerTotalSqm} onChange={handleInputChange} placeholder="Máx" className={inputBaseClasses} />
                  </div>
                </FilterInputGroup>
                <FilterInputGroup label="Días en Mercado">
                  <div className="flex items-center space-x-2">
                    <input type="number" name="minDaysOnMarket" value={filters.minDaysOnMarket} onChange={handleInputChange} placeholder="Mín" className={inputBaseClasses} />
                    <span className="text-[var(--text-secondary)]">-</span>
                    <input type="number" name="maxDaysOnMarket" value={filters.maxDaysOnMarket} onChange={handleInputChange} placeholder="Máx" className={inputBaseClasses} />
                  </div>
                </FilterInputGroup>
                <FilterInputGroup label="Estado">
                  <div className="relative">
                    <select name="status" value={filters.status} onChange={handleInputChange} className={selectBaseClasses}>
                      {statusOptions.map(option => (
                        <option key={option} value={option}>
                          {option === 'All' ? 'Todos' : propertyStatusTranslations[option as PropertyStatus]}
                        </option>
                      ))}
                    </select>
                    <ChevronDownIcon className="h-5 w-5 text-[var(--text-tertiary)] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </FilterInputGroup>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end p-4 bg-black/30 border-t border-[var(--border-primary)] flex-shrink-0 space-x-3">
          <button onClick={() => { onFilterChange(initialFilters); setIsExpanded(false); }} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-md transition-colors text-sm">Limpiar Filtros</button>
          <button onClick={onClose} className="bg-[var(--primary-accent)] hover:bg-[var(--primary-accent-hover)] text-white font-bold py-2 px-4 rounded-md transition-colors text-sm">Ver Resultados</button>
        </div>
      </div>
    </>
  );
};