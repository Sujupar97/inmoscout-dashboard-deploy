import React, { useState, useEffect, useMemo, useCallback, useRef, useTransition } from 'react';
import { supabase, isSupabaseConfigured } from './supabase';
import { Property, PropertyStatus, Filters, View, UserProfile, UpdateJob, UpdateJobStatus, AutomatedRun } from './types';
import { fetchProperties, updatePropertyStatus, bulkUpdateProperties } from './services/propertyService';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { PropertyDetailModal } from './components/PropertyDetailModal';
import { SupabaseConfigScreen } from './components/SupabaseConfigScreen';
import { AIChatWidget } from './components/AIChatWidget';
import { OpportunityToast } from './components/OpportunityToast';
import { MetricsView } from './components/MetricsView';
import { ComparativeAnalysisView } from './components/ComparativeAnalysisView';
import { ScrapingOrchestratorView } from './components/ScrapingOrchestratorView';
import { UserManagementView } from './components/UserManagementView';
import { SCRAPER_CONFIG, TARGET_ZONES, PROPERTY_TYPES } from './config';
import { buildScraperUrl } from './utils/urlBuilder';
import { Session } from '@supabase/supabase-js';
import { Login } from './components/Login';
import { fetchUserProfile } from './services/userService';
import { findActiveRun, updateRunProgress, completeRun } from './services/schedulerService';

const propertyProcessorWorkerString = `
self.onmessage = function(event) {
    const properties = event.data;
    try {
        const propertiesWithCalculations = properties.map(p => {
            let total_calculated_sqm;
            let calculated_price_per_sqm;

            if ((!p.covered_area || p.covered_area === 0) && p.area && p.area > 0) {
                total_calculated_sqm = p.area;
                calculated_price_per_sqm = p.price / p.area;
            } else {
                const covered = p.covered_area || 0;
                const uncovered = (p.area && p.covered_area && p.area > p.covered_area)
                    ? p.area - p.covered_area
                    : 0;
                total_calculated_sqm = covered + (uncovered * 0.5);
                calculated_price_per_sqm = total_calculated_sqm > 0 ? p.price / total_calculated_sqm : 0;
            }
            
            return { ...p, total_calculated_sqm, calculated_price_per_sqm };
        });
        
        const nonDiscardedProperties = propertiesWithCalculations.filter(p => p.status !== 'Discarded');
        const groupData = new Map();
        for (const p of nonDiscardedProperties) {
            if (p.zona && p.propertyType) {
                const key = \`\${p.zona}|\${p.propertyType}\`;
                if (!groupData.has(key)) {
                    groupData.set(key, []);
                }
                if (p.calculated_price_per_sqm && p.calculated_price_per_sqm > 100) {
                    groupData.get(key).push(p.calculated_price_per_sqm);
                }
            }
        }

        const avgPrices = new Map();
        for (const [key, prices] of groupData.entries()) {
            if (prices.length > 0) {
                const sum = prices.reduce((a, b) => a + b, 0);
                avgPrices.set(key, sum / prices.length);
            }
        }

        const finalProperties = propertiesWithCalculations.map(p => {
            const key = (p.zona && p.propertyType) ? \`\${p.zona}|\${p.propertyType}\` : null;
            const averagePricePerSqm = key ? avgPrices.get(key) : undefined;
            const discountPercentage = (averagePricePerSqm && p.calculated_price_per_sqm && averagePricePerSqm > 0)
                ? ((p.calculated_price_per_sqm - averagePricePerSqm) / averagePricePerSqm) * 100
                : undefined;
            return { ...p, averagePricePerSqm, discountPercentage };
        });

        self.postMessage({ type: 'SUCCESS', payload: finalProperties });
    } catch (e) {
        self.postMessage({ type: 'ERROR', payload: e.toString() });
    }
};
`;

const initialFilters: Filters = {
  location: 'All',
  portal: 'All',
  minPrice: '',
  maxPrice: '',
  minDiscount: '',
  status: 'All',
  minBeds: '',
  maxBeds: '',
  minPricePerSqm: '',
  maxPricePerSqm: '',
  minPricePerTotalSqm: '',
  maxPricePerTotalSqm: '',
  minDaysOnMarket: '',
  maxDaysOnMarket: '',
  minArea: '',
  maxArea: '',
  isPotentialOpportunity: false,
  showOnlyDiscarded: false,
  propertyType: 'All',
  searchUrl: '',
};

type DailyExecutionCounts = {
  [portal: string]: number;
};

const PORTAL_SEQUENCE = ['Zonaprop', 'MercadoLibre', 'Argenprop'];

