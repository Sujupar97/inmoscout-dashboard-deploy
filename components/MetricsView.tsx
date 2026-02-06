import React, { useMemo, useState } from 'react';
import { Property, PropertyStatus } from '../types';
import { ChartBarIcon } from './icons/ChartBarIcon';
import { TagIcon } from './icons/TagIcon';
import { PriceIcon } from './icons/PriceIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { EyeIcon } from './icons/EyeIcon';
import { TimeSeriesChart } from './charts/TimeSeriesChart';
import { FunnelChart } from './charts/FunnelChart';

interface MetricsViewProps {
    properties: Property[];
}

// Sub-componentes
const StatCard: React.FC<{ icon: React.ElementType, title: string, value: string, color: string }> = ({ icon: Icon, title, value, color }) => (
    <div className="bg-[var(--bg-secondary)] p-4 rounded-lg border border-[var(--border-primary)] flex items-center space-x-4">
        <div className={`p-3 rounded-lg ${color}`}>
            <Icon className="h-6 w-6 text-white" />
        </div>
        <div>
            <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wider font-semibold">{title}</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
        </div>
    </div>
);

const DateRangeButton: React.FC<{
    days: number;
    label: string;
    currentDateRange: number;
    setDateRange: (days: number) => void;
}> = ({ days, label, currentDateRange, setDateRange }) => (
    <button
        onClick={() => setDateRange(days)}
        className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${currentDateRange === days ? 'bg-[var(--primary-accent)] text-white shadow-md' : 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border border-[var(--border-primary)]'
            }`}
    >
        {label}
    </button>
);


export const MetricsView: React.FC<MetricsViewProps> = React.memo(({ properties }) => {
    const [dateRange, setDateRange] = useState(30); // Default to 30d

    const filteredProperties = useMemo(() => {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (dateRange === 0) return properties; // 0 for "All time"

        const cutoffDate = new Date(todayStart);
        cutoffDate.setDate(todayStart.getDate() - (dateRange - 1));

        return properties.filter(p => {
            if (!p.created_at) return false;
            const propDate = new Date(p.created_at);
            return propDate >= cutoffDate;
        });
    }, [properties, dateRange]);

    const metrics = useMemo(() => {
        const propertiesForStats = filteredProperties.filter(p => p.status !== PropertyStatus.Discarded);

        const opportunities = propertiesForStats.filter(p => p.discountPercentage !== undefined && p.discountPercentage < 0);
        const strongOpportunities = opportunities.filter(p => p.discountPercentage !== undefined && p.discountPercentage <= -30);

        const validSqmProps = propertiesForStats.filter(p => p.calculated_price_per_sqm && p.calculated_price_per_sqm > 0);
        const avgSqmPrice = validSqmProps.reduce((sum, p) => sum + p.calculated_price_per_sqm!, 0) / (validSqmProps.length || 1);

        const avgDiscount = opportunities.reduce((sum, p) => sum + p.discountPercentage!, 0) / (opportunities.length || 1);

        // For TimeSeriesChart - Counts all properties added in the period, regardless of status
        const dateCounts = filteredProperties.reduce<Record<string, number>>((acc, p) => {
            if (!p.created_at) return acc;
            const date = new Date(p.created_at).toISOString().split('T')[0];
            acc[date] = (acc[date] || 0) + 1;
            return acc;
        }, {});
        const timeSeriesData = Object.entries(dateCounts)
            .map(([date, value]) => ({ date: new Date(date), value }))
            .sort((a, b) => a.date.getTime() - b.date.getTime());

        // For FunnelChart - Based on non-discarded properties
        const funnelData = [
            { label: 'Propiedades Analizadas', value: propertiesForStats.length },
            { label: 'Oportunidades (Desc. > 0%)', value: opportunities.length },
            { label: 'Oportunidades Clave (Desc. <= -30%)', value: strongOpportunities.length }
        ];

        // For Zona Table - Based on non-discarded properties
        const zonaMetrics = propertiesForStats.reduce((acc, p) => {
            if (!p.zona) return acc;
            if (!acc[p.zona]) {
                acc[p.zona] = { count: 0, sqmPrices: [], discounts: [] };
            }
            acc[p.zona].count++;
            if (p.calculated_price_per_sqm) acc[p.zona].sqmPrices.push(p.calculated_price_per_sqm);
            if (p.discountPercentage) acc[p.zona].discounts.push(p.discountPercentage);
            return acc;
        }, {} as Record<string, { count: number; sqmPrices: number[]; discounts: number[] }>);

        const zonaAnalysisData = Object.entries(zonaMetrics)
            .map(([zona, data]) => {
                const typedData = data as { count: number; sqmPrices: number[]; discounts: number[] };
                return {
                    zona,
                    count: typedData.count,
                    avgSqmPrice: typedData.sqmPrices.length > 0 ? typedData.sqmPrices.reduce((a, b) => a + b, 0) / typedData.sqmPrices.length : 0,
                    avgDiscount: typedData.discounts.length > 0 ? typedData.discounts.reduce((a, b) => a + b, 0) / typedData.discounts.length : 0,
                };
            })
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        // For Portal Table - Based on non-discarded properties
        const portalMetrics = propertiesForStats.reduce((acc, p) => {
            const portal = p.portal || 'Desconocido';
            if (!acc[portal]) {
                acc[portal] = { count: 0, opportunities: 0, sqmPrices: [], discounts: [] };
            }
            acc[portal].count++;
            if (p.calculated_price_per_sqm) acc[portal].sqmPrices.push(p.calculated_price_per_sqm);
            if (p.discountPercentage !== undefined && p.discountPercentage < 0) {
                acc[portal].opportunities++;
                acc[portal].discounts.push(p.discountPercentage);
            }
            return acc;
        }, {} as Record<string, { count: number; opportunities: number; sqmPrices: number[]; discounts: number[] }>);

        const portalAnalysisData = Object.entries(portalMetrics)
            .map(([portal, data]) => {
                const typedData = data as { count: number; opportunities: number; sqmPrices: number[]; discounts: number[] };
                return {
                    portal,
                    count: typedData.count,
                    opportunities: typedData.opportunities,
                    avgSqmPrice: typedData.sqmPrices.length > 0 ? typedData.sqmPrices.reduce((a, b) => a + b, 0) / typedData.sqmPrices.length : 0,
                    avgDiscount: typedData.discounts.length > 0 ? typedData.discounts.reduce((a, b) => a + b, 0) / typedData.discounts.length : 0,
                };
            })
            .sort((a, b) => b.count - a.count);


        return {
            totalProperties: filteredProperties.length,
            totalOpportunities: opportunities.length,
            totalStrongOpportunities: strongOpportunities.length,
            avgSqmPrice: avgSqmPrice > 0 ? `USD ${avgSqmPrice.toFixed(0)}` : 'N/A',
            avgDiscount: opportunities.length > 0 ? `${avgDiscount.toFixed(1)}%` : 'N/A',
            timeSeriesData,
            funnelData,
            zonaAnalysisData,
            portalAnalysisData,
        };
    }, [filteredProperties]);

    return (
        <div className="space-y-6">
            <div className="bg-[var(--bg-secondary)] p-4 rounded-lg border border-[var(--border-primary)] flex flex-col sm:flex-row items-center justify-between flex-wrap gap-4">
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">Métricas para el Período</h3>
                <div className="flex space-x-2 bg-[var(--bg-primary)] p-1 rounded-lg flex-wrap justify-center">
                    <DateRangeButton days={1} label="Hoy" currentDateRange={dateRange} setDateRange={setDateRange} />
                    <DateRangeButton days={7} label="7d" currentDateRange={dateRange} setDateRange={setDateRange} />
                    <DateRangeButton days={30} label="30d" currentDateRange={dateRange} setDateRange={setDateRange} />
                    <DateRangeButton days={90} label="90d" currentDateRange={dateRange} setDateRange={setDateRange} />
                    <DateRangeButton days={0} label="Siempre" currentDateRange={dateRange} setDateRange={setDateRange} />
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                <StatCard icon={ChartBarIcon} title="Propiedades Añadidas" value={metrics.totalProperties.toLocaleString('es-AR')} color="bg-green-600" />
                <StatCard icon={EyeIcon} title="Oportunidades" value={metrics.totalOpportunities.toLocaleString('es-AR')} color="bg-teal-500" />
                <StatCard icon={SparklesIcon} title="Op. Clave (<=30%)" value={metrics.totalStrongOpportunities.toLocaleString('es-AR')} color="bg-violet-600" />
                <StatCard icon={PriceIcon} title="Precio/m² Prom." value={metrics.avgSqmPrice} color="bg-blue-600" />
                <StatCard icon={TagIcon} title="Desc. Promedio" value={metrics.avgDiscount} color="bg-amber-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-3">
                    <TimeSeriesChart title={`Nuevas Propiedades (Últimos ${dateRange === 0 ? '∞' : dateRange} días)`} data={metrics.timeSeriesData} />
                </div>
                <div className="lg:col-span-2">
                    <FunnelChart title="Pipeline de Oportunidades" data={metrics.funnelData} />
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="bg-[var(--bg-secondary)] rounded-lg overflow-hidden border border-[var(--border-primary)]">
                    <h3 className="text-lg font-semibold text-[var(--text-primary)] p-4 border-b border-[var(--border-primary)]">Análisis por Zona (Top 10)</h3>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-[var(--border-primary)]">
                            <thead className="bg-[var(--bg-tertiary)]/50">
                                <tr>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Zona</th>
                                    <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider"># Prop.</th>
                                    <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">$/m² Prom.</th>
                                    <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Desc. Prom.</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-primary)]">
                                {metrics.zonaAnalysisData.length === 0 && <tr><td colSpan={4} className="text-center p-8 text-[var(--text-tertiary)]">No hay datos de zona.</td></tr>}
                                {metrics.zonaAnalysisData.map(zona => (
                                    <tr key={zona.zona} className="hover:bg-[var(--bg-tertiary)] transition-colors">
                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-[var(--text-primary)]">{zona.zona}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-[var(--text-secondary)] text-right">{zona.count}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-[var(--text-secondary)] text-right">{zona.avgSqmPrice > 0 ? `USD ${zona.avgSqmPrice.toFixed(0)}` : '-'}</td>
                                        <td className={`px-4 py-3 whitespace-nowrap text-sm font-semibold text-right ${zona.avgDiscount < 0 ? 'text-green-400' : 'text-amber-400'}`}>
                                            {zona.avgDiscount !== 0 ? `${zona.avgDiscount.toFixed(1)}%` : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-[var(--bg-secondary)] rounded-lg overflow-hidden border border-[var(--border-primary)]">
                    <h3 className="text-lg font-semibold text-[var(--text-primary)] p-4 border-b border-[var(--border-primary)]">Análisis por Portal</h3>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-[var(--border-primary)]">
                            <thead className="bg-[var(--bg-tertiary)]/50">
                                <tr>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Portal</th>
                                    <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider"># Prop.</th>
                                    <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider"># Op.</th>
                                    <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">$/m² Prom.</th>
                                    <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">Desc. Prom.</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-primary)]">
                                {metrics.portalAnalysisData.length === 0 && <tr><td colSpan={5} className="text-center p-8 text-[var(--text-tertiary)]">No hay datos de portal.</td></tr>}
                                {metrics.portalAnalysisData.map(portal => (
                                    <tr key={portal.portal} className="hover:bg-[var(--bg-tertiary)] transition-colors">
                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-[var(--text-primary)]">{portal.portal}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-[var(--text-secondary)] text-right">{portal.count}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-[var(--text-secondary)] text-right">{portal.opportunities}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-[var(--text-secondary)] text-right">{portal.avgSqmPrice > 0 ? `USD ${portal.avgSqmPrice.toFixed(0)}` : '-'}</td>
                                        <td className={`px-4 py-3 whitespace-nowrap text-sm font-semibold text-right ${portal.avgDiscount < 0 ? 'text-green-400' : 'text-amber-400'}`}>
                                            {portal.avgDiscount !== 0 ? `${portal.avgDiscount.toFixed(1)}%` : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
});