import React, { useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
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

/**
 * MarkerCluster component that uses leaflet.markercluster directly
 * to efficiently render thousands of markers with clustering.
 */
const MarkerCluster: React.FC<{
  properties: Property[];
  onSelectProperty: (property: Property) => void;
}> = ({ properties, onSelectProperty }) => {
  const map = useMap();
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);

  const createIcon = (isOpportunity: boolean) => {
    const iconColor = isOpportunity ? '#22c55e' : '#34D399';
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

  useEffect(() => {
    if (!map) return;

    // Remove previous cluster group
    if (clusterGroupRef.current) {
      map.removeLayer(clusterGroupRef.current);
    }

    // Create cluster group with dark theme styling
    const clusterGroup = (L as any).markerClusterGroup({
      chunkedLoading: true,
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      iconCreateFunction: (cluster: any) => {
        const count = cluster.getChildCount();
        let size = 'small';
        let px = 30;
        if (count > 100) { size = 'large'; px = 50; }
        else if (count > 10) { size = 'medium'; px = 40; }

        return L.divIcon({
          html: `<div style="
            background: rgba(16, 185, 129, 0.8);
            border: 2px solid rgba(16, 185, 129, 1);
            border-radius: 50%;
            width: ${px}px;
            height: ${px}px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: ${size === 'large' ? '14' : '12'}px;
          ">${count}</div>`,
          className: 'custom-cluster-icon',
          iconSize: L.point(px, px),
        });
      },
    });

    // Add markers to cluster
    properties.forEach(property => {
      if (property.latitude == null || property.longitude == null) return;

      const isOpportunity = (property.discountPercentage || 0) < 0;
      const marker = L.marker([property.latitude, property.longitude], {
        icon: createIcon(isOpportunity),
      });

      const popupContent = `
        <div style="font-family: system-ui; width: 192px;">
          <h3 style="font-weight: bold; font-size: 0.875rem; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${property.title}</h3>
          <p style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 8px;">USD ${property.price.toLocaleString('es-AR')}</p>
          <button class="map-detail-btn" data-property-id="${property.id}" style="
            width: 100%; text-align: center; background: var(--primary-accent);
            color: white; font-weight: bold; padding: 4px 12px; border-radius: 4px;
            font-size: 0.75rem; border: none; cursor: pointer;
          ">Ver Detalles</button>
        </div>
      `;
      marker.bindPopup(popupContent);
      marker.on('popupopen', () => {
        const btn = document.querySelector(`.map-detail-btn[data-property-id="${property.id}"]`);
        if (btn) {
          btn.addEventListener('click', () => onSelectProperty(property));
        }
      });

      clusterGroup.addLayer(marker);
    });

    map.addLayer(clusterGroup);
    clusterGroupRef.current = clusterGroup;

    return () => {
      if (clusterGroupRef.current) {
        map.removeLayer(clusterGroupRef.current);
      }
    };
  }, [map, properties, onSelectProperty]);

  return null;
};

interface InteractiveMapProps {
    properties: Property[];
    onSelectProperty: (property: Property) => void;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({ properties, onSelectProperty }) => {
  const propertiesWithCoords = useMemo(
    () => properties.filter(p => p.latitude != null && p.longitude != null),
    [properties]
  );

  if (propertiesWithCoords.length === 0) {
    return (
        <div className="flex items-center justify-center h-full bg-[var(--bg-primary)] rounded-md">
            <p className="text-[var(--text-secondary)] text-center p-4">No hay propiedades con coordenadas en esta zona para mostrar en el mapa.</p>
        </div>
    );
  }

  const bounds = L.latLngBounds(propertiesWithCoords.map(p => [p.latitude!, p.longitude!]));

  return (
    <div className="w-full h-full">
      <MapContainer center={bounds.getCenter()} zoom={13} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <MarkerCluster properties={propertiesWithCoords} onSelectProperty={onSelectProperty} />
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
        .custom-leaflet-icon, .custom-cluster-icon {
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
