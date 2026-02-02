import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import ReactDOMServer from 'react-dom/server';
import { Property } from '../types';
import { MapPinIcon } from './icons/MapPinIcon';

const ChangeView: React.FC<{ bounds: L.LatLngBounds }> = ({ bounds }) => {
  const map = useMap();
  if (bounds.isValid()) {
    map.fitBounds(bounds, { padding: [50, 50] });
  }
  return null;
};

interface InteractiveMapProps {
    properties: Property[];
    onSelectProperty: (property: Property) => void;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({ properties, onSelectProperty }) => {
  const propertiesWithCoords = properties.filter(p => p.latitude != null && p.longitude != null);

  if (propertiesWithCoords.length === 0) {
    return (
        <div className="flex items-center justify-center h-full bg-[var(--bg-primary)] rounded-md">
            <p className="text-[var(--text-secondary)] text-center p-4">No hay propiedades con coordenadas en esta zona para mostrar en el mapa.</p>
        </div>
    );
  }

  const bounds = L.latLngBounds(propertiesWithCoords.map(p => [p.latitude!, p.longitude!]));

  const createIcon = (isOpportunity: boolean) => {
    const iconColor = isOpportunity ? '#22c55e' : '#34D399'; // Green for opportunity, Lighter Green for others
    const iconHtml = ReactDOMServer.renderToString(
      <MapPinIcon style={{ color: iconColor, height: '28px', width: '28px' }} />
    );
    return L.divIcon({
      html: iconHtml,
      className: 'custom-leaflet-icon',
      iconSize: [28, 28],
      iconAnchor: [14, 28],
      popupAnchor: [0, -28],
    });
  };

  return (
    <div className="w-full h-full">
      <MapContainer center={bounds.getCenter()} zoom={13} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        {propertiesWithCoords.map(property => {
          const isOpportunity = (property.discountPercentage || 0) < 0;
          return (
            <Marker
              key={property.id}
              position={[property.latitude!, property.longitude!]}
              icon={createIcon(isOpportunity)}
            >
              <Popup>
                <div className="font-sans w-48 text-[var(--text-primary)]">
                  <h3 className="font-bold text-sm mb-1 truncate">{property.title}</h3>
                  <p className="text-xs text-[var(--text-secondary)] mb-2">USD {property.price.toLocaleString('es-AR')}</p>
                  <button
                    onClick={() => onSelectProperty(property)}
                    className="w-full text-center bg-[var(--primary-accent)] hover:bg-[var(--primary-accent-hover)] text-white font-bold py-1 px-3 rounded text-xs"
                  >
                    Ver Detalles
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}
        {bounds.isValid() && <ChangeView bounds={bounds} />}
      </MapContainer>
      <style>{`
        .leaflet-popup-content-wrapper {
          background-color: var(--bg-secondary);
          border-radius: 8px;
          border: 1px solid var(--border-primary);
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        }
        .leaflet-popup-content {
          margin: 12px;
          font-size: 14px;
          line-height: 1.4;
          color: var(--text-primary);
        }
        .leaflet-popup-content p {
            margin: 0 0 5px;
        }
        .custom-leaflet-icon {
          background: transparent;
          border: none;
        }
        .leaflet-container a.leaflet-popup-close-button {
            padding: 4px 4px 0 0;
            color: var(--text-secondary);
        }
         .leaflet-container a.leaflet-popup-close-button:hover {
            color: var(--text-primary);
         }
        .leaflet-popup-tip {
            background-color: var(--bg-secondary);
        }
      `}</style>
    </div>
  );
};