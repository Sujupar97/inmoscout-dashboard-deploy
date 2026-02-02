import React, { useMemo, useState } from 'react';
import { Property, PropertyStatus } from '../types';
import { TagIcon } from './icons/TagIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { ChartBarIcon } from './icons/ChartBarIcon';
import { PriceIcon } from './icons/PriceIcon';
import { HomeIcon } from './icons/HomeIcon';
import { InteractiveMap } from './InteractiveMap';

// --- Tipos de Datos para el Análisis ---
interface PropertyTypeStats {
    type: string;
    count: number;
    avgSqmPrice: number;
    priceRange: { min: number; max: number };
    properties: Property[];
}

interface ZonaStats {
    zona: string;
    totalCount: number;
    avgSqmPrice: number;
    propertyTypes: PropertyTypeStats[];
}

// --- Componentes de la UI ---

const TopOpportunityCard: React.FC<{ property: Property; onSelect: (p: Property) => void }> = ({ property, onSelect }) => (
    <div onClick={() => onSelect(property)} className="bg-[var(--bg-tertiary)] p-3 rounded-md border border-[var(--border-primary)] hover:border-green-500 transition-colors cursor-pointer flex flex-col justify-between">
        <div>
            <p className="text-sm font-semibold text-[var(--text-primary)] truncate" title={property.title}>{property.title}</p>
            <p className="text-xs text-[var(--text-secondary)]">{property.zona}</p>
        </div>
        <div className="flex items-center justify-between mt-2">
            <span className="text-lg font-bold text-green-400 flex items-center">
                <TagIcon className="h-4 w-4 mr-1" />
                {property.discountPercentage?.toFixed(1)}%
            </span>
            <span className="text-sm text-[var(--text-primary)]">USD {property.price.toLocaleString('es-ar')}</span>
        </div>
    </div>
);

const StatCard: React.FC<{ icon: React.ElementType, label: string, value: string }> = ({ icon: Icon, label, value }) => (
    <div className="bg-[var(--bg-primary)] p-3 rounded-md flex items-center">
        <Icon className="h-6 w-6 mr-3 text-[var(--primary-accent-text)]" />
        <div>
            <p className="text-xs text-[var(--text-secondary)]">{label}</p>
            <p className="text-base font-bold text-[var(--text-primary)]">{value}</p>
        </div>
    </div>
);

