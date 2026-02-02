import React, { useState, useMemo } from 'react';
import { Property } from '../types';

interface TrendChartProps {
  properties: Property[];
}

// Sub-componente definido al nivel del módulo para garantizar la estabilidad entre renderizados.
const TimeframeButton: React.FC<{
  days: number;
  currentTimeframe: number;
  setTimeframe: (days: number) => void;
}> = ({ days, currentTimeframe, setTimeframe }) => (
  <button
    onClick={() => setTimeframe(days)}
    className={`px-2 py-1 text-xs rounded-md transition-colors ${
      currentTimeframe === days ? 'bg-cyan-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
    }`}
  >
    {days}d
  </button>
);

export const TrendChart: React.FC<TrendChartProps> = ({ properties }) => {
  const [timeframe, setTimeframe] = useState(90); // Default to 90 days

  const chartData = useMemo(() => {
    const now = new Date();
    const filteredProperties = properties
      .filter(p => p.total_calculated_sqm && p.price && p.created_at && p.total_calculated_sqm > 0)
      .map(p => ({
        date: new Date(p.created_at),
        pricePerSqm: p.price / p.total_calculated_sqm!,
      }))
      .filter(p => (now.getTime() - p.date.getTime()) / (1000 * 3600 * 24) <= timeframe)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (filteredProperties.length < 2) {
      return null;
    }

    const maxPrice = Math.max(...filteredProperties.map(p => p.pricePerSqm));
    const minPrice = Math.min(...filteredProperties.map(p => p.pricePerSqm));
    const firstDate = filteredProperties[0].date.getTime();
    const lastDate = filteredProperties[filteredProperties.length - 1].date.getTime();
    const dateRange = lastDate - firstDate;

    const points = filteredProperties.map(p => {
      const x = dateRange > 0 ? ((p.date.getTime() - firstDate) / dateRange) * 100 : 50;
      const y = maxPrice === minPrice ? 50 : 100 - ((p.pricePerSqm - minPrice) / (maxPrice - minPrice)) * 100;
      return `${x},${y}`;
    }).join(' ');

    return {
      points,
      minPrice,
      maxPrice,
      startDate: filteredProperties[0].date.toLocaleDateString('es-AR'),
      endDate: filteredProperties[filteredProperties.length-1].date.toLocaleDateString('es-AR'),
    };
  }, [properties, timeframe]);

  if (!chartData) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 text-sm">
        No hay suficientes datos para mostrar la tendencia.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
        <div className="flex-grow">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
                <polyline
                    fill="none"
                    stroke="url(#gradient)"
                    strokeWidth="1"
                    points={chartData.points}
                    vectorEffect="non-scaling-stroke"
                />
                <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#67e8f9" />
                        <stop offset="100%" stopColor="#0891b2" />
                    </linearGradient>
                </defs>
            </svg>
        </div>
        <div className="flex justify-between items-center text-xs text-gray-500 mt-2 px-1">
            <div className="flex space-x-1">
                <TimeframeButton days={30} currentTimeframe={timeframe} setTimeframe={setTimeframe} />
                <TimeframeButton days={90} currentTimeframe={timeframe} setTimeframe={setTimeframe} />
                <TimeframeButton days={180} currentTimeframe={timeframe} setTimeframe={setTimeframe} />
            </div>
            <span>{chartData.startDate} - {chartData.endDate}</span>
        </div>
    </div>
  );
};