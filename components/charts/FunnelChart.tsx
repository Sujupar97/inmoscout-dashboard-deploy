import React from 'react';

interface FunnelChartProps {
  title: string;
  data: { label: string; value: number }[];
}

export const FunnelChart: React.FC<FunnelChartProps> = ({ title, data }) => {
  if (data.length === 0 || data[0].value === 0) {
    return (
      <div className="bg-[var(--bg-secondary)] p-4 sm:p-6 rounded-lg border border-[var(--border-primary)] h-full flex flex-col">
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">{title}</h3>
        <div className="flex items-center justify-center h-full">
          <p className="text-[var(--text-tertiary)]">No hay datos para el período.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--bg-secondary)] p-4 sm:p-6 rounded-lg border border-[var(--border-primary)] h-full flex flex-col">
      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex-shrink-0">{title}</h3>
      <div className="flex-grow flex flex-col justify-center space-y-1">
        {data.map((stage, index) => {
          const nextStage = data[index + 1];
          const conversionRate = nextStage && stage.value > 0 ? (nextStage.value / stage.value) * 100 : null;
          
          return (
            <React.Fragment key={stage.label}>
              <div className="bg-[var(--bg-tertiary)] p-3 rounded-md flex justify-between items-center border border-[var(--border-primary)]">
                <div>
                  <p className="text-sm text-[var(--text-secondary)]">{stage.label}</p>
                  <p className="text-xl font-bold text-[var(--text-primary)]">{stage.value.toLocaleString('es-AR')}</p>
                </div>
              </div>
              {conversionRate !== null && (
                <div className="flex justify-center items-center my-1" aria-hidden="true">
                  <div className="w-px h-4 bg-[var(--border-primary)]"></div>
                  <div className="text-xs text-green-400 font-mono bg-[var(--bg-primary)] px-2 py-0.5 rounded-full border border-[var(--border-primary)] -my-2 z-10">
                    {'▼ '}{conversionRate.toFixed(1)}%
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
