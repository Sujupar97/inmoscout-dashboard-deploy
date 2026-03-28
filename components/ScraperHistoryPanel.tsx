import React, { useState, useEffect } from 'react';
import { fetchScraperHistory } from '../services/propertyService';
import { ScraperHistoryData } from '../supabase';

export const ScraperHistoryPanel: React.FC = () => {
  const [data, setData] = useState<ScraperHistoryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [days, setDays] = useState(7);

  useEffect(() => {
    setIsLoading(true);
    fetchScraperHistory(days)
      .then(setData)
      .finally(() => setIsLoading(false));
  }, [days]);

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[var(--primary-accent)]" />
      </div>
    );
  }

  if (!data || (data.runs.length === 0 && data.dailySummary.length === 0)) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--text-secondary)]">No hay datos de ejecuciones del scraper todavía.</p>
        <p className="text-sm text-[var(--text-tertiary)] mt-2">
          Los datos aparecerán cuando n8n comience a reportar resultados al endpoint <code>scraper-callback</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">Historial del Scraper</h3>
        <div className="flex space-x-2">
          {[3, 7, 14, 30].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                days === d
                  ? 'bg-[var(--primary-accent)] text-white'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border-primary)]'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      {data.byPortal && data.byPortal.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {data.byPortal.map(p => (
            <div key={p.portal} className="bg-[var(--bg-secondary)] p-4 rounded-lg border border-[var(--border-primary)]">
              <p className="text-sm text-[var(--text-secondary)] font-medium">{p.portal}</p>
              <p className="text-2xl font-bold text-[var(--text-primary)]">{p.total_new}</p>
              <p className="text-xs text-[var(--text-secondary)]">{p.total_runs} ejecuciones | ~{p.avg_duration}s prom.</p>
            </div>
          ))}
        </div>
      )}

      {/* Daily summary table */}
      {data.dailySummary && data.dailySummary.length > 0 && (
        <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] overflow-hidden">
          <h4 className="text-sm font-semibold text-[var(--text-primary)] p-4 border-b border-[var(--border-primary)]">Resumen Diario</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[var(--border-primary)]">
              <thead className="bg-[var(--bg-tertiary)]/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase">Fecha</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-[var(--text-secondary)] uppercase">Ejecuciones</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-[var(--text-secondary)] uppercase">Nuevas</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-[var(--text-secondary)] uppercase">Duplicadas</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-[var(--text-secondary)] uppercase">Fallidas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-primary)]">
                {data.dailySummary.map(day => (
                  <tr key={day.date} className="hover:bg-[var(--bg-tertiary)]">
                    <td className="px-4 py-3 text-sm text-[var(--text-primary)]">{day.date}</td>
                    <td className="px-4 py-3 text-sm text-[var(--text-secondary)] text-right">{day.total_runs}</td>
                    <td className="px-4 py-3 text-sm text-green-400 font-semibold text-right">{day.total_new}</td>
                    <td className="px-4 py-3 text-sm text-[var(--text-secondary)] text-right">{day.total_skipped}</td>
                    <td className="px-4 py-3 text-sm text-right">
                      <span className={day.total_failed > 0 ? 'text-red-400 font-semibold' : 'text-[var(--text-secondary)]'}>
                        {day.total_failed}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent runs table */}
      <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] overflow-hidden">
        <h4 className="text-sm font-semibold text-[var(--text-primary)] p-4 border-b border-[var(--border-primary)]">Ejecuciones Recientes</h4>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="min-w-full divide-y divide-[var(--border-primary)]">
            <thead className="bg-[var(--bg-tertiary)]/50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-[var(--text-secondary)] uppercase">Fecha</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-[var(--text-secondary)] uppercase">Portal</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-[var(--text-secondary)] uppercase">Zona</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-[var(--text-secondary)] uppercase">Tipo</th>
                <th className="px-3 py-2 text-center text-xs font-medium text-[var(--text-secondary)] uppercase">Estado</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-[var(--text-secondary)] uppercase">Nuevas</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-[var(--text-secondary)] uppercase">Omitidas</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-[var(--text-secondary)] uppercase">Duración</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-primary)]">
              {data.runs.slice(0, 50).map(run => (
                <tr key={run.id} className="hover:bg-[var(--bg-tertiary)]">
                  <td className="px-3 py-2 text-xs text-[var(--text-secondary)]">
                    {new Date(run.created_at).toLocaleString('es-AR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-3 py-2 text-xs text-[var(--text-primary)]">{run.portal}</td>
                  <td className="px-3 py-2 text-xs text-[var(--text-secondary)]">{run.zona}</td>
                  <td className="px-3 py-2 text-xs text-[var(--text-secondary)]">{run.property_type}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${
                      run.status === 'completed' ? 'bg-green-900/30 text-green-400' :
                      run.status === 'failed' ? 'bg-red-900/30 text-red-400' :
                      'bg-yellow-900/30 text-yellow-400'
                    }`}>
                      {run.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-green-400 text-right font-medium">{run.properties_new}</td>
                  <td className="px-3 py-2 text-xs text-[var(--text-secondary)] text-right">{run.properties_skipped}</td>
                  <td className="px-3 py-2 text-xs text-[var(--text-secondary)] text-right">{run.duration_seconds ? `${run.duration_seconds}s` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
