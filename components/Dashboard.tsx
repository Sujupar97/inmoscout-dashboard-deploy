import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Property, PropertyStatus, Filters, View } from '../types';
import { AdvancedFilterPanel } from './AdvancedFilterPanel';
import { propertyStatusTranslations } from '../utils/translations';
import { ListIcon } from './icons/ListIcon';
import { GridIcon } from './icons/GridIcon';
import { PropertyCard } from './PropertyCard';
import { useVirtualizer } from '@tanstack/react-virtual';
import { FilterIcon } from './icons/FilterIcon';
import { SortConfig as ServiceSortConfig, FilterValues } from '../services/propertyService';

interface DashboardProps {
  properties: Property[];
  totalCount: number;
  onSelectProperty: (property: Property) => void;
  filters: Filters;
  onFilterChange: React.Dispatch<React.SetStateAction<Filters>>;
  onUpdateStatus: (propertyId: string, status: PropertyStatus) => void;
  onBulkUpdate: (propertyIds: string[], updates: Partial<Pick<Property, 'status' | 'is_potential_opportunity'>>) => void;
  initialFilters: Filters;
  activeView: View;
  filterValues?: FilterValues;
  page: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  totalPages: number;
  sort: ServiceSortConfig;
  onSortChange: (sort: ServiceSortConfig) => void;
}

type SortableKeys = 'price' | 'discountPercentage' | 'created_at' | 'zona' | 'portal' | 'total_calculated_sqm' | 'calculated_price_per_sqm' | 'days_on_market';

type SortConfig = {
  key: SortableKeys;
  direction: 'asc' | 'desc';
};

const defaultSortConfig: SortConfig[] = [{ key: 'calculated_price_per_sqm', direction: 'asc' }];

