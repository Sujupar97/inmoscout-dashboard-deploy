import React, { useMemo } from 'react';

interface TimeSeriesChartProps {
  data: { date: Date; value: number }[];
  title: string;
}

export const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({ data, title }) => {
  const chartData = useMemo(() => {
    if (data.length < 2) return null;

    const values = data.map(d => d.value);
    const dates = data.map(d => d.date.getTime());

    const yMin = 0;
    const yMax = Math.max(...values) * 1.1; // Add 10% padding
    const xMin = Math.min(...dates);
    const xMax = Math.max(...dates);

    const width = 100;
    const height = 100;

    const toSvgX = (date: number) => (xMax - xMin > 0) ? ((date - xMin) / (xMax - xMin)) * width : width / 2;
    const toSvgY = (value: number) => height - ((value - yMin) / (yMax - yMin)) * height;
    
    const points = data.map(d => `${toSvgX(d.date.getTime())},${toSvgY(d.value)}`).join(' ');
    
    const areaPath = `M ${toSvgX(xMin)},${toSvgY(yMin)} L ${points} L ${toSvgX(xMax)},${toSvgY(yMin)} Z`;
    const linePath = `M ${points}`;

    return { areaPath, linePath, yMax };
  }, [data]);

  return (
    <div className="bg-[var(--bg-secondary)] p-4 sm:p-6 rounded-lg border border-[var(--border-primary)] h-full flex flex-col">
      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex-shrink-0">{title}</h3>
      <div className="flex-grow w-full h-full flex items-stretch">
        {chartData ? (
          <>
            <div className="flex flex-col justify-between text-xs text-[var(--text-tertiary)] pr-2 text-right">
                <span>{Math.ceil(chartData.yMax)}</span>
                <span>{Math.ceil(chartData.yMax / 2)}</span>
                <span>0</span>
            </div>
            <div className="relative flex-grow">
                <div className="absolute inset-0 grid grid-rows-3 pointer-events-none">
                     <div className="border-b border-dashed border-[var(--border-primary)]/50"></div>
                     <div className="border-b border-dashed border-[var(--border-primary)]/50"></div>
                     <div></div>
                </div>
                <div className="absolute inset-0">
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
                        <defs>
                            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="var(--primary-accent)" stopOpacity={0.4} />
                                <stop offset="100%" stopColor="var(--primary-accent)" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <path d={chartData.areaPath} fill="url(#areaGradient)" />
                        <path d={chartData.linePath} fill="none" stroke="var(--primary-accent)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
                    </svg>
                </div>
            </div>
          </>
        ) : (
          <div className="flex-grow flex items-center justify-center">
            <p className="text-[var(--text-tertiary)]">No hay suficientes datos para mostrar la tendencia.</p>
          </div>
        )}
      </div>
    </div>
  );
};