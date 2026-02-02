
import React, { useState, useMemo } from 'react';
import { Property } from '../types';
import { TrendChart } from './TrendChart';
import { ChevronDownIcon } from './icons/ChevronDownIcon';

interface OpportunityAnalysisViewProps {
  properties: Property[];
  onSelectProperty: (property: Property) => void;
}

export const OpportunityAnalysisView: React.FC<OpportunityAnalysisViewProps> = ({ properties, onSelectProperty }) => {
  const [selectedZona, setSelectedZona] = useState<string>('All');
  
  const zonas = useMemo(() => {
    const uniqueZonas = new Set(properties.map(p => p.zona).filter(Boolean));
    return ['All', ...Array.from(uniqueZonas).sort()];
  }, [properties]);

  const analysisData = useMemo(() => {
    const data = selectedZona === 'All' ? properties : properties.filter(p => p.zona === selectedZona);
    
    const opportunities = [...data]
      .filter(p => p.discountPercentage !== undefined)
      .sort((a, b) => (a.discountPercentage || 0) - (b.discountPercentage || 0));

    const validProps = data.filter(p => p.total_calculated_sqm && p.price && p.total_calculated_sqm > 0 && p.price > 0);
    
    if (validProps.length === 0) {
      return { stats: { avgPrice: 0, avgSqmPrice: 0, count: data.length }, opportunities };
    }
    
    const totalPrice = validProps.reduce((sum, p) => sum + p.price, 0);
    const totalSqmPrice = validProps.reduce((sum,p) => sum + (p.calculated_price_per_sqm || 0), 0);
    
    const stats = {
      avgPrice: totalPrice / validProps.length,
      avgSqmPrice: totalSqmPrice / validProps.length,
      count: data.length,
    };
      
    return { stats, opportunities };
  }, [properties, selectedZona]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <label htmlFor="zona-select" className="block text-sm font-medium text-gray-600 mb-1">Seleccionar Zona para Analizar</label>
        <div className="relative">
          <select
            id="zona-select"
            value={selectedZona}
            onChange={(e) => setSelectedZona(e.target.value)}
            className="appearance-none w-full max-w-sm bg-gray-100 border border-gray-300 rounded-md shadow-sm py-2 px-3 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          >
            {zonas.map(zona => <option key={zona} value={zona}>{zona === 'All' ? 'Todas las Zonas' : zona}</option>)}
          </select>
          <ChevronDownIcon className="h-5 w-5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>
      
      {selectedZona !== 'All' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg border border-gray-200">
                 <h3 className="text-lg font-semibold text-gray-900 mb-4">Estadísticas de <span className="text-indigo-600">{selectedZona}</span></h3>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-sm text-gray-500">Propiedades</p>
                        <p className="text-2xl font-bold text-gray-900">{analysisData.stats.count}</p>
                    </div>
                     <div>
                        <p className="text-sm text-gray-500">Precio Promedio</p>
                        <p className="text-2xl font-bold text-gray-900">USD {analysisData.stats.avgPrice.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</p>
                    </div>
                    <div className="col-span-2">
                        <p className="text-sm text-gray-500">Precio/m² Promedio (Ponderado)</p>
                        <p className="text-2xl font-bold text-gray-900">USD {analysisData.stats.avgSqmPrice.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</p>
                    </div>
                 </div>
            </div>
            <div className="bg-white p-6 rounded-lg border border-gray-200 min-h-[200px]">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Tendencia de Precio/m²</h3>
                <TrendChart properties={properties.filter(p => p.zona === selectedZona)} />
            </div>
        </div>
      )}

      <div className="bg-white rounded-lg overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Propiedad</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precio/m² Actual</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">$/m² Promedio (Zona)</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descuento</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {analysisData.opportunities.map((prop) => (
                  <tr key={prop.id} onClick={() => onSelectProperty(prop)} className="hover:bg-gray-50 cursor-pointer transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 truncate max-w-xs">{prop.title}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">USD {prop.price.toLocaleString('es-AR')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {prop.calculated_price_per_sqm ? `USD ${prop.calculated_price_per_sqm.toFixed(0)}` : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {prop.averagePricePerSqm ? `USD ${prop.averagePricePerSqm.toFixed(0)}` : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                      {prop.discountPercentage ? (
                        <span className={prop.discountPercentage < 0 ? 'text-green-600' : 'text-red-600'}>
                          {prop.discountPercentage < 0 ? '▼' : '▲'} {Math.abs(prop.discountPercentage).toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-gray-500">N/A</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        </div>
        {analysisData.opportunities.length === 0 && (
             <div className="text-center py-16">
                <h3 className="text-xl font-semibold text-gray-800">No hay datos para esta selección</h3>
                <p className="text-gray-500 mt-2">Prueba a seleccionar otra zona o ejecuta el scraper para obtener más datos.</p>
            </div>
        )}
      </div>
    </div>
  );
};
