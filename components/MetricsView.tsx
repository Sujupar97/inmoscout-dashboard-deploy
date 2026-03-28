import React, { useMemo, useState, useEffect } from 'react';
import { Property, PropertyStatus } from '../types';
import { ChartBarIcon } from './icons/ChartBarIcon';
import { TagIcon } from './icons/TagIcon';
import { PriceIcon } from './icons/PriceIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { EyeIcon } from './icons/EyeIcon';
import { TimeSeriesChart } from './charts/TimeSeriesChart';
import { FunnelChart } from './charts/FunnelChart';
import { fetchMetricsSummary } from '../services/propertyService';
import { MetricsSummary } from '../supabase';

interface MetricsViewProps {
    properties?: Property[];
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


export const MetricsView: React.FC<MetricsViewProps> = React.memo(() => {
    const [dateRange, setDateRange] = useState(30);
    const [serverData, setServerData] = useState<MetricsSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch metrics from server when dateRange changes
    useEffect(() => {
        setIsLoading(true);
        fetchMetricsSummary(dateRange === 0 ? 3650 : dateRange)
            .then(data => {
                setServerData(data);
                setIsLoading(false);
            })
            .catch(() => setIsLoading(false));
    }, [dateRange]);

    const metrics = useMemo(() => {
        if (!serverData) {
            return {
                totalProperties: 0, totalOpportunities: 0, totalStrongOpportunities: 0,
                avgSqmPrice: 'N/A', avgDiscount: 'N/A',
                timeSeriesData: [], funnelData: [], zonaAnalysisData: [], portalAnalysisData: [],
            };
        }

        const s = serverData.summary;
        const timeSeriesData = (serverData.timeSeries || []).map(d => ({
            date: new Date(d.date),
            value: d.count,
        }));

        const funnelData = [
            { label: 'Propiedades Analizadas', value: s.total_properties },
            { label: 'Oportunidades (Desc. > 0%)', value: s.opportunities },
            { label: 'Oportunidades Clave (Desc. <= -30%)', value: s.strong_opportunities },
        ];

        const zonaAnalysisData = (serverData.byZone || [])
            .map(z => ({
                zona: z.zona,
                count: z.count,
                avgSqmPrice: z.avg_price_per_sqm || 0,
                avgDiscount: z.avg_discount || 0,
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        const portalAnalysisData = (serverData.byPortal || []).map(p => ({
            portal: p.portal,
            count: p.count,
            opportunities: 0,
            avgSqmPrice: 0,
            avgDiscount: 0,
        }));

        return {
            totalProperties: s.total_properties,
            totalOpportunities: s.opportunities,
            totalStrongOpportunities: s.strong_opportunities,
            avgSqmPrice: s.avg_price_per_sqm > 0 ? `USD ${s.avg_price_per_sqm.toFixed(0)}` : 'N/A',
            avgDiscount: s.opportunities > 0 ? `${s.avg_discount.toFixed(1)}%` : 'N/A',
            timeSeriesData,
            funnelData,
            zonaAnalysisData,
            portalAnalysisData,
        };
    }, [serverData]);

    if (isLoading && !serverData) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[var(--primary-accent)]" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-[var(--bg-secondary)] p-4 rounded-lg border border-[var(--border-primary)] flex flex-col sm:flex-row items-center justify-between flex-wrap gap-4">
                <div className="flex items-center space-x-3">
                    <h3 className="text-lg font-semibold text-[var(--text-primary)]">Métricas para el Período</h3>
                    {isLoading && <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-[var(--primary-accent)]" />}
                </div>
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