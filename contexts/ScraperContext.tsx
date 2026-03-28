import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { UpdateJobStatus, AutomatedRun } from '../types';
import { SCRAPER_CONFIG } from '../config';
import { usePortalUpdater, PortalUpdaterState } from '../hooks/usePortalUpdater';
import { findActiveRun, updateRunProgress, completeRun } from '../services/schedulerService';

type DailyExecutionCounts = Record<string, number>;

const PORTAL_SEQUENCE = ['Zonaprop', 'MercadoLibre', 'Argenprop'];

interface ScraperContextType {
  zonaprop: PortalUpdaterState;
  mercadolibre: PortalUpdaterState;
  argenprop: PortalUpdaterState;
  dailyExecutionCounts: DailyExecutionCounts;
  SCRAPER_CONFIG: typeof SCRAPER_CONFIG;
}

const ScraperContext = createContext<ScraperContextType>(null!);

export const useScraper = () => useContext(ScraperContext);

export const ScraperProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // All 3 portals now use Edge Functions (no n8n webhooks)
  const zonaprop = usePortalUpdater({
    portal: 'Zonaprop',
    storagePrefix: '',
  });

  const mercadolibre = usePortalUpdater({
    portal: 'MercadoLibre',
    storagePrefix: 'mercadolibre',
  });

  const argenprop = usePortalUpdater({
    portal: 'Argenprop',
    storagePrefix: 'argenprop',
  });

  const [dailyExecutionCounts, setDailyExecutionCounts] = useState<DailyExecutionCounts>({
    Zonaprop: 0, MercadoLibre: 0, Argenprop: 0,
  });

  // --- Remote Webhook Trigger Listener ---
  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel('remote-triggers-channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'remote_triggers' },
        (payload) => {
          const portal = payload.new.portal;
          console.log(`TRIGGER RECIBIDO: Iniciando actualizador para ${portal}`);

          if (portal === 'Zonaprop') {
            zonaprop.reset();
            setTimeout(() => zonaprop.toggle(true), 1000);
          } else if (portal === 'MercadoLibre') {
            mercadolibre.reset();
            setTimeout(() => mercadolibre.toggle(true), 1000);
          } else if (portal === 'Argenprop') {
            argenprop.reset();
            setTimeout(() => argenprop.toggle(true), 1000);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [zonaprop.reset, zonaprop.toggle, mercadolibre.reset, mercadolibre.toggle, argenprop.reset, argenprop.toggle]);

  // --- Execution counts tracking ---
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const storedDate = localStorage.getItem('dailyExecutionCountsDate');
    if (storedDate === today) {
      const stored = localStorage.getItem('dailyExecutionCounts');
      if (stored) setDailyExecutionCounts(JSON.parse(stored));
    } else {
      const initial = { Zonaprop: 0, MercadoLibre: 0, Argenprop: 0 };
      setDailyExecutionCounts(initial);
      localStorage.setItem('dailyExecutionCounts', JSON.stringify(initial));
      localStorage.setItem('dailyExecutionCountsDate', today);
    }
  }, []);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const counts = {
      Zonaprop: zonaprop.jobs.filter(j => j.status === UpdateJobStatus.Completed).length,
      MercadoLibre: mercadolibre.jobs.filter(j => j.status === UpdateJobStatus.Completed).length,
      Argenprop: argenprop.jobs.filter(j => j.status === UpdateJobStatus.Completed).length,
    };
    setDailyExecutionCounts(counts);
    localStorage.setItem('dailyExecutionCounts', JSON.stringify(counts));
    localStorage.setItem('dailyExecutionCountsDate', today);
  }, [zonaprop.jobs, mercadolibre.jobs, argenprop.jobs]);

  // --- Automated Scheduler Logic ---
  const [currentRun, setCurrentRun] = useState<AutomatedRun | null>(null);
  const isManagingRunRef = useRef(false);

  useEffect(() => {
    const workerInterval = setInterval(async () => {
      if (isManagingRunRef.current) return;
      try {
        isManagingRunRef.current = true;
        const todayStr = new Date().toISOString().split('T')[0];
        const activeRun = await findActiveRun(todayStr);
        if (activeRun) {
          if (!currentRun || currentRun.id !== activeRun.id) setCurrentRun(activeRun);
        } else {
          if (currentRun) setCurrentRun(null);
        }
      } catch (e: any) {
        console.warn("Poller de Scheduler con error de red (ignorado):", e.message);
      } finally {
        isManagingRunRef.current = false;
      }
    }, 30 * 1000);
    return () => clearInterval(workerInterval);
  }, [currentRun]);

  useEffect(() => {
    if (!currentRun || currentRun.status !== 'running') return;
    const lastPortal = currentRun.last_completed_portal;
    const nextPortalIndex = lastPortal ? PORTAL_SEQUENCE.indexOf(lastPortal) + 1 : 0;
    if (nextPortalIndex >= PORTAL_SEQUENCE.length) {
      completeRun(currentRun.id).then(setCurrentRun);
      return;
    }
    const portalToRun = PORTAL_SEQUENCE[nextPortalIndex];
    let updater: PortalUpdaterState;
    switch (portalToRun) {
      case 'Zonaprop': updater = zonaprop; break;
      case 'MercadoLibre': updater = mercadolibre; break;
      case 'Argenprop': updater = argenprop; break;
      default: return;
    }

    const isComplete = updater.jobs.length > 0 && updater.jobs.every(
      j => j.status === UpdateJobStatus.Completed || j.status === UpdateJobStatus.Failed
    );
    if (isComplete) {
      if (updater.isRunning) updater.toggle(false);
      updateRunProgress(currentRun.id, portalToRun).then(setCurrentRun);
    }
  }, [currentRun, zonaprop, mercadolibre, argenprop]);

  return (
    <ScraperContext.Provider value={{
      zonaprop,
      mercadolibre,
      argenprop,
      dailyExecutionCounts,
      SCRAPER_CONFIG,
    }}>
      {children}
    </ScraperContext.Provider>
  );
};
