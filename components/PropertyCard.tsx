import React from 'react';
import { Property, PropertyStatus } from '../types';
import { LocationIcon } from './icons/LocationIcon';
import { PriceIcon } from './icons/PriceIcon';
import { AreaIcon } from './icons/AreaIcon';
import { TagIcon } from './icons/TagIcon';
import { EyeIcon } from './icons/EyeIcon';
import { propertyStatusTranslations } from '../utils/translations';
import { GlobeAltIcon } from './icons/GlobeAltIcon';

interface PropertyCardProps {
  property: Property;
  onSelectProperty: (property: Property) => void;
  onUpdateStatus: (propertyId: string, status: PropertyStatus) => void;
  isSelected: boolean;
  onToggleSelection: (id: string) => void;
}

const statusPillStyles: { [key in PropertyStatus]: string } = {
  [PropertyStatus.New]: 'bg-indigo-500',
  [PropertyStatus.Contacted]: 'bg-blue-500',
  [PropertyStatus.VisitScheduled]: 'bg-violet-500',
  [PropertyStatus.Negotiating]: 'bg-amber-500',
  [PropertyStatus.Acquired]: 'bg-green-500',
  [PropertyStatus.Discarded]: 'bg-red-500',
};


export const PropertyCard: React.FC<PropertyCardProps> = React.memo(({ property, onSelectProperty, onUpdateStatus, isSelected, onToggleSelection }) => {

  const isOpportunity = property.discountPercentage !== undefined && property.discountPercentage <= -30;

  return (
    <div
      className={`bg-[var(--bg-secondary)] rounded-lg border transition-all duration-300 transform hover:-translate-y-1 cursor-pointer flex flex-col ${isSelected ? 'border-green-500' : 'border-[var(--border-primary)] hover:border-[var(--primary-accent)]'}`}
      onClick={() => onSelectProperty(property)}
    >
      <div className="relative overflow-hidden rounded-t-lg">
        <input
          type="checkbox"
          className="absolute top-3 right-3 h-5 w-5 rounded bg-black/30 border-white/50 text-[var(--primary-accent)] focus:ring-0 focus:offset-0 z-10"
          checked={isSelected}
          onClick={(e) => {
            e.stopPropagation();
          }}
          onChange={(e) => {
            e.stopPropagation();
            onToggleSelection(property.id);
          }}
          aria-label={`Seleccionar ${property.title}`}
        />
        {property.imageUrl ? (
          <img className="h-48 w-full object-cover" src={property.imageUrl} alt={property.title} loading="lazy" decoding="async" />
        ) : (
          <div className="h-48 w-full flex items-center justify-center bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]">
            <div className="text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-2 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" /></svg>
              <span className="text-xs">Sin imagen</span>
            </div>
          </div>
        )}
        {isOpportunity && (
          <div className="absolute top-2 left-2 bg-green-500 text-black text-xs font-bold px-3 py-1 rounded-full flex items-center shadow-lg">
            <TagIcon className="h-4 w-4 mr-1" />
            Oportunidad ({property.discountPercentage!.toFixed(0)}%)
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-grow">
        <div className="flex justify-between items-start">
          <div className={`text-xs px-2.5 py-1 rounded-full text-white font-semibold ${statusPillStyles[property.status]}`}>
            {propertyStatusTranslations[property.status]}
          </div>
          <div className="flex items-center space-x-2 text-xs text-[var(--text-secondary)]">
            {property.portal && (
              <span className="flex items-center" title={`Portal: ${property.portal}`}>
                <GlobeAltIcon className="h-4 w-4 mr-1" />
                {property.portal}
              </span>
            )}
            {property.days_on_market != null && (
              <span title={`${property.days_on_market} días en mercado`}>{property.days_on_market} días</span>
            )}
          </div>
        </div>
        <h3 className="text-lg font-semibold mt-3 text-[var(--text-primary)] truncate" title={property.title}>{property.title}</h3>
        {property.seller_name &&
          <p className="text-sm text-[var(--text-secondary)] truncate mb-3">{property.seller_name}</p>
        }
        <div className="space-y-2 text-sm text-[var(--text-primary)]">
          <div className="flex items-center">
            <LocationIcon className="h-4 w-4 mr-2 text-[var(--text-tertiary)] flex-shrink-0" />
            <span className="truncate">{property.location}{property.zona && ` (${property.zona})`}</span>
          </div>
          <div className="flex items-center">
            <PriceIcon className="h-4 w-4 mr-2 text-[var(--text-tertiary)] flex-shrink-0" />
            <span>{property.currency} {property.price.toLocaleString('es-AR')}</span>
          </div>
          <div className="flex items-center">
            <AreaIcon className="h-4 w-4 mr-2 text-[var(--text-tertiary)] flex-shrink-0" />
            <span>
              {property.total_calculated_sqm?.toFixed(0) || 0} m²
              {property.calculated_price_per_sqm && ` (~${(property.calculated_price_per_sqm).toFixed(0)} USD/m²)`}
            </span>
          </div>
        </div>
        <div className="mt-auto pt-4">
          <button
            onClick={(e) => { e.stopPropagation(); onSelectProperty(property); }}
            className="w-full text-center bg-[var(--primary-accent)] hover:bg-[var(--primary-accent-hover)] text-white font-bold py-2 px-4 rounded-md transition-colors"
          >
            Ver Detalles
          </button>
        </div>
      </div>
    </div>
  );
});