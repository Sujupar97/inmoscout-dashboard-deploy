import React, { useState, useEffect } from 'react';
import { fetchDataQualitySummary } from '../services/propertyService';
import { DataQualitySummary } from '../supabase';

const FLAG_TYPE_LABELS: Record<string, string> = {
  missing_price: 'Sin Precio',
  missing_area: 'Sin Área',
  suspicious_price_per_sqm: 'Precio/m² Sospechoso',
  missing_location: 'Sin Ubicación',
  missing_image: 'Sin Imagen',
};

const FLAG_TYPE_COLORS: Record<string, string> = {
  missing_price: 'bg-red-900/30 text-red-400',
  missing_area: 'bg-amber-900/30 text-amber-400',
  suspicious_price_per_sqm: 'bg-purple-900/30 text-purple-400',
  missing_location: 'bg-blue-900/30 text-blue-400',
  missing_image: 'bg-gray-700/30 text-gray-400',
};

export const DataQualityPanel: React.FC = () => {
  const [data, setData] = useState<DataQualitySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDataQualitySummary()
      .then(setData)
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[var(--primary-accent)]" />
      </div>
    );
  }

  if (!data || data.totalFlags === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4">✓</div>
        <p className="text-[var(--text-primary)] font-semibold">Sin problemas de calidad de datos</p>
        <p className="text-sm text-[var(--text-secondary)] mt-2">Todas las propiedades tienen datos completos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">Calidad de Datos</h3>
        <span className="px-3 py-1 bg-amber-900/30 text-amber-400 rounded-full text-sm font-semibold">
          {data.totalFlags} problemas sin resolver
        </span>
      </div>

      {/* By type breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {data.byType.map(item => (
          <div key={item.type} className="bg-[var(--bg-secondary)] p-4 rounded-lg border border-[var(--border-primary)]">
            <span className={`inline-block px-2 py-0.5 text-xs rounded-full mb-2 ${FLAG_TYPE_COLORS[item.type] || 'bg-gray-700 text-gray-300'}`}>
              {FLAG_TYPE_LABELS[item.type] || item.type}
            </span>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{item.count}</p>
          </div>
        ))}
      </div>

      {/* Recent flags table */}
      <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] overflow-hidden">
        <h4 className="text-sm font-semibold text-[var(--text-primary)] p-4 border-b border-[var(--border-primary)]">
          Propiedades con Datos Incompletos (últimas 100)
        </h4>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="min-w-full divide-y divide-[var(--border-primary)]">
            <thead className="bg-[var(--bg-tertiary)]/50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase">Propiedad</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase">Zona</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-[var(--text-secondary)] uppercase">Problema</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase">Fecha</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-[var(--text-secondary)] uppercase">Enlace</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-primary)]">
              {data.recentFlags.map(flag => (
                <tr key={flag.id} className="hover:bg-[var(--bg-tertiary)]">
                  <td className="px-4 py-3 text-sm text-[var(--text-primary)] max-w-xs truncate" title={flag.property_title}>
                    {flag.property_title || 'Sin título'}
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{flag.property_zona || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${FLAG_TYPE_COLORS[flag.flag_type] || 'bg-gray-700 text-gray-300'}`}>
                      {FLAG_TYPE_LABELS[flag.flag_type] || flag.flag_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">
                    {new Date(flag.created_at).toLocaleDateString('es-AR')}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {flag.property_link && (
                      <a
                        href={flag.property_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--primary-accent)] hover:underline text-xs"
                      >
                        Ver
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