const useResponsiveGridColumns = () => {
  const [columns, setColumns] = useState(1);
  useEffect(() => {
    const calculateColumns = () => {
      const width = window.innerWidth;
      if (width >= 1536) return 5; // 2xl
      if (width >= 1280) return 4; // xl
      if (width >= 1024) return 3; // lg
      if (width >= 768) return 2;  // md
      return 1;
    };
    const handleResize = () => setColumns(calculateColumns());
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return columns;
};

const SortableHeaderDiv: React.FC<{
  title: string;
  sortKey: SortableKeys;
  sortConfigs: SortConfig[];
  requestSort: (key: SortableKeys, event: React.MouseEvent) => void;
  className?: string;
}> = ({ title, sortKey, sortConfigs, requestSort, className = '' }) => {
  const sortInfo = sortConfigs.find(c => c.key === sortKey);
  const sortIndex = sortConfigs.findIndex(c => c.key === sortKey);
  const directionIcon = sortInfo ? (sortInfo.direction === 'asc' ? '▲' : '▼') : '';

  return (
    <div
      onClick={(e) => requestSort(sortKey, e)}
      className={`py-3 text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider cursor-pointer hover:text-[var(--text-primary)] transition-colors flex items-center ${className}`}
      title="Mantén Shift para ordenar por múltiples columnas"
    >
      {title}
      {sortInfo && (
        <span className="ml-1 flex items-center">
          {directionIcon}
          {sortConfigs.length > 1 && sortIndex > -1 && (
            <span className="ml-1 text-xs bg-gray-600 text-gray-200 rounded-full h-4 w-4 flex items-center justify-center">
              {sortIndex + 1}
            </span>
          )}
        </span>
      )}
    </div>
  );
};

export const Dashboard: React.FC<DashboardProps> = React.memo(({ properties, totalCount, onSelectProperty, filters, onFilterChange, onUpdateStatus, onBulkUpdate, initialFilters, activeView, filterValues, page, onPageChange, pageSize, totalPages, sort, onSortChange }) => {
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [sortConfigs, setSortConfigs] = useState<SortConfig[]>(defaultSortConfig);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const isCustomSortActive = JSON.stringify(sortConfigs) !== JSON.stringify(defaultSortConfig);
  const parentRef = useRef<HTMLDivElement>(null);

  // Clear selection when filters change (properties list changes)
  useEffect(() => {
    setSelectedIds(new Set());
  }, [properties]);

  const requestSort = (key: SortableKeys, event: React.MouseEvent) => {
    const isShiftClick = event.shiftKey;

    setSortConfigs(prevConfigs => {
      const existingConfigIndex = prevConfigs.findIndex(c => c.key === key);

      if (!isShiftClick) {
        // Clic normal: establece como ordenamiento principal
        if (existingConfigIndex === 0 && prevConfigs.length === 1) {
          // Si es el único ordenamiento, cambia la dirección
          return [{ key, direction: prevConfigs[0].direction === 'asc' ? 'desc' : 'asc' }];
        } else {
          // Establece un nuevo ordenamiento principal
          return [{ key, direction: 'desc' }];
        }
      } else {
        // Shift + Clic: añade o modifica un ordenamiento secundario
        if (existingConfigIndex > -1) {
          // Si ya existe, cambia su dirección
          const newConfigs = [...prevConfigs];
          newConfigs[existingConfigIndex].direction = newConfigs[existingConfigIndex].direction === 'asc' ? 'desc' : 'asc';
          return newConfigs;
        } else {
          // Si no existe, añádelo
          return [...prevConfigs, { key, direction: 'desc' }];
        }
      }
    });
  };


  const sortedProperties = useMemo(() => {
    let sortableItems = [...properties];
    sortableItems.sort((a, b) => {
      for (const config of sortConfigs) {
        const valA = a[config.key];
        const valB = b[config.key];

        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;

        let comparison = 0;
        if (valA < valB) {
          comparison = -1;
        } else if (valA > valB) {
          comparison = 1;
        }

        if (comparison !== 0) {
          return config.direction === 'asc' ? comparison : -comparison;
        }
      }
      return 0;
    });
    return sortableItems;
  }, [properties, sortConfigs]);

  const handleToggleSelection = useCallback((propertyId: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(propertyId)) {
        newSet.delete(propertyId);
      } else {
        newSet.add(propertyId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(sortedProperties.map(p => p.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleBulkAction = async (action: 'potential_opportunity' | 'discard' | 'remove_potential_opportunity') => {
    if (selectedIds.size === 0) return;

    const updates: Partial<Pick<Property, 'status' | 'is_potential_opportunity'>> = {};
    if (action === 'potential_opportunity') {
      updates.is_potential_opportunity = true;
    } else if (action === 'discard') {
      updates.status = PropertyStatus.Discarded;
    } else if (action === 'remove_potential_opportunity') {
      updates.is_potential_opportunity = false;
    }

    await onBulkUpdate(Array.from(selectedIds), updates);
    setSelectedIds(new Set());
  };

  // --- Virtualization Setup ---
  const listRowVirtualizer = useVirtualizer({
    count: sortedProperties.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 73, // Height of a row + border
    overscan: 10,
  });

  const gridColumns = useResponsiveGridColumns();
  const gridRowCount = Math.ceil(sortedProperties.length / gridColumns);
  const gridRowVirtualizer = useVirtualizer({
    count: gridRowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 480, // Card height: img(192)+padding(32)+status(28)+title(28)+seller(20)+data(72)+button(52)+gap(24)=448 + margin
    overscan: 2,
  });

  // Scroll to top when filters change
  useEffect(() => {
    // Check for a virtualizer instance to prevent errors on initial render
    if (listRowVirtualizer.getVirtualItems().length > 0) {
      listRowVirtualizer.scrollToIndex(0, { align: 'start' });
    }
    if (gridRowVirtualizer.getVirtualItems().length > 0) {
      gridRowVirtualizer.scrollToIndex(0, { align: 'start' });
    }
  }, [properties, listRowVirtualizer, gridRowVirtualizer]);

  const columnStyles = {
    propiedad: 'flex-[0_0_20%]',
    tipo: 'flex-[0_0_10%]',
    ambientes: 'flex-[0_0_10%]',
    zona: 'flex-[0_0_15%]',
    precio: 'flex-[0_0_10%]',
    m2pond: 'flex-[0_0_8%]',
    usdm2pond: 'flex-[0_0_10%]',
    diasPublicado: 'flex-[0_0_10%]',
    descuento: 'flex-[0_0_7%]'
  };

  return (
    <div className="flex flex-col h-full">
      <AdvancedFilterPanel
        isOpen={isFiltersOpen}
        onClose={() => setIsFiltersOpen(false)}
        filters={filters}
        onFilterChange={onFilterChange}
        initialFilters={initialFilters}
        activeView={activeView}
        filterValues={filterValues}
      />

      {selectedIds.size > 0 && (
        <div className="mb-4 bg-[var(--bg-tertiary)] p-3 rounded-lg border border-[var(--border-primary)] flex items-center justify-between transition-all duration-300 animate-fade-in">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{selectedIds.size} seleccionada{selectedIds.size > 1 ? 's' : ''}</p>
          <div className="flex items-center space-x-3">
            {filters.isPotentialOpportunity ? (
              <button onClick={() => handleBulkAction('remove_potential_opportunity')} className="text-sm bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-1.5 px-3 rounded-md">
                Quitar de Oportunidades
              </button>
            ) : (
              <button onClick={() => handleBulkAction('potential_opportunity')} className="text-sm bg-green-600 hover:bg-green-700 text-white font-semibold py-1.5 px-3 rounded-md">
                Oportunidad Potencial
              </button>
            )}
            <button onClick={() => handleBulkAction('discard')} className="text-sm bg-red-600 hover:bg-red-700 text-white font-semibold py-1.5 px-3 rounded-md">
              Descartar
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="text-sm text-[var(--text-secondary)] hover:text-white">
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center flex-shrink-0 mb-6">
        <div className="flex items-center space-x-4">
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">{`${totalCount.toLocaleString('es-AR')} ${totalCount === 1 ? 'Propiedad Encontrada' : 'Propiedades Encontradas'}`}</h2>
          {isCustomSortActive && (
            <button onClick={() => setSortConfigs(defaultSortConfig)} className="text-xs bg-gray-700 text-gray-300 px-3 py-1 rounded-full hover:bg-gray-600">
              Restablecer Orden
            </button>
          )}
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={() => setIsFiltersOpen(true)}
            className="flex items-center space-x-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] font-medium py-2 px-4 rounded-md transition-colors text-sm border border-[var(--border-primary)]"
            aria-label="Abrir filtros"
          >
            <FilterIcon className="h-4 w-4" />
            <span>Filtros</span>
          </button>
          <div className="flex items-center space-x-2 p-1 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)]">
            <button onClick={() => setViewMode('grid')} className={`p-2 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-[var(--primary-accent)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'}`} aria-label="Vista de cuadrícula"><GridIcon className="h-5 w-5" /></button>
            <button onClick={() => setViewMode('list')} className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-[var(--primary-accent)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'}`} aria-label="Vista de lista"><ListIcon className="h-5 w-5" /></button>
          </div>
        </div>
      </div>

      <div className="flex-grow min-h-0">
        {sortedProperties.length === 0 ? (
          <div className="text-center py-16 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)]">
            <h3 className="text-xl font-semibold text-[var(--text-primary)]">No se encontraron propiedades</h3>
            <p className="text-[var(--text-secondary)] mt-2">Prueba a ajustar los filtros para ampliar tu búsqueda.</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div ref={parentRef} className="overflow-y-auto h-full w-full">
            <div style={{ height: `${gridRowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
              {gridRowVirtualizer.getVirtualItems().map(virtualRow => (
                <div key={virtualRow.index} className="absolute top-0 left-0 w-full" style={{ height: `${virtualRow.size}px`, transform: `translateY(${virtualRow.start}px)` }}>
                  <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 px-1 py-1`}>
                    {Array.from({ length: gridColumns }).map((_, colIndex) => {
                      const propIndex = virtualRow.index * gridColumns + colIndex;
                      const property = sortedProperties[propIndex];
                      return property ? <PropertyCard key={property.id} property={property} onSelectProperty={onSelectProperty} onUpdateStatus={onUpdateStatus} isSelected={selectedIds.has(property.id)} onToggleSelection={handleToggleSelection} /> : <div key={colIndex} />;
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 bg-[var(--bg-tertiary)]/50 border-b border-[var(--border-primary)]">
              <div className="flex w-full px-6 items-center">
                <div className="flex-shrink-0 pr-4">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded bg-[var(--bg-primary)] border-[var(--border-primary)] text-[var(--primary-accent)] focus:ring-[var(--primary-accent)]"
                    onChange={handleSelectAll}
                    checked={sortedProperties.length > 0 && selectedIds.size === sortedProperties.length}
                    aria-label="Seleccionar todo"
                  />
                </div>
                <div className={`${columnStyles.propiedad} min-w-[200px]`}><SortableHeaderDiv title="Propiedad" sortKey="created_at" sortConfigs={sortConfigs} requestSort={requestSort} /></div>
                <div className={`${columnStyles.tipo} min-w-[80px]`}><div className="py-3 text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Tipo</div></div>
                <div className={`${columnStyles.ambientes} justify-center min-w-[80px]`}><div className="py-3 text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Ambientes</div></div>
                <div className={`${columnStyles.zona} min-w-[120px]`}><SortableHeaderDiv title="Zona" sortKey="zona" sortConfigs={sortConfigs} requestSort={requestSort} /></div>
                <div className={`${columnStyles.precio} justify-end min-w-[100px]`}><SortableHeaderDiv title="Precio" sortKey="price" sortConfigs={sortConfigs} requestSort={requestSort} className="justify-end w-full" /></div>
                <div className={`${columnStyles.m2pond} justify-end min-w-[80px]`}><SortableHeaderDiv title="m² Pond." sortKey="total_calculated_sqm" sortConfigs={sortConfigs} requestSort={requestSort} className="justify-end w-full" /></div>
                <div className={`${columnStyles.usdm2pond} justify-end min-w-[110px]`}><SortableHeaderDiv title="USD/m² Pond." sortKey="calculated_price_per_sqm" sortConfigs={sortConfigs} requestSort={requestSort} className="justify-end w-full" /></div>
                <div className={`${columnStyles.diasPublicado} justify-end min-w-[110px]`}>
                  <SortableHeaderDiv title="Días Publicado" sortKey="days_on_market" sortConfigs={sortConfigs} requestSort={requestSort} className="justify-end w-full" />
                </div>
                <div className={`${columnStyles.descuento} justify-end min-w-[90px]`}><SortableHeaderDiv title="Descuento" sortKey="discountPercentage" sortConfigs={sortConfigs} requestSort={requestSort} className="justify-end w-full" /></div>
              </div>
            </div>

            {/* Body */}
            <div ref={parentRef} className="flex-grow overflow-auto" style={{ contain: 'strict' }}>
              <div className="relative w-full" style={{ height: `${listRowVirtualizer.getTotalSize()}px` }}>
                {listRowVirtualizer.getVirtualItems().map(virtualRow => {
                  const prop = sortedProperties[virtualRow.index];
                  const isSelected = selectedIds.has(prop.id);
                  return (
                    <div key={prop.id} onClick={() => onSelectProperty(prop)} className={`transition-colors flex absolute w-full px-6 border-b border-[var(--border-primary)] cursor-pointer ${isSelected ? 'bg-green-900/20' : 'hover:bg-[var(--bg-tertiary)]'}`} style={{ height: `${virtualRow.size}px`, transform: `translateY(${virtualRow.start}px)` }}>
                      <div className="flex-shrink-0 pr-4 flex items-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded bg-[var(--bg-primary)] border-[var(--border-primary)] text-[var(--primary-accent)] focus:ring-[var(--primary-accent)]"
                          checked={isSelected}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleToggleSelection(prop.id);
                          }}
                          aria-label={`Seleccionar ${prop.title}`}
                        />
                      </div>
                      <div className={`py-4 flex items-center overflow-hidden ${columnStyles.propiedad}`}>
                        <div className="flex-shrink-0 h-10 w-10">
                          <img className="h-10 w-10 rounded-md object-cover" src={prop.imageUrl || `https://picsum.photos/seed/prop${prop.id}/200`} alt={prop.title} loading="lazy" decoding="async" />
                        </div>
                        <div className="ml-4 overflow-hidden">
                          <div className="text-sm font-medium text-[var(--text-primary)] truncate" title={prop.title}>{prop.title}</div>
                        </div>
                      </div>
                      <div className={`py-4 flex items-center whitespace-nowrap text-sm text-[var(--text-secondary)] ${columnStyles.tipo}`}>{prop.propertyType || 'N/A'}</div>
                      <div className={`py-4 flex items-center justify-center whitespace-nowrap text-sm text-[var(--text-secondary)] ${columnStyles.ambientes}`}>{prop.bedrooms ?? '-'}</div>
                      <div className={`py-4 flex items-center whitespace-nowrap text-sm text-[var(--text-secondary)] ${columnStyles.zona}`}>{prop.zona || 'N/A'}</div>
                      <div className={`py-4 flex items-center justify-end whitespace-nowrap text-sm text-[var(--text-primary)] ${columnStyles.precio}`}>{prop.currency} {prop.price.toLocaleString('es-AR')}</div>
                      <div className={`py-4 flex items-center justify-end whitespace-nowrap text-sm text-[var(--text-secondary)] ${columnStyles.m2pond}`}>{prop.total_calculated_sqm ? `${prop.total_calculated_sqm.toFixed(0)} m²` : '-'}</div>
                      <div className={`py-4 flex items-center justify-end whitespace-nowrap text-sm text-[var(--text-secondary)] ${columnStyles.usdm2pond}`}>{prop.calculated_price_per_sqm ? `USD ${prop.calculated_price_per_sqm.toLocaleString('es-AR', { maximumFractionDigits: 0 })}` : '-'}</div>
                      <div className={`py-4 flex items-center justify-end whitespace-nowrap text-sm text-[var(--text-secondary)] ${columnStyles.diasPublicado}`}>
                        {prop.days_on_market ?? '-'}
                      </div>
                      <div className={`py-4 flex items-center justify-end whitespace-nowrap text-sm font-semibold ${columnStyles.descuento}`}>
                        {prop.discountPercentage !== undefined && prop.discountPercentage !== null ? (
                          <span className={prop.discountPercentage < 0 ? 'text-green-400' : 'text-red-400'}>
                            {prop.discountPercentage < 0 ? '▼' : '▲'} {Math.abs(prop.discountPercentage).toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-[var(--text-tertiary)]">-</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex-shrink-0 flex items-center justify-between mt-4 px-2">
          <p className="text-sm text-[var(--text-secondary)]">
            Mostrando {page * pageSize + 1}-{Math.min((page + 1) * pageSize, totalCount)} de {totalCount.toLocaleString('es-AR')}
          </p>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onPageChange(0)}
              disabled={page === 0}
              className="px-3 py-1.5 text-sm rounded-md bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ««
            </button>
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page === 0}
              className="px-3 py-1.5 text-sm rounded-md bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              « Anterior
            </button>
            <span className="px-3 py-1.5 text-sm text-[var(--text-primary)] font-medium">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 text-sm rounded-md bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Siguiente »
            </button>
            <button
              onClick={() => onPageChange(totalPages - 1)}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 text-sm rounded-md bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              »»
            </button>
          </div>
        </div>
      )}
    </div>
  );
});