export const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [allProperties, setAllProperties] = useState<Property[]>([]);
  const [isPropertiesLoading, setIsPropertiesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<View>('metrics');
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [newOpportunity, setNewOpportunity] = useState<Property | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const propertiesLoadedRef = useRef(false);

  const [isPending, startTransition] = useTransition();

  // --- Zonaprop Daily Updater State ---
  const [updateJobs, setUpdateJobs] = useState<UpdateJob[]>([]);
  const [isUpdaterRunning, setIsUpdaterRunning] = useState(false);
  const [updaterCountdown, setUpdaterCountdown] = useState<number | null>(null);
  const updaterLogicIntervalRef = useRef<number | null>(null);
  const uiCountdownIntervalRef = useRef<number | null>(null);

  // --- MercadoLibre Daily Updater State ---
  const [mercadolibreUpdateJobs, setMercadolibreUpdateJobs] = useState<UpdateJob[]>([]);
  const [isMercadolibreUpdaterRunning, setIsMercadolibreUpdaterRunning] = useState(false);
  const [mercadolibreUpdaterCountdown, setMercadolibreUpdaterCountdown] = useState<number | null>(null);
  const mercadolibreUpdaterLogicIntervalRef = useRef<number | null>(null);
  const mercadolibreUiCountdownIntervalRef = useRef<number | null>(null);

  // --- Argenprop Daily Updater State ---
  const [argenpropUpdateJobs, setArgenpropUpdateJobs] = useState<UpdateJob[]>([]);
  const [isArgenpropUpdaterRunning, setIsArgenpropUpdaterRunning] = useState(false);
  const [argenpropUpdaterCountdown, setArgenpropUpdaterCountdown] = useState<number | null>(null);
  const argenpropUpdaterLogicIntervalRef = useRef<number | null>(null);
  const argenpropUiCountdownIntervalRef = useRef<number | null>(null);

  // --- Automated Scheduler State ---
  const [currentRun, setCurrentRun] = useState<AutomatedRun | null>(null);
  const [dailyExecutionCounts, setDailyExecutionCounts] = useState<DailyExecutionCounts>({ Zonaprop: 0, MercadoLibre: 0, Argenprop: 0 });
  const isManagingRunRef = useRef(false);

  // --- Handlers (Memoized for use in remote triggers) ---

  const handleToggleUpdater = useCallback((run: boolean) => {
    setIsUpdaterRunning(run);
    localStorage.setItem('isUpdaterRunning', String(run));
    if (!run) {
      setUpdateJobs(prev => {
        const pausedJobs = prev.map(j => j.status === UpdateJobStatus.Running ? { ...j, status: UpdateJobStatus.Pending, lastRun: undefined } : j);
        localStorage.setItem('dailyUpdateJobs', JSON.stringify(pausedJobs));
        return pausedJobs;
      });
    }
  }, []);

  const handleResetUpdater = useCallback(() => {
    setIsUpdaterRunning(false);
    localStorage.setItem('isUpdaterRunning', 'false');
    const jobs: UpdateJob[] = [];
    if (Array.isArray(PROPERTY_TYPES)) {
      for (const zona of TARGET_ZONES) {
        for (const type of PROPERTY_TYPES) {
          jobs.push({
            id: `update-Zonaprop-${zona}-${type}`,
            portal: 'Zonaprop',
            zona: zona,
            propertyType: type,
            status: UpdateJobStatus.Pending,
          });
        }
      }
    }
    setUpdateJobs(jobs);
    localStorage.setItem('dailyUpdateJobs', JSON.stringify(jobs));
    localStorage.setItem('dailyUpdateJobsDate', new Date().toISOString().split('T')[0]);
  }, []);

  const handleToggleMercadolibreUpdater = useCallback((run: boolean) => {
    setIsMercadolibreUpdaterRunning(run);
    localStorage.setItem('isMercadolibreUpdaterRunning', String(run));
    if (!run) {
      setMercadolibreUpdateJobs(prev => {
        const pausedJobs = prev.map(j => j.status === UpdateJobStatus.Running ? { ...j, status: UpdateJobStatus.Pending, lastRun: undefined } : j);
        localStorage.setItem('mercadolibreDailyUpdateJobs', JSON.stringify(pausedJobs));
        return pausedJobs;
      });
    }
  }, []);

  const handleResetMercadolibreUpdater = useCallback(() => {
    setIsMercadolibreUpdaterRunning(false);
    localStorage.setItem('isMercadolibreUpdaterRunning', 'false');
    const jobs: UpdateJob[] = [];
    if (Array.isArray(PROPERTY_TYPES)) {
      for (const zona of TARGET_ZONES) {
        for (const type of PROPERTY_TYPES) {
          jobs.push({
            id: `update-MercadoLibre-${zona}-${type}`,
            portal: 'MercadoLibre',
            zona: zona,
            propertyType: type,
            status: UpdateJobStatus.Pending,
          });
        }
      }
    }
    setMercadolibreUpdateJobs(jobs);
    localStorage.setItem('mercadolibreDailyUpdateJobs', JSON.stringify(jobs));
    localStorage.setItem('mercadolibreDailyUpdateJobsDate', new Date().toISOString().split('T')[0]);
  }, []);

  const handleToggleArgenpropUpdater = useCallback((run: boolean) => {
    setIsArgenpropUpdaterRunning(run);
    localStorage.setItem('isArgenpropUpdaterRunning', String(run));
    if (!run) {
      setArgenpropUpdateJobs(prev => {
        const pausedJobs = prev.map(j => j.status === UpdateJobStatus.Running ? { ...j, status: UpdateJobStatus.Pending, lastRun: undefined } : j);
        localStorage.setItem('argenpropDailyUpdateJobs', JSON.stringify(pausedJobs));
        return pausedJobs;
      });
    }
  }, []);

  const handleResetArgenpropUpdater = useCallback(() => {
    setIsArgenpropUpdaterRunning(false);
    localStorage.setItem('isArgenpropUpdaterRunning', 'false');
    const jobs: UpdateJob[] = [];
    if (Array.isArray(PROPERTY_TYPES)) {
      for (const zona of TARGET_ZONES) {
        for (const type of PROPERTY_TYPES) {
          jobs.push({
            id: `update-Argenprop-${zona}-${type}`,
            portal: 'Argenprop',
            zona: zona,
            propertyType: type,
            status: UpdateJobStatus.Pending,
          });
        }
      }
    }
    setArgenpropUpdateJobs(jobs);
    localStorage.setItem('argenpropDailyUpdateJobs', JSON.stringify(jobs));
    localStorage.setItem('argenpropDailyUpdateJobsDate', new Date().toISOString().split('T')[0]);
  }, []);

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
          console.log(`WEBHOOK RECIBIDO: Iniciando actualizador para ${portal}`);

          if (portal === 'Zonaprop') {
            handleResetUpdater();
            setTimeout(() => handleToggleUpdater(true), 1000);
          } else if (portal === 'MercadoLibre') {
            handleResetMercadolibreUpdater();
            setTimeout(() => handleToggleMercadolibreUpdater(true), 1000);
          } else if (portal === 'Argenprop') {
            handleResetArgenpropUpdater();
            setTimeout(() => handleToggleArgenpropUpdater(true), 1000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    handleResetUpdater, handleToggleUpdater,
    handleResetMercadolibreUpdater, handleToggleMercadolibreUpdater,
    handleResetArgenpropUpdater, handleToggleArgenpropUpdater
  ]);

  // --- Auth & Profile Handling ---
  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setIsAppLoading(false);
    };
    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const getProfile = async () => {
      if (session?.user) {
        try {
          const profile = await fetchUserProfile(session.user.id);
          setUserProfile(profile);
        } catch (e: any) {
          setError(`No se pudo cargar el perfil de usuario: ${e.message}`);
          setUserProfile(null);
        }
      } else {
        setUserProfile(null);
      }
    };
    getProfile();
  }, [session]);

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);


  const loadProperties = useCallback(async () => {
    setIsPropertiesLoading(true);
    setError(null);
    if (workerRef.current) {
      workerRef.current.terminate();
    }
    try {
      const rawProperties = await fetchProperties();

      if (rawProperties.length === 0) {
        setAllProperties([]);
        setIsPropertiesLoading(false);
        return;
      }

      const blob = new Blob([propertyProcessorWorkerString], { type: 'application/javascript' });
      const worker = new Worker(URL.createObjectURL(blob));
      workerRef.current = worker;

      worker.onmessage = (event) => {
        const { type, payload } = event.data;
        if (type === 'SUCCESS') {
          setAllProperties(payload);
        } else {
          setError(payload);
          setAllProperties([]);
        }
        setIsPropertiesLoading(false);
        worker.terminate();
        workerRef.current = null;
      };

      worker.onerror = (error) => {
        console.error('Error in property processor worker:', error);
        setError(`A worker error occurred: ${error.message}`);
        setAllProperties([]);
        setIsPropertiesLoading(false);
        worker.terminate();
        workerRef.current = null;
      };

      worker.postMessage(rawProperties);
    } catch (e: any) {
      if (e.message && (e.message.includes("Invalid Refresh Token") || e.message.includes("Refresh Token Not Found"))) {
        await supabase.auth.signOut();
        setSession(null);
        return;
      }
      setError(e.message);
      setIsPropertiesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userProfile && !propertiesLoadedRef.current) {
      loadProperties();
      propertiesLoadedRef.current = true;
    }
  }, [userProfile, loadProperties]);

  useEffect(() => {
    setFilters(initialFilters);
  }, [activeView]);

  // --- Zonaprop Daily Updater Logic ---
  const handleManualUpdateTrigger = useCallback((jobId: string) => {
    const job = updateJobs.find(j => j.id === jobId);
    if (!job) return;

    if (window.confirm(`¿Estás seguro de que quieres disparar la ejecución para ${job.zona} - ${job.propertyType} y marcarla como completada?`)) {
      const dailyUpdaterWebhook = 'https://n8n.srv1022992.hstgr.cloud/webhook/72e9ddea-3098-4d2b-b8b1-c3752cd461fa';
      const url = buildScraperUrl(job.portal, job.zona, job.propertyType);

      fetch(dailyUpdaterWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zona: job.zona,
          property_type: job.propertyType,
          portal: job.portal,
          pages: 1,
          url: url,
          jobId: job.id,
        }),
      }).catch(error => {
        console.error(`Manual webhook dispatch failed for job ${job.id}:`, error);
      });

      setUpdateJobs(currentJobs => {
        const newJobsState = currentJobs.map(j =>
          j.id === jobId ? { ...j, status: UpdateJobStatus.Completed } : j
        );
        localStorage.setItem('dailyUpdateJobs', JSON.stringify(newJobsState));
        return newJobsState;
      });
    }
  }, [updateJobs]);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const storedJobs = localStorage.getItem('dailyUpdateJobs');
    const storedDate = localStorage.getItem('dailyUpdateJobsDate');

    if (storedJobs && storedDate === today) {
      setUpdateJobs(JSON.parse(storedJobs));
    } else {
      handleResetUpdater();
    }

    // FIX: Siempre iniciar en false para evitar disparos automáticos al cargar la app.
    setIsUpdaterRunning(false);
    localStorage.setItem('isUpdaterRunning', 'false');
  }, [handleResetUpdater]);

  useEffect(() => {
    if (uiCountdownIntervalRef.current) clearInterval(uiCountdownIntervalRef.current);
    if (!isUpdaterRunning) {
      setUpdaterCountdown(null);
      return;
    }
    const uiTick = () => {
      const runningJobs = updateJobs.filter(j => j.status === UpdateJobStatus.Running);
      if (runningJobs.length > 0 && runningJobs[0].lastRun) {
        const earliestRun = Math.min(...runningJobs.map(j => j.lastRun!));
        const secondsElapsed = Math.floor((Date.now() - earliestRun) / 1000);
        const newCountdown = 90 - secondsElapsed;
        setUpdaterCountdown(Math.max(0, newCountdown));
      } else {
        const isAnyPending = updateJobs.some(j => j.status === UpdateJobStatus.Pending);
        if (isAnyPending) setUpdaterCountdown(90);
        else setUpdaterCountdown(null);
      }
    };
    uiTick();
    uiCountdownIntervalRef.current = window.setInterval(uiTick, 1000);
    return () => { if (uiCountdownIntervalRef.current) clearInterval(uiCountdownIntervalRef.current); };
  }, [isUpdaterRunning, updateJobs]);

  useEffect(() => {
    if (updaterLogicIntervalRef.current) clearInterval(updaterLogicIntervalRef.current);
    if (!isUpdaterRunning) return;
    const BATCH_SIZE = 5;
    const processQueue = () => {
      setUpdateJobs(currentJobs => {
        let newJobsState = [...currentJobs];
        const now = Date.now();
        const runningJobs = newJobsState.filter(j => j.status === UpdateJobStatus.Running);
        runningJobs.forEach(runningJob => {
          if (runningJob.lastRun && (now - runningJob.lastRun) >= 90000) {
            newJobsState = newJobsState.map(j =>
              j.id === runningJob.id ? { ...j, status: UpdateJobStatus.Completed } : j
            );
          }
        });
        const stillRunningCount = newJobsState.filter(j => j.status === UpdateJobStatus.Running).length;
        const availableSlots = BATCH_SIZE - stillRunningCount;
        if (availableSlots > 0) {
          const nextPendingJobs = newJobsState
            .filter(j => j.status === UpdateJobStatus.Pending)
            .slice(0, availableSlots);
          if (nextPendingJobs.length > 0) {
            nextPendingJobs.forEach(jobToStart => {
              const dailyUpdaterWebhook = 'https://n8n.srv1022992.hstgr.cloud/webhook/72e9ddea-3098-4d2b-b8b1-c3752cd461fa';
              const url = buildScraperUrl(jobToStart.portal, jobToStart.zona, jobToStart.propertyType);
              fetch(dailyUpdaterWebhook, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  zona: jobToStart.zona,
                  property_type: jobToStart.propertyType,
                  portal: jobToStart.portal,
                  pages: 1,
                  url: url,
                  jobId: jobToStart.id,
                }),
              }).catch(error => {
                console.error(`Webhook dispatch failed for job ${jobToStart.id}:`, error);
                setUpdateJobs(jobsOnFailure => {
                  const failedState = jobsOnFailure.map(j =>
                    j.id === jobToStart.id ? { ...j, status: UpdateJobStatus.Failed, errorMessage: error.message } : j
                  );
                  localStorage.setItem('dailyUpdateJobs', JSON.stringify(failedState));
                  return failedState;
                });
              });
              newJobsState = newJobsState.map(j =>
                j.id === jobToStart.id ? { ...j, status: UpdateJobStatus.Running, lastRun: now } : j
              );
            });
          } else {
            if (stillRunningCount === 0) {
              setIsUpdaterRunning(false);
              localStorage.setItem('isUpdaterRunning', 'false');
            }
          }
        }
        localStorage.setItem('dailyUpdateJobs', JSON.stringify(newJobsState));
        return newJobsState;
      });
    };
    processQueue();
    updaterLogicIntervalRef.current = window.setInterval(processQueue, 2000);
    return () => { if (updaterLogicIntervalRef.current) clearInterval(updaterLogicIntervalRef.current); };
  }, [isUpdaterRunning]);

  // --- MercadoLibre Daily Updater Logic ---
  const handleManualMercadolibreUpdateTrigger = useCallback((jobId: string) => {
    const job = mercadolibreUpdateJobs.find(j => j.id === jobId);
    if (!job) return;
    if (window.confirm(`¿Estás seguro de que quieres disparar la ejecución para ${job.zona} - ${job.propertyType} y marcarla como completada?`)) {
      const webhookUrl = 'https://n8n.srv1022992.hstgr.cloud/webhook/708a0331-35a2-480b-af9c-fbcb6fae250d';
      const url = buildScraperUrl(job.portal, job.zona, job.propertyType);
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zona: job.zona,
          property_type: job.propertyType,
          portal: job.portal,
          pages: 1,
          url: url,
          jobId: job.id,
        }),
      }).catch(error => { console.error(`Manual webhook dispatch for MercadoLibre job ${job.id} failed:`, error); });
      setMercadolibreUpdateJobs(currentJobs => {
        const newJobsState = currentJobs.map(j => j.id === jobId ? { ...j, status: UpdateJobStatus.Completed } : j);
        localStorage.setItem('mercadolibreDailyUpdateJobs', JSON.stringify(newJobsState));
        return newJobsState;
      });
    }
  }, [mercadolibreUpdateJobs]);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const storedJobs = localStorage.getItem('mercadolibreDailyUpdateJobs');
    const storedDate = localStorage.getItem('mercadolibreDailyUpdateJobsDate');
    if (storedJobs && storedDate === today) {
      setMercadolibreUpdateJobs(JSON.parse(storedJobs));
    } else {
      handleResetMercadolibreUpdater();
    }

    // FIX: Siempre iniciar en false para evitar disparos automáticos.
    setIsMercadolibreUpdaterRunning(false);
    localStorage.setItem('isMercadolibreUpdaterRunning', 'false');
  }, [handleResetMercadolibreUpdater]);

  useEffect(() => {
    if (mercadolibreUiCountdownIntervalRef.current) clearInterval(mercadolibreUiCountdownIntervalRef.current);
    if (!isMercadolibreUpdaterRunning) {
      setMercadolibreUpdaterCountdown(null);
      return;
    }
    const uiTick = () => {
      const runningJobs = mercadolibreUpdateJobs.filter(j => j.status === UpdateJobStatus.Running);
      if (runningJobs.length > 0 && runningJobs[0].lastRun) {
        const earliestRun = Math.min(...runningJobs.map(j => j.lastRun!));
        const secondsElapsed = Math.floor((Date.now() - earliestRun) / 1000);
        const newCountdown = 90 - secondsElapsed;
        setMercadolibreUpdaterCountdown(Math.max(0, newCountdown));
      } else {
        const isAnyPending = mercadolibreUpdateJobs.some(j => j.status === UpdateJobStatus.Pending);
        if (isAnyPending) setMercadolibreUpdaterCountdown(90);
        else setMercadolibreUpdaterCountdown(null);
      }
    };
    uiTick();
    mercadolibreUiCountdownIntervalRef.current = window.setInterval(uiTick, 1000);
    return () => { if (mercadolibreUiCountdownIntervalRef.current) clearInterval(mercadolibreUiCountdownIntervalRef.current); };
  }, [isMercadolibreUpdaterRunning, mercadolibreUpdateJobs]);

  useEffect(() => {
    if (mercadolibreUpdaterLogicIntervalRef.current) clearInterval(mercadolibreUpdaterLogicIntervalRef.current);
    if (!isMercadolibreUpdaterRunning) return;
    const BATCH_SIZE = 5;
    const processQueue = () => {
      setMercadolibreUpdateJobs(currentJobs => {
        let newJobsState = [...currentJobs];
        const now = Date.now();
        const runningJobs = newJobsState.filter(j => j.status === UpdateJobStatus.Running);
        runningJobs.forEach(runningJob => {
          if (runningJob.lastRun && (now - runningJob.lastRun) >= 90000) {
            newJobsState = newJobsState.map(j => j.id === runningJob.id ? { ...j, status: UpdateJobStatus.Completed } : j);
          }
        });
        const stillRunningCount = newJobsState.filter(j => j.status === UpdateJobStatus.Running).length;
        const availableSlots = BATCH_SIZE - stillRunningCount;
        if (availableSlots > 0) {
          const nextPendingJobs = newJobsState.filter(j => j.status === UpdateJobStatus.Pending).slice(0, availableSlots);
          if (nextPendingJobs.length > 0) {
            nextPendingJobs.forEach(jobToStart => {
              const webhookUrl = 'https://n8n.srv1022992.hstgr.cloud/webhook/708a0331-35a2-480b-af9c-fbcb6fae250d';
              const url = buildScraperUrl(jobToStart.portal, jobToStart.zona, jobToStart.propertyType);
              fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ zona: jobToStart.zona, property_type: jobToStart.propertyType, portal: jobToStart.portal, pages: 1, url: url, jobId: jobToStart.id }),
              }).catch(error => {
                console.error(`Webhook dispatch for MercadoLibre job ${jobToStart.id} failed:`, error);
                setMercadolibreUpdateJobs(jobsOnFailure => {
                  const failedState = jobsOnFailure.map(j => j.id === jobToStart.id ? { ...j, status: UpdateJobStatus.Failed, errorMessage: error.message } : j);
                  localStorage.setItem('mercadolibreDailyUpdateJobs', JSON.stringify(failedState));
                  return failedState;
                });
              });
              newJobsState = newJobsState.map(j => j.id === jobToStart.id ? { ...j, status: UpdateJobStatus.Running, lastRun: now } : j);
            });
          } else {
            if (stillRunningCount === 0) { setIsMercadolibreUpdaterRunning(false); localStorage.setItem('isMercadolibreUpdaterRunning', 'false'); }
          }
        }
        localStorage.setItem('mercadolibreDailyUpdateJobs', JSON.stringify(newJobsState));
        return newJobsState;
      });
    };
    processQueue();
    mercadolibreUpdaterLogicIntervalRef.current = window.setInterval(processQueue, 2000);
    return () => { if (mercadolibreUpdaterLogicIntervalRef.current) clearInterval(mercadolibreUpdaterLogicIntervalRef.current); };
  }, [isMercadolibreUpdaterRunning]);

  // --- Argenprop Daily Updater Logic ---
  const handleManualArgenpropUpdateTrigger = useCallback((jobId: string) => {
    const job = argenpropUpdateJobs.find(j => j.id === jobId);
    if (!job) return;
    if (window.confirm(`¿Estás seguro de que quieres disparar la ejecución para ${job.zona} - ${job.propertyType} y marcarla como completada?`)) {
      const webhookUrl = 'https://n8n.srv1022992.hstgr.cloud/webhook/5125f692-bbc2-452c-bc30-176df6f5c4c8';
      const url = buildScraperUrl(job.portal, job.zona, job.propertyType);
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zona: job.zona, property_type: job.propertyType, portal: job.portal, pages: 1, url: url, jobId: job.id }),
      }).catch(error => { console.error(`Manual webhook dispatch for Argenprop job ${job.id} failed:`, error); });
      setArgenpropUpdateJobs(currentJobs => {
        const newJobsState = currentJobs.map(j => j.id === jobId ? { ...j, status: UpdateJobStatus.Completed } : j);
        localStorage.setItem('argenpropDailyUpdateJobs', JSON.stringify(newJobsState));
        return newJobsState;
      });
    }
  }, [argenpropUpdateJobs]);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const storedJobs = localStorage.getItem('argenpropDailyUpdateJobs');
    const storedDate = localStorage.getItem('argenpropDailyUpdateJobsDate');
    if (storedJobs && storedDate === today) {
      setArgenpropUpdateJobs(JSON.parse(storedJobs));
    } else {
      handleResetArgenpropUpdater();
    }

    // FIX: Siempre iniciar en false para evitar disparos automáticos.
    setIsArgenpropUpdaterRunning(false);
    localStorage.setItem('isArgenpropUpdaterRunning', 'false');
  }, [handleResetArgenpropUpdater]);

  useEffect(() => {
    if (argenpropUiCountdownIntervalRef.current) clearInterval(argenpropUiCountdownIntervalRef.current);
    if (!isArgenpropUpdaterRunning) {
      setArgenpropUpdaterCountdown(null);
      return;
    }
    const uiTick = () => {
      const runningJobs = argenpropUpdateJobs.filter(j => j.status === UpdateJobStatus.Running);
      if (runningJobs.length > 0 && runningJobs[0].lastRun) {
        const earliestRun = Math.min(...runningJobs.map(j => j.lastRun!));
        const secondsElapsed = Math.floor((Date.now() - earliestRun) / 1000);
        const newCountdown = 90 - secondsElapsed;
        setArgenpropUpdaterCountdown(Math.max(0, newCountdown));
      } else {
        const isAnyPending = argenpropUpdateJobs.some(j => j.status === UpdateJobStatus.Pending);
        if (isAnyPending) setArgenpropUpdaterCountdown(90);
        else setArgenpropUpdaterCountdown(null);
      }
    };
    uiTick();
    argenpropUiCountdownIntervalRef.current = window.setInterval(uiTick, 1000);
    return () => { if (argenpropUiCountdownIntervalRef.current) clearInterval(argenpropUiCountdownIntervalRef.current); };
  }, [isArgenpropUpdaterRunning, argenpropUpdateJobs]);

  useEffect(() => {
    if (argenpropUpdaterLogicIntervalRef.current) clearInterval(argenpropUpdaterLogicIntervalRef.current);
    if (!isArgenpropUpdaterRunning) return;
    const BATCH_SIZE = 5;
    const processQueue = () => {
      setArgenpropUpdateJobs(currentJobs => {
        let newJobsState = [...currentJobs];
        const now = Date.now();
        const runningJobs = newJobsState.filter(j => j.status === UpdateJobStatus.Running);
        runningJobs.forEach(runningJob => {
          if (runningJob.lastRun && (now - runningJob.lastRun) >= 90000) {
            newJobsState = newJobsState.map(j => j.id === runningJob.id ? { ...j, status: UpdateJobStatus.Completed } : j);
          }
        });
        const stillRunningCount = newJobsState.filter(j => j.status === UpdateJobStatus.Running).length;
        const availableSlots = BATCH_SIZE - stillRunningCount;
        if (availableSlots > 0) {
          const nextPendingJobs = newJobsState.filter(j => j.status === UpdateJobStatus.Pending).slice(0, availableSlots);
          if (nextPendingJobs.length > 0) {
            nextPendingJobs.forEach(jobToStart => {
              const webhookUrl = 'https://n8n.srv1022992.hstgr.cloud/webhook/5125f692-bbc2-452c-bc30-176df6f5c4c8';
              const url = buildScraperUrl(jobToStart.portal, jobToStart.zona, jobToStart.propertyType);
              fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ zona: jobToStart.zona, property_type: jobToStart.propertyType, portal: jobToStart.portal, pages: 1, url: url, jobId: jobToStart.id }),
              }).catch(error => {
                console.error(`Webhook dispatch for Argenprop job ${jobToStart.id} failed:`, error);
                setArgenpropUpdateJobs(jobsOnFailure => {
                  const failedState = jobsOnFailure.map(j => j.id === jobToStart.id ? { ...j, status: UpdateJobStatus.Failed, errorMessage: error.message } : j);
                  localStorage.setItem('argenpropDailyUpdateJobs', JSON.stringify(failedState));
                  return failedState;
                });
              });
              newJobsState = newJobsState.map(j => j.id === jobToStart.id ? { ...j, status: UpdateJobStatus.Running, lastRun: now } : j);
            });
          } else {
            if (stillRunningCount === 0) { setIsArgenpropUpdaterRunning(false); localStorage.setItem('isArgenpropUpdaterRunning', 'false'); }
          }
        }
        localStorage.setItem('argenpropDailyUpdateJobs', JSON.stringify(newJobsState));
        return newJobsState;
      });
    };
    processQueue();
    argenpropUpdaterLogicIntervalRef.current = window.setInterval(processQueue, 2000);
    return () => { if (argenpropUpdaterLogicIntervalRef.current) clearInterval(argenpropUpdaterLogicIntervalRef.current); };
  }, [isArgenpropUpdaterRunning]);

  // --- Automated Scheduler Logic ---
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const storedCountsDate = localStorage.getItem('dailyExecutionCountsDate');
    if (storedCountsDate === today) {
      const storedCounts = localStorage.getItem('dailyExecutionCounts');
      if (storedCounts) setDailyExecutionCounts(JSON.parse(storedCounts));
    } else {
      const initialCounts = { Zonaprop: 0, MercadoLibre: 0, Argenprop: 0 };
      setDailyExecutionCounts(initialCounts);
      localStorage.setItem('dailyExecutionCounts', JSON.stringify(initialCounts));
      localStorage.setItem('dailyExecutionCountsDate', today);
    }
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

  // CRITICAL FIX: Eliminada la dependencia que forzaba el inicio (toggleFn(true)) basado en la tabla Supabase.
  // Ahora el Scheduler solo sirve para completar ejecuciones o actualizar progreso VISUAL,
  // pero NUNCA podrá llamar a toggleFn(true) por sí solo.
  useEffect(() => {
    if (!currentRun || currentRun.status !== 'running') return;
    const lastPortal = currentRun.last_completed_portal;
    const nextPortalIndex = lastPortal ? PORTAL_SEQUENCE.indexOf(lastPortal) + 1 : 0;
    if (nextPortalIndex >= PORTAL_SEQUENCE.length) {
      completeRun(currentRun.id).then(setCurrentRun);
      return;
    }
    const portalToRun = PORTAL_SEQUENCE[nextPortalIndex];
    let jobs: UpdateJob[], toggleFn: (run: boolean) => void, isRunning: boolean;
    switch (portalToRun) {
      case 'Zonaprop': jobs = updateJobs; toggleFn = handleToggleUpdater; isRunning = isUpdaterRunning; break;
      case 'MercadoLibre': jobs = mercadolibreUpdateJobs; toggleFn = handleToggleMercadolibreUpdater; isRunning = isMercadolibreUpdaterRunning; break;
      case 'Argenprop': jobs = argenpropUpdateJobs; toggleFn = handleToggleArgenpropUpdater; isRunning = isArgenpropUpdaterRunning; break;
      default: return;
    }

    // Solo permitimos al scheduler COMPLETAR portales si localmente ya terminaron,
    // pero NO disparar el inicio.
    const isComplete = jobs.length > 0 && jobs.every(j => j.status === UpdateJobStatus.Completed || j.status === UpdateJobStatus.Failed);
    if (isComplete) {
      if (isRunning) toggleFn(false);
      updateRunProgress(currentRun.id, portalToRun).then(setCurrentRun);
    }
  }, [currentRun, updateJobs, mercadolibreUpdateJobs, argenpropUpdateJobs, isUpdaterRunning, isMercadolibreUpdaterRunning, isArgenpropUpdaterRunning, handleToggleUpdater, handleToggleMercadolibreUpdater, handleToggleArgenpropUpdater]);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const counts = {
      Zonaprop: updateJobs.filter(j => j.status === UpdateJobStatus.Completed).length,
      MercadoLibre: mercadolibreUpdateJobs.filter(j => j.status === UpdateJobStatus.Completed).length,
      Argenprop: argenpropUpdateJobs.filter(j => j.status === UpdateJobStatus.Completed).length,
    };
    setDailyExecutionCounts(counts);
    localStorage.setItem('dailyExecutionCounts', JSON.stringify(counts));
    localStorage.setItem('dailyExecutionCountsDate', today);
  }, [updateJobs, mercadolibreUpdateJobs, argenpropUpdateJobs]);

  const handleUpdateStatus = useCallback(async (propertyId: string, status: PropertyStatus) => {
    try {
      await updatePropertyStatus(propertyId, status);
      setAllProperties(prev => prev.map(p => p.id === propertyId ? { ...p, status } : p));
      if (selectedProperty?.id === propertyId) setSelectedProperty(prev => prev ? { ...prev, status } : null);
    } catch (error) { console.error("Failed to update status:", error); }
  }, [selectedProperty]);

  const handleBulkUpdate = useCallback(async (propertyIds: string[], updates: Partial<Pick<Property, 'status' | 'is_potential_opportunity'>>) => {
    try {
      await bulkUpdateProperties(propertyIds, updates);
      setAllProperties(prev => prev.map(p => propertyIds.includes(p.id) ? { ...p, ...updates } : p));
    } catch (error) { console.error("Failed to bulk update properties:", error); }
  }, []);

  const filteredProperties = useMemo(() => {
    if (activeView === 'anomalies') {
      return allProperties.filter(p => p.price === 0 || !p.total_calculated_sqm || p.total_calculated_sqm === 0 || (p.discountPercentage !== undefined && p.discountPercentage >= 300));
    }
    const baseProperties = activeView === 'opportunities'
      ? allProperties.filter(p => p.price > 0 && p.total_calculated_sqm !== undefined && p.total_calculated_sqm !== null && p.total_calculated_sqm > 0 && p.calculated_price_per_sqm !== undefined && p.calculated_price_per_sqm <= 1100 && p.calculated_price_per_sqm >= 290 && p.status !== PropertyStatus.Discarded)
      : allProperties;

    return baseProperties.filter(p => {
      const filter = filters;
      if (filter.searchUrl && !p.link.includes(filter.searchUrl.trim())) return false;
      if (filter.location !== 'All' && p.zona !== filter.location) return false;
      if (filter.portal !== 'All' && p.portal !== filter.portal) return false;
      if (filter.propertyType !== 'All' && p.propertyType !== filter.propertyType) return false;
      if (filter.showOnlyDiscarded) { if (p.status !== PropertyStatus.Discarded) return false; }
      else { if (p.status === PropertyStatus.Discarded) return false; if (filter.status !== 'All' && p.status !== filter.status) return false; }
      if (filter.minPrice && p.price < parseFloat(filter.minPrice)) return false;
      if (filter.maxPrice && p.price > parseFloat(filter.maxPrice)) return false;
      if (filter.minDiscount && (p.discountPercentage === undefined || p.discountPercentage > parseFloat(filter.minDiscount))) return false;
      if (filter.minBeds && (p.bedrooms === null || p.bedrooms < parseInt(filter.minBeds, 10))) return false;
      if (filter.maxBeds && (p.bedrooms === null || p.bedrooms > parseInt(filter.maxBeds, 10))) return false;
      if (filter.minArea && (p.total_calculated_sqm === undefined || p.total_calculated_sqm < parseFloat(filter.minArea))) return false;
      if (filter.maxArea && (p.total_calculated_sqm === undefined || p.total_calculated_sqm > parseFloat(filter.maxArea))) return false;
      if (filter.minPricePerSqm && (p.calculated_price_per_sqm === undefined || p.calculated_price_per_sqm < parseFloat(filter.minPricePerSqm))) return false;
      if (filter.maxPricePerSqm && (p.calculated_price_per_sqm === undefined || p.calculated_price_per_sqm > parseFloat(filter.maxPricePerSqm))) return false;
      if (filter.minDaysOnMarket && (p.days_on_market === null || p.days_on_market < parseInt(filter.minDaysOnMarket, 10))) return false;
      if (filter.maxDaysOnMarket && (p.days_on_market === null || p.days_on_market > parseInt(filter.maxDaysOnMarket, 10))) return false;
      if (filter.isPotentialOpportunity && !p.is_potential_opportunity) return false;
      return true;
    });
  }, [allProperties, filters, activeView]);

  const handleSelectProperty = useCallback((property: Property) => { setSelectedProperty(property); setNewOpportunity(null); }, []);

  const handleViewChange = (newView: View) => { startTransition(() => { setActiveView(newView); }); };

  const renderView = () => {
    switch (activeView) {
      case 'inventory':
      case 'opportunities':
      case 'anomalies':
        return <Dashboard properties={filteredProperties} allProperties={allProperties} onSelectProperty={handleSelectProperty} filters={filters} onFilterChange={setFilters} onUpdateStatus={handleUpdateStatus} onBulkUpdate={handleBulkUpdate} initialFilters={initialFilters} activeView={activeView} />;
      case 'metrics': return <MetricsView properties={allProperties} />;
      case 'analysis': return <ComparativeAnalysisView properties={allProperties} onSelectProperty={handleSelectProperty} />;
      case 'orchestrator':
        return <ScrapingOrchestratorView SCRAPER_CONFIG={SCRAPER_CONFIG} TARGET_ZONES={TARGET_ZONES} updateJobs={updateJobs} isUpdaterRunning={isUpdaterRunning} onToggleUpdater={handleToggleUpdater} onResetUpdater={handleResetUpdater} updaterCountdown={updaterCountdown} onManualUpdateTrigger={handleManualUpdateTrigger} mercadolibreUpdateJobs={mercadolibreUpdateJobs} isMercadolibreUpdaterRunning={isMercadolibreUpdaterRunning} onToggleMercadolibreUpdater={handleToggleMercadolibreUpdater} onResetMercadolibreUpdater={handleResetMercadolibreUpdater} mercadolibreUpdaterCountdown={mercadolibreUpdaterCountdown} onManualMercadolibreUpdateTrigger={handleManualMercadolibreUpdateTrigger} argenpropUpdateJobs={argenpropUpdateJobs} isArgenpropUpdaterRunning={isArgenpropUpdaterRunning} onToggleArgenpropUpdater={handleToggleArgenpropUpdater} onResetArgenpropUpdater={handleResetArgenpropUpdater} argenpropUpdaterCountdown={argenpropUpdaterCountdown} onManualArgenpropUpdateTrigger={handleManualArgenpropUpdateTrigger} dailyExecutionCounts={dailyExecutionCounts} />;
      case 'user_management': return <UserManagementView />;
      default: return <div className="text-white">Vista no encontrada</div>;
    }
  };

  if (!isSupabaseConfigured) return <SupabaseConfigScreen />;
  if (isAppLoading) return (<div className="flex items-center justify-center h-screen bg-[var(--bg-primary)]"> <div className="text-center"> <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--primary-accent)] mx-auto"></div> </div> </div>);
  if (!session) return <Login />;
  if (!userProfile) return (<div className="flex items-center justify-center h-screen bg-[var(--bg-primary)]"> <div className="text-center"> <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--primary-accent)] mx-auto"></div> <p className="mt-4 text-lg text-[var(--text-secondary)]">Cargando perfil de usuario...</p> {error && <p className="mt-2 text-red-400">{error}</p>} </div> </div>);

  return (
    <div className="flex h-screen bg-[var(--bg-primary)] text-white font-sans">
      <Sidebar activeView={activeView} setActiveView={handleViewChange} user={userProfile} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      {isSidebarOpen && <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={() => setIsSidebarOpen(false)}></div>}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header activeView={activeView} onMenuClick={() => setIsSidebarOpen(true)} onRefresh={loadProperties} />
        <main className={`flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 ${isPending ? 'opacity-70 pointer-events-none' : ''}`}>
          {error ? (<div className="text-red-400">Error: {error}</div>) : isPropertiesLoading ? (<div className="flex items-center justify-center h-full"> <div className="text-center"> <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--primary-accent)] mx-auto"></div> <p className="mt-4 text-lg text-[var(--text-secondary)]">Cargando propiedades...</p> </div> </div>) : (renderView())}
        </main>
      </div>
      {selectedProperty && <PropertyDetailModal property={selectedProperty} onClose={() => setSelectedProperty(null)} onUpdateStatus={handleUpdateStatus} />}
      <AIChatWidget properties={filteredProperties} onSelectProperty={handleSelectProperty} />
      {newOpportunity && <OpportunityToast property={newOpportunity} onClose={() => setNewOpportunity(null)} onView={handleSelectProperty} />}
    </div>
  );
};