const PriceDistributionChart: React.FC<{ properties: Property[] }> = ({ properties }) => {
    const chartData = useMemo(() => {
        if (properties.length < 2) return null;
        const prices = properties.map(p => p.price).sort((a, b) => a - b);
        const minPrice = prices[0];
        const maxPrice = prices[prices.length - 1];
        const bucketCount = 5;
        const bucketSize = (maxPrice - minPrice) / bucketCount;

        const buckets = Array.from({ length: bucketCount }, (_, i) => {
            const lowerBound = minPrice + i * bucketSize;
            const upperBound = lowerBound + bucketSize;
            return {
                label: `$${(lowerBound / 1000).toFixed(0)}k-$${(upperBound / 1000).toFixed(0)}k`,
                count: 0,
            };
        });

        properties.forEach(p => {
            let bucketIndex = Math.floor((p.price - minPrice) / bucketSize);
            if (bucketIndex >= bucketCount) bucketIndex = bucketCount - 1; // Para el valor máximo
            if (buckets[bucketIndex]) {
                 buckets[bucketIndex].count++;
            }
        });

        const maxCount = Math.max(...buckets.map(b => b.count));
        return { buckets, maxCount };

    }, [properties]);

    if (!chartData) return <div className="text-center text-sm text-[var(--text-secondary)] p-4">No hay suficientes datos para la distribución.</div>;

    return (
        <div className="space-y-2">
            {chartData.buckets.map((bucket, i) => (
                <div key={i} className="flex items-center text-xs">
                    <div className="w-20 text-right pr-2 text-[var(--text-secondary)]">{bucket.label}</div>
                    <div className="flex-1 bg-[var(--bg-primary)] rounded-full h-4">
                        <div
                            className="bg-gradient-to-r from-teal-500 to-green-500 h-4 rounded-full flex items-center justify-end pr-2"
                            style={{ width: chartData.maxCount > 0 ? `${(bucket.count / chartData.maxCount) * 100}%` : '0%' }}
                        >
                           <span className="text-white font-bold text-shadow">{bucket.count > 0 ? bucket.count : ''}</span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};


// FIX: Defined missing props interface for the component.
interface ComparativeAnalysisViewProps {
  properties: Property[];
  onSelectProperty: (property: Property) => void;
}

// --- Componente Principal ---
export const ComparativeAnalysisView: React.FC<ComparativeAnalysisViewProps> = ({ properties, onSelectProperty }) => {
    const [expandedZonas, setExpandedZonas] = useState<Set<string>>(new Set());
    const [selectedSegment, setSelectedSegment] = useState<{ zona: string; propertyType: string } | null>(null);

    // Separar la lógica en `useMemo` más pequeños y enfocados para mayor claridad y para evitar posibles errores de TDZ.
    const validProps = useMemo(() =>
        properties.filter(p => p.zona && p.propertyType && p.calculated_price_per_sqm && p.price > 0 && p.status !== PropertyStatus.Discarded),
        [properties]
    );

    const top5Opportunities = useMemo(() =>
        [...validProps]
            .filter(p => p.discountPercentage !== undefined)
            .sort((a, b) => (a.discountPercentage || 0) - (b.discountPercentage || 0))
            .slice(0, 5),
        [validProps]
    );

    const analysisData = useMemo(() => {
        const statsByZona = validProps.reduce((acc, p) => {
            if (!acc[p.zona!]) acc[p.zona!] = {};
            if (!acc[p.zona!][p.propertyType!]) acc[p.zona!][p.propertyType!] = [];
            acc[p.zona!][p.propertyType!].push(p);
            return acc;
        }, {} as Record<string, Record<string, Property[]>>);

        const analysis: ZonaStats[] = Object.entries(statsByZona).map(([zona, types]) => {
            const propertyTypes: PropertyTypeStats[] = Object.entries(types).map(([type, props]) => {
                const prices = props.map(p => p.price);
                return {
                    type,
                    count: props.length,
                    avgSqmPrice: props.reduce((sum, p) => sum + p.calculated_price_per_sqm!, 0) / props.length,
                    priceRange: { min: Math.min(...prices), max: Math.max(...prices) },
                    properties: props.sort((a,b) => (a.discountPercentage ?? 0) - (b.discountPercentage ?? 0))
                };
            }).sort((a,b) => b.count - a.count);

            const allPropsInZona = propertyTypes.flatMap(pt => pt.properties);
            return {
                zona,
                totalCount: allPropsInZona.length,
                avgSqmPrice: allPropsInZona.reduce((sum, p) => sum + p.calculated_price_per_sqm!, 0) / allPropsInZona.length,
                propertyTypes
            };
        }).sort((a, b) => b.totalCount - a.totalCount);
        
        return analysis;
    }, [validProps]);

    const toggleZona = (zona: string) => {
        setExpandedZonas(prev => {
            const newSet = new Set(prev);
            if (newSet.has(zona)) newSet.delete(zona);
            else newSet.add(zona);
            return newSet;
        });
    };

    const selectedSegmentData = useMemo(() => {
        if (!selectedSegment) return null;
        const zonaData = analysisData.find(z => z.zona === selectedSegment.zona);
        return zonaData?.propertyTypes.find(pt => pt.type === selectedSegment.propertyType) ?? null;
    }, [selectedSegment, analysisData]);

    return (
        <div className="space-y-6">
            <div className="bg-[var(--bg-secondary)] p-4 sm:p-6 rounded-lg border border-[var(--border-primary)]">
                <h3 className="text-xl font-bold text-[var(--text-primary)] mb-4">Top 5 Oportunidades Globales</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
                    {top5Opportunities.length > 0 ? top5Opportunities.map(p => (
                        <TopOpportunityCard key={p.id} property={p} onSelect={onSelectProperty} />
                    )) : <p className="text-[var(--text-secondary)] text-sm col-span-full">No hay datos suficientes para identificar oportunidades.</p>}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Matriz de Mercado */}
                <div className="lg:col-span-2 bg-[var(--bg-secondary)] p-0 rounded-lg border border-[var(--border-primary)] h-[500px] lg:h-auto lg:max-h-[calc(100vh-22rem)] flex flex-col">
                    <div className="p-4 border-b border-[var(--border-primary)]">
                        <h3 className="text-lg font-semibold text-[var(--text-primary)]">Matriz de Mercado</h3>
                        <p className="text-sm text-[var(--text-secondary)]">Expande una zona y selecciona un tipo.</p>
                    </div>
                    <div className="overflow-auto flex-grow">
                        <table className="min-w-full text-sm">
                            <thead className="bg-[var(--bg-primary)] sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)] uppercase tracking-wider w-full">Zona / Tipo Propiedad</th>
                                    <th className="px-4 py-3 text-right font-medium text-[var(--text-secondary)] uppercase tracking-wider">#</th>
                                    <th className="px-4 py-3 text-right font-medium text-[var(--text-secondary)] uppercase tracking-wider">$/m²</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-primary)]">
                                {analysisData.map(zona => (
                                    <React.Fragment key={zona.zona}>
                                        <tr onClick={() => toggleZona(zona.zona)} className="cursor-pointer hover:bg-[var(--bg-tertiary)]">
                                            <td className="px-4 py-3 font-bold text-[var(--text-primary)] flex items-center">
                                                <ChevronDownIcon className={`h-4 w-4 mr-2 transition-transform ${expandedZonas.has(zona.zona) ? 'rotate-0' : '-rotate-90'}`} />
                                                {zona.zona}
                                            </td>
                                            <td className="px-4 py-3 text-right text-[var(--text-secondary)] font-mono">{zona.totalCount}</td>
                                            <td className="px-4 py-3 text-right text-[var(--text-secondary)] font-mono">${zona.avgSqmPrice.toFixed(0)}</td>
                                        </tr>
                                        {expandedZonas.has(zona.zona) && zona.propertyTypes.map(pt => (
                                            <tr 
                                                key={pt.type} 
                                                onClick={() => setSelectedSegment({ zona: zona.zona, propertyType: pt.type })}
                                                className={`cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors ${selectedSegment?.zona === zona.zona && selectedSegment?.propertyType === pt.type ? 'bg-green-900/30' : ''}`}
                                            >
                                                <td className="pl-10 pr-4 py-2 text-[var(--text-primary)]">{pt.type}</td>
                                                <td className="px-4 py-2 text-right text-[var(--text-secondary)] font-mono">{pt.count}</td>
                                                <td className="px-4 py-2 text-right text-[var(--text-secondary)] font-mono">${pt.avgSqmPrice.toFixed(0)}</td>
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Panel de Análisis Profundo */}
                <div className="lg:col-span-3 bg-[var(--bg-secondary)] p-4 sm:p-6 rounded-lg border border-[var(--border-primary)] h-[500px] lg:h-auto lg:max-h-[calc(100vh-22rem)] flex flex-col">
                    {selectedSegmentData ? (
                        <>
                            <h3 className="text-xl font-bold text-[var(--text-primary)] mb-4 flex-shrink-0">Análisis: <span className="text-[var(--primary-accent-text)]">{selectedSegmentData.type}s en {selectedSegment?.zona}</span></h3>
                            <div className="space-y-4 overflow-y-auto">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <StatCard icon={HomeIcon} label="Propiedades" value={selectedSegmentData.count.toLocaleString('es-ar')} />
                                    <StatCard icon={PriceIcon} label="$/m² Promedio" value={`$${selectedSegmentData.avgSqmPrice.toFixed(0)}`} />
                                    <StatCard icon={ChartBarIcon} label="Rango de Precios" value={`$${(selectedSegmentData.priceRange.min/1000).toFixed(0)}k - $${(selectedSegmentData.priceRange.max/1000).toFixed(0)}k`} />
                                </div>

                                <div className="pt-2">
                                    <h4 className="text-base font-semibold text-[var(--text-primary)] mb-2">Distribución de Precios</h4>
                                    <PriceDistributionChart properties={selectedSegmentData.properties} />
                                </div>
                               
                                <div className="pt-2">
                                    <h4 className="text-base font-semibold text-[var(--text-primary)] mb-2">Top Oportunidades del Segmento</h4>
                                    <div className="space-y-2">
                                        {selectedSegmentData.properties.slice(0, 5).map(p => (
                                            <div key={p.id} onClick={() => onSelectProperty(p)} className="bg-[var(--bg-primary)] p-2 rounded-md flex justify-between items-center cursor-pointer hover:bg-[var(--bg-tertiary)]">
                                                <p className="text-xs text-[var(--text-primary)] truncate flex-1 pr-2" title={p.title}>{p.title}</p>
                                                <div className="flex items-center space-x-3 flex-shrink-0">
                                                    <span className="text-xs font-mono text-green-400 w-16 text-right">{p.discountPercentage?.toFixed(1)}%</span>
                                                    <span className="text-xs font-mono text-[var(--text-secondary)] w-20 text-right">USD {p.price.toLocaleString('es-ar')}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex items-center justify-center h-full text-center">
                            <div>
                                <h3 className="text-xl font-semibold text-[var(--text-primary)]">Análisis de Mercado Detallado</h3>
                                <p className="text-[var(--text-secondary)] mt-2 max-w-sm mx-auto">Selecciona un tipo de propiedad dentro de una zona en la Matriz de Mercado para ver un análisis profundo de ese nicho.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};