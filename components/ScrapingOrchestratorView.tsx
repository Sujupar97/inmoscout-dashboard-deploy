import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ScrapingJob, ScrapingJobStatus, UpdateJob, UpdateJobStatus } from '../types';
import { fetchTodaysPropertyCountsByZone } from '../services/propertyService';
import { buildScraperUrl } from '../utils/urlBuilder';
import { PROPERTY_TYPES } from '../config'; // Importar tipos de propiedad
import { PlayIcon } from './icons/PlayIcon';
import { PauseIcon } from './icons/PauseIcon';
import { RetryIcon } from './icons/RetryIcon';
import { ExclamationCircleIcon } from './icons/ExclamationCircleIcon';
import { WifiIcon } from './icons/WifiIcon';
import { CircleStackIcon } from './icons/CircleStackIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { supabase, Database } from '../supabase';
import { RocketIcon } from './icons/RocketIcon';
import { ClockIcon } from './icons/ClockIcon';
import { CheckCircleIcon } from './icons/CheckCircleIcon';

const JOB_TIMEOUT_MS = 4 * 60 * 60 * 1000; // 4 hours
const JOB_COOLDOWN_MS = 1 * 60 * 1000; // 1 minute cooldown to prevent spamming

interface SchedulerConfig {
    portal: string;
    is_active: boolean;
    frequency: number;
    last_run: string | null;
    last_cycle_start: string | null;
}

interface ScrapingOrchestratorViewProps {
    SCRAPER_CONFIG: { name: string; webhook?: string }[];
    TARGET_ZONES: string[];

    // Zonaprop Props
    updateJobs: UpdateJob[];
    isUpdaterRunning: boolean;
    onToggleUpdater: (isRunning: boolean) => void;
    onResetUpdater: () => void;
    updaterCountdown: number | null;
    onManualUpdateTrigger: (jobId: string) => void;

    // MercadoLibre Props
    mercadolibreUpdateJobs: UpdateJob[];
    isMercadolibreUpdaterRunning: boolean;
    onToggleMercadolibreUpdater: (isRunning: boolean) => void;
    onResetMercadolibreUpdater: () => void;
    mercadolibreUpdaterCountdown: number | null;
    onManualMercadolibreUpdateTrigger: (jobId: string) => void;

    // Argenprop Props
    argenpropUpdateJobs: UpdateJob[];
    isArgenpropUpdaterRunning: boolean;
    onToggleArgenpropUpdater: (isRunning: boolean) => void;
    onResetArgenpropUpdater: () => void;
    argenpropUpdaterCountdown: number | null;
    onManualArgenpropUpdateTrigger: (jobId: string) => void;

    dailyExecutionCounts: { [portal: string]: number };
}

const StatCard: React.FC<{ title: string; value: string | number; color: string }> = ({ title, value, color }) => (
    <div className="bg-[var(--bg-secondary)] p-4 rounded-lg border border-[var(--border-primary)]">
        <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wider font-semibold">{title}</p>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
);

const inputBaseClasses = "w-full bg-[var(--bg-tertiary)] border-[var(--border-primary)] rounded-md shadow-sm py-2 px-3 text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-accent)] focus:border-[var(--primary-accent)] sm:text-sm";
const selectBaseClasses = "appearance-none w-full bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-md shadow-sm py-2 px-3 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-accent)] focus:border-[var(--primary-accent)] sm:text-sm";


export const ScrapingOrchestratorView: React.FC<ScrapingOrchestratorViewProps> = ({
    SCRAPER_CONFIG,
    TARGET_ZONES,
    updateJobs,
    isUpdaterRunning,
    onToggleUpdater,
    onResetUpdater,
    updaterCountdown,
    onManualUpdateTrigger,
    mercadolibreUpdateJobs,
    isMercadolibreUpdaterRunning,
    onToggleMercadolibreUpdater,
    onResetMercadolibreUpdater,
    mercadolibreUpdaterCountdown,
    onManualMercadolibreUpdateTrigger,
    argenpropUpdateJobs,
    isArgenpropUpdaterRunning,
    onToggleArgenpropUpdater,
    onResetArgenpropUpdater,
    argenpropUpdaterCountdown,
    onManualArgenpropUpdateTrigger,
    dailyExecutionCounts
}) => {
    // --- State for Automated Orchestrator ---
    const [jobs, setJobs] = useState<ScrapingJob[]>([]);
    const [isLoadingJobs, setIsLoadingJobs] = useState(true);
    const [isOrchestratorPaused, setIsOrchestratorPaused] = useState(true);
    const [todaysCounts, setTodaysCounts] = useState<Map<string, number>>(new Map());
    const [lastRunTimestamps, setLastRunTimestamps] = useState<Map<string, number>>(new Map());

    // --- State for Manual Trigger ---
    const [manualPortal, setManualPortal] = useState(SCRAPER_CONFIG[0]?.name || '');
    const [manualWebhook, setManualWebhook] = useState(SCRAPER_CONFIG[0]?.webhook || '');
    const [manualZone, setManualZone] = useState(TARGET_ZONES[0] || '');
    const [manualType, setManualType] = useState(PROPERTY_TYPES[0] || '');
    const [isManualLoading, setIsManualLoading] = useState(false);
    const [manualFeedback, setManualFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    // --- Scheduler Config State ---
    const [schedulerConfigs, setSchedulerConfigs] = useState<SchedulerConfig[]>([]);
    const [isSchedulerLoading, setIsSchedulerLoading] = useState(true);

    useEffect(() => {
        if (!supabase) return;

        const fetchSchedulerConfig = async () => {
            const { data, error } = await supabase
                .from('scheduler_config')
                .select('*')
                .order('portal');

            if (data) setSchedulerConfigs(data);
            setIsSchedulerLoading(false);
        };

        fetchSchedulerConfig();

        // Realtime subscription for config changes
        const channel = supabase.channel('scheduler_config_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'scheduler_config' }, (payload) => {
                fetchSchedulerConfig();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const toggleAutomation = async (portal: string, currentState: boolean) => {
        if (!supabase) return;
        await supabase
            .from('scheduler_config')
            .update({ is_active: !currentState })
            .eq('portal', portal);
    };

    const updateFrequency = async (portal: string, frequency: number) => {
        if (!supabase) return;
        await supabase
            .from('scheduler_config')
            .update({ frequency })
            .eq('portal', portal);
    };

    const triggerAutomationNow = async () => {
        if (!window.confirm("¿Ejecutar el sistema automatizado ahora? Esto disparará los scrapers activos inmediatamente.")) return;

        try {
            const { data, error } = await supabase.functions.invoke('trigger-scrapers', {
                body: { manualTrigger: true }
            });

            if (error) throw error;
            alert(`Ejecución iniciada: ${JSON.stringify(data)}`);
        } catch (e: any) {
            alert(`Error al ejecutar: ${e.message}`);
        }
    };

    // --- Daily Updater Logic ---
    const updaterStats = useMemo(() => {
        const completed = updateJobs.filter(j => j.status === UpdateJobStatus.Completed).length;
        const failed = updateJobs.filter(j => j.status === UpdateJobStatus.Failed).length;
        const total = updateJobs.length;
        return { completed, failed, total };
    }, [updateJobs]);

    const mercadolibreUpdaterStats = useMemo(() => {
        const completed = mercadolibreUpdateJobs.filter(j => j.status === UpdateJobStatus.Completed).length;
        const failed = mercadolibreUpdateJobs.filter(j => j.status === UpdateJobStatus.Failed).length;
        const total = mercadolibreUpdateJobs.length;
        return { completed, failed, total };
    }, [mercadolibreUpdateJobs]);

    const argenpropUpdaterStats = useMemo(() => {
        const completed = argenpropUpdateJobs.filter(j => j.status === UpdateJobStatus.Completed).length;
        const failed = argenpropUpdateJobs.filter(j => j.status === UpdateJobStatus.Failed).length;
        const total = argenpropUpdateJobs.length;
        return { completed, failed, total };
    }, [argenpropUpdateJobs]);

    const formatCountdown = (seconds: number | null): string => {
        if (seconds === null) return '00:00';
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
    };


    // --- Existing Orchestrator Logic ---
    useEffect(() => {
        const selectedScraper = SCRAPER_CONFIG.find(s => s.name === manualPortal);
        setManualWebhook(selectedScraper?.webhook || '');
    }, [manualPortal, SCRAPER_CONFIG]);

    useEffect(() => {
        const syncAndLoadJobs = async () => {
            setIsLoadingJobs(true);
            if (!supabase) {
                setManualFeedback({ type: 'error', message: 'Supabase no está configurado.' });
                setIsLoadingJobs(false);
                return;
            };
            const expectedJobs = SCRAPER_CONFIG.flatMap(scraper =>
                TARGET_ZONES.flatMap(zona =>
                    PROPERTY_TYPES.map(type => ({
                        id: `${scraper.name}-${zona}-${type}`,
                        portal: scraper.name,
                        zona: zona,
                        propertyType: type,
                    }))
                )
            );
            const { data: existingJobsData, error: fetchError } = await supabase
                .from('scraping_jobs')
                .select('*');
            if (fetchError) {
                console.error("Error fetching jobs:", fetchError);
                setManualFeedback({ type: 'error', message: 'No se pudieron cargar los trabajos.' });
                setIsLoadingJobs(false);
                return;
            }
            const existingJobsMap = new Map<string, ScrapingJob>();
            // FIX: Cast `existingJobsData` to `any[]` to work around a Supabase client type inference issue causing `job` to be typed as `never`.
            ((existingJobsData as any[]) || []).forEach(job => {
                existingJobsMap.set(job.id, {
                    id: job.id,
                    portal: job.portal,
                    zona: job.zona,
                    propertyType: job.propertyType,
                    status: job.status as ScrapingJobStatus,
                });
            });
            // FIX: Explicitly type the array for new jobs to match the Supabase generated type for insert.
            const newJobsToInsert: Database['public']['Tables']['scraping_jobs']['Insert'][] = [];
            const finalJobs: ScrapingJob[] = expectedJobs.map(expectedJob => {
                const existingJob = existingJobsMap.get(expectedJob.id);
                if (existingJob) {
                    return existingJob;
                } else {
                    const newJob = { ...expectedJob, status: ScrapingJobStatus.Pending };
                    newJobsToInsert.push(newJob);
                    return newJob;
                }
            });
            if (newJobsToInsert.length > 0) {
                // FIX: Cast insert array to 'any' to resolve Supabase client type inference issue where parameter is incorrectly inferred as 'never'.
                const { error: insertError } = await supabase
                    .from('scraping_jobs')
                    .insert(newJobsToInsert as any);

                if (insertError) {
                    console.error("Error inserting new jobs:", insertError);
                    setManualFeedback({ type: 'error', message: 'No se pudieron sincronizar algunos trabajos nuevos.' });
                }
            }
            setJobs(finalJobs);
            setIsLoadingJobs(false);
        };
        syncAndLoadJobs();
    }, [SCRAPER_CONFIG, TARGET_ZONES]);

    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsManualLoading(true);
        setManualFeedback(null);
        try {
            if (!supabase) throw new Error('Supabase not configured');
            const { data, error } = await supabase.functions.invoke('scrape-orchestrator', {
                body: {
                    portal: manualPortal,
                    zona: manualZone,
                    property_type: manualType,
                    pages: 5,
                },
            });
            if (error) throw error;
            setManualFeedback({ type: 'success', message: `Scraping iniciado: run #${data?.run_id}, ${data?.tasks_created} tareas creadas.` });
        } catch (error: any) {
            setManualFeedback({ type: 'error', message: `Error: ${error.message}` });
        } finally {
            setIsManualLoading(false);
        }
    };

    const handleTriggerPortal = async (portalName: string) => {
        if (!window.confirm(`¿Estás seguro de que quieres disparar el scraping para ${portalName}?`)) {
            return;
        }
        if (!supabase) return;

        setManualFeedback({ type: 'success', message: `Iniciando scraping para ${portalName}...` });

        // Set all pending jobs for this portal
        setJobs(prevJobs => prevJobs.map(job => {
            if (job.portal === portalName && job.status !== ScrapingJobStatus.Paused) {
                return { ...job, status: ScrapingJobStatus.Pending, errorMessage: undefined };
            }
            return job;
        }));

        // Trigger scrape-orchestrator Edge Function for each zona+type
        try {
            for (const zona of TARGET_ZONES) {
                for (const type of PROPERTY_TYPES) {
                    await supabase.functions.invoke('scrape-orchestrator', {
                        body: { portal: portalName, zona, property_type: type, pages: 5 },
                    });
                }
            }
            setManualFeedback({ type: 'success', message: `Scraping para ${portalName} iniciado correctamente. Las tareas se procesan automáticamente.` });
        } catch (error: any) {
            setManualFeedback({ type: 'error', message: `Error al iniciar scraping para ${portalName}: ${error.message}` });
        }

        if (isOrchestratorPaused) {
            setIsOrchestratorPaused(false);
        }
    };

    const dispatchJob = useCallback(async (job: ScrapingJob) => {
        if (!supabase) {
            setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: ScrapingJobStatus.Failed, errorMessage: 'Supabase not configured' } : j));
            return;
        }

        setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: ScrapingJobStatus.Running, lastRun: Date.now(), duration: 0, errorMessage: undefined } : j));
        setLastRunTimestamps(prev => new Map(prev).set(job.id, Date.now()));
        try {
            const { error } = await supabase.functions.invoke('scrape-orchestrator', {
                body: {
                    portal: job.portal,
                    zona: job.zona,
                    property_type: job.propertyType,
                    pages: 5,
                },
            });
            if (error) throw error;
        } catch (error: any) {
            console.error(`Error en job ${job.id}:`, error);
            setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: ScrapingJobStatus.Failed, errorMessage: error.message } : j));
        }
    }, []);

    const handleManualJobTrigger = (jobId: string) => {
        const jobToRun = jobs.find(j => j.id === jobId);
        if (!jobToRun) {
            console.error("Job not found:", jobId);
            setManualFeedback({ type: 'error', message: `No se pudo encontrar el job ${jobId}.` });
            return;
        }

        if (window.confirm(`¿Estás seguro de que quieres disparar la ejecución para ${jobToRun.zona} - ${jobToRun.propertyType}?`)) {
            dispatchJob(jobToRun);
        }
    };

    const fetchCounts = useCallback(async () => {
        try {
            const counts = await fetchTodaysPropertyCountsByZone();
            setTodaysCounts(counts);
        } catch (error) {
            console.error("Failed to fetch today's property counts:", error);
        }
    }, []);

    useEffect(() => {
        fetchCounts();
        const interval = setInterval(fetchCounts, 60000);
        return () => clearInterval(interval);
    }, [fetchCounts]);

    useEffect(() => {
        if (!supabase) return;
        const channel = supabase.channel('scraping-jobs-status');
        const subscription = channel
            .on('broadcast', { event: 'job-update' }, ({ payload }) => {
                console.log('Received job update:', payload);
                if (payload && payload.jobId && payload.status) {
                    setJobs(prevJobs => {
                        const jobExists = prevJobs.some(j => j.id === payload.jobId);
                        if (!jobExists) return prevJobs;
                        return prevJobs.map(job => {
                            if (job.id === payload.jobId) {
                                const finalDuration = job.status === ScrapingJobStatus.Running && job.lastRun
                                    ? Math.floor((Date.now() - job.lastRun) / 1000)
                                    : job.duration;
                                return {
                                    ...job,
                                    status: payload.status as ScrapingJobStatus,
                                    errorMessage: payload.errorMessage || undefined,
                                    duration: finalDuration
                                };
                            }
                            return job;
                        });
                    });
                    if (payload.status === ScrapingJobStatus.Completed) {
                        fetchCounts();
                    }
                }
            })
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('Subscribed to real-time scraping job status channel.');
                }
            });
        return () => {
            supabase.removeChannel(subscription);
        };
    }, [fetchCounts]);

    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            setJobs(prevJobs => prevJobs.map(job => {
                if (job.status === ScrapingJobStatus.Running && job.lastRun) {
                    const duration = Math.floor((now - job.lastRun) / 1000);
                    if ((now - job.lastRun) > JOB_TIMEOUT_MS) {
                        return { ...job, status: ScrapingJobStatus.Failed, errorMessage: 'Timeout: El job excedió el tiempo límite.' };
                    }
                    return { ...job, duration };
                }
                return job;
            }));
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (isOrchestratorPaused) return;
        const runningJobsCount = jobs.filter(j => j.status === ScrapingJobStatus.Running).length;
        if (runningJobsCount > 0) return;
        const now = Date.now();
        const nextJob = jobs.find(j => j.status === ScrapingJobStatus.Pending && (now - (lastRunTimestamps.get(j.id) || 0)) > JOB_COOLDOWN_MS);
        if (nextJob) {
            dispatchJob(nextJob);
        }
    }, [jobs, isOrchestratorPaused, lastRunTimestamps, dispatchJob]);

    const handleJobStatusChange = async (jobId: string, newStatus: ScrapingJobStatus) => {
        const originalJobs = [...jobs];
        setJobs(prevJobs => prevJobs.map(job =>
            job.id === jobId
                ? { ...job, status: newStatus, errorMessage: newStatus !== ScrapingJobStatus.Failed ? undefined : job.errorMessage }
                : job
        ));
        if (!supabase) {
            setManualFeedback({ type: 'error', message: 'Supabase no está configurado.' });
            return;
        }
        // FIX: Resolved Supabase client type inference issue by removing the cast to 'any'.
        const updateData: Database['public']['Tables']['scraping_jobs']['Update'] = { status: newStatus, updated_at: new Date().toISOString() };
        const { error } = await supabase
            .from('scraping_jobs')
            .update(updateData)
            .eq('id', jobId);
        if (error) {
            console.error("Failed to update job status in DB:", error);
            setJobs(originalJobs);
            setManualFeedback({ type: 'error', message: `No se pudo guardar el estado para el job ${jobId}.` });
        }
    };

    const handleRetryFailed = () => {
        if (window.confirm("¿Estás seguro de que quieres reintentar todos los trabajos fallidos?")) {
            setJobs(prevJobs => prevJobs.map(job =>
                job.status === ScrapingJobStatus.Failed
                    ? { ...job, status: ScrapingJobStatus.Pending, errorMessage: undefined }
                    : job
            ));
        }
    };

    const formatDuration = (seconds?: number) => {
        if (seconds === undefined || seconds === null) return '-';
        const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const s = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    };

    const stats = useMemo(() => ({
        running: jobs.filter(j => j.status === ScrapingJobStatus.Running).length,
        pending: jobs.filter(j => j.status === ScrapingJobStatus.Pending).length,
        failed: jobs.filter(j => j.status === ScrapingJobStatus.Failed).length,
        completed: jobs.filter(j => j.status === ScrapingJobStatus.Completed).length,
    }), [jobs]);

    const jobsByPortal = useMemo(() => {
        return jobs.reduce((acc, job) => {
            if (!acc[job.portal]) {
                acc[job.portal] = [];
            }
            acc[job.portal].push(job);
            return acc;
        }, {} as Record<string, ScrapingJob[]>);
    }, [jobs]);

    return (
        <div className="space-y-6">
            {/* Automation Configuration Panel */}
            <div className="bg-[var(--bg-secondary)] p-4 sm:p-6 rounded-lg border border-[var(--border-primary)]">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h2 className="text-xl font-bold text-[var(--text-primary)]">Configuración de Automatización</h2>
                        <p className="text-sm text-[var(--text-secondary)]">Gestiona la ejecución automática de los scrapers.</p>
                    </div>
                    <button
                        onClick={triggerAutomationNow}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md transition-colors flex items-center shadow-lg"
                    >
                        <RocketIcon className="h-5 w-5 mr-2" />
                        Ejecutar Ahora
                    </button>
                </div>

                {isSchedulerLoading ? (
                    <div className="text-center py-4 text-[var(--text-secondary)]">Cargando configuración...</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {schedulerConfigs.map(config => (
                            <div key={config.portal} className={`p-4 rounded-lg border ${config.is_active ? 'border-green-500/50 bg-green-500/5' : 'border-[var(--border-primary)] bg-[var(--bg-primary)]'}`}>
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="font-bold text-[var(--text-primary)]">{config.portal}</h3>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={config.is_active}
                                            onChange={() => toggleAutomation(config.portal, config.is_active)}
                                        />
                                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                                    </label>
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs text-[var(--text-secondary)] uppercase font-semibold">Frecuencia (veces al día)</label>
                                        <select
                                            value={config.frequency}
                                            onChange={(e) => updateFrequency(config.portal, parseInt(e.target.value))}
                                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-600 bg-[var(--bg-tertiary)] text-white focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm rounded-md"
                                        >
                                            {[1, 2, 3, 4, 6, 8, 12, 24].map(n => (
                                                <option key={n} value={n}>{n} veces ({24 / n}h)</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="text-xs text-[var(--text-secondary)]">
                                        <div className="flex justify-between">
                                            <span>Última ejecución:</span>
                                            <span className="text-[var(--text-primary)]">{config.last_job_run ? new Date(config.last_job_run).toLocaleTimeString() : '-'}</span>
                                        </div>
                                        <div className="flex justify-between mt-1">
                                            <span>Ciclo actual:</span>
                                            <span className="text-[var(--text-primary)]">{config.last_cycle_start ? new Date(config.last_cycle_start).toLocaleDateString() : '-'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="bg-[var(--bg-secondary)] p-4 sm:p-6 rounded-lg border border-[var(--border-primary)]">
                <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Estado de Ejecuciones Diarias</h2>
                <p className="text-sm text-[var(--text-secondary)] mb-4">Resumen de los trabajos de actualización completados hoy. Se reinicia cada día.</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-[var(--bg-primary)] p-4 rounded-lg text-center">
                        <p className="text-sm font-semibold text-[var(--text-secondary)]">Zonaprop</p>
                        <p className="text-3xl font-bold text-[var(--primary-accent-text)] mt-1">{dailyExecutionCounts.Zonaprop || 0} / 45</p>
                    </div>
                    <div className="bg-[var(--bg-primary)] p-4 rounded-lg text-center">
                        <p className="text-sm font-semibold text-[var(--text-secondary)]">MercadoLibre</p>
                        <p className="text-3xl font-bold text-[var(--primary-accent-text)] mt-1">{dailyExecutionCounts.MercadoLibre || 0} / 45</p>
                    </div>
                    <div className="bg-[var(--bg-primary)] p-4 rounded-lg text-center">
                        <p className="text-sm font-semibold text-[var(--text-secondary)]">Argenprop</p>
                        <p className="text-3xl font-bold text-[var(--primary-accent-text)] mt-1">{dailyExecutionCounts.Argenprop || 0} / 45</p>
                    </div>
                </div>
            </div>

            <div className="bg-[var(--bg-secondary)] p-4 sm:p-6 rounded-lg border border-[var(--border-primary)]">
                <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Panel de Ejecución Manual</h2>
                <p className="text-sm text-[var(--text-secondary)] mb-4">Dispara un scraper individual para pruebas o para obtener datos específicos de inmediato.</p>
                <form onSubmit={handleManualSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Portal</label>
                            <div className="relative">
                                <select value={manualPortal} onChange={(e) => setManualPortal(e.target.value)} className={selectBaseClasses}>
                                    {SCRAPER_CONFIG.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                                </select>
                                <ChevronDownIcon className="h-5 w-5 text-[var(--text-tertiary)] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Webhook (Editable)</label>
                            <input type="url" value={manualWebhook} onChange={(e) => setManualWebhook(e.target.value)} className={inputBaseClasses} placeholder="https://..." required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Zona</label>
                            <div className="relative">
                                <select value={manualZone} onChange={(e) => setManualZone(e.target.value)} className={selectBaseClasses}>
                                    {TARGET_ZONES.map(z => <option key={z} value={z}>{z}</option>)}
                                </select>
                                <ChevronDownIcon className="h-5 w-5 text-[var(--text-tertiary)] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Tipo de Propiedad</label>
                            <div className="relative">
                                <select value={manualType} onChange={(e) => setManualType(e.target.value)} className={selectBaseClasses}>
                                    {PROPERTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <ChevronDownIcon className="h-5 w-5 text-[var(--text-tertiary)] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center justify-between pt-2">
                        <div className="flex-1">
                            {manualFeedback && (
                                <p className={`text-sm ${manualFeedback.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>{manualFeedback.message}</p>
                            )}
                        </div>
                        <button type="submit" disabled={isManualLoading} className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-md transition-colors flex items-center justify-center disabled:opacity-50">
                            <RocketIcon className="h-5 w-5 mr-2" />
                            {isManualLoading ? 'Ejecutando...' : 'Ejecutar Prueba'}
                        </button>
                    </div>
                </form>
            </div>

            <details className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] overflow-hidden" open>
                <summary className="p-4 cursor-pointer hover:bg-[var(--bg-tertiary)] flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-bold text-[var(--text-primary)]">Actualizador Diario - Zonaprop</h2>
                    </div>
                    <ChevronDownIcon className="h-5 w-5 transition-transform transform details-open:rotate-180" />
                </summary>
                <div className="p-4 border-t border-[var(--border-primary)] space-y-4">
                    <p className="text-sm text-[var(--text-secondary)]">
                        Este sistema actualiza las propiedades diariamente para mantener los datos frescos. Dispara un job para Zonaprop (todos los barrios y tipos) cada 90 segundos hasta completar.
                    </p>
                    <div className="bg-[var(--bg-primary)] p-4 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-center sm:text-left">
                            <p className="font-bold text-lg text-[var(--text-primary)]">Progreso de Hoy</p>
                            <p className="text-sm text-[var(--text-secondary)]">{updaterStats.completed} de {updaterStats.total} completados ({updaterStats.failed} fallidos)</p>
                        </div>

                        {isUpdaterRunning && updaterCountdown !== null && (
                            <div className="flex flex-col items-center border-y-2 border-dashed border-[var(--border-primary)] py-2 px-6 text-center">
                                <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wider flex items-center">
                                    <ClockIcon className="h-4 w-4 mr-2" />
                                    Próxima ejecución
                                </p>
                                <p className="text-4xl font-mono font-bold text-[var(--primary-accent-text)] tracking-wider">
                                    {formatCountdown(updaterCountdown)}
                                </p>
                            </div>
                        )}

                        <div className="flex items-center space-x-2">
                            <button onClick={onResetUpdater} disabled={isUpdaterRunning} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-md text-sm transition-colors flex items-center disabled:opacity-50">
                                <RetryIcon className="h-4 w-4 mr-2" />
                                Reiniciar
                            </button>
                            <button onClick={() => onToggleUpdater(!isUpdaterRunning)} className={`w-36 font-bold py-2 px-4 rounded-md transition-colors flex items-center justify-center ${isUpdaterRunning ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}`}>
                                {isUpdaterRunning ? <><PauseIcon className="h-5 w-5 mr-2" /> Pausar</> : <><PlayIcon className="h-5 w-5 mr-2" /> Iniciar</>}
                            </button>
                        </div>
                    </div>
                    <div className="overflow-auto border border-[var(--border-primary)] rounded-lg max-h-96">
                        <table className="min-w-full divide-y divide-[var(--border-primary)]">
                            <thead className="bg-[var(--bg-tertiary)]/50 sticky top-0">
                                <tr>
                                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-[var(--text-secondary)] uppercase">Zona</th>
                                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-[var(--text-secondary)] uppercase">Tipo</th>
                                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-[var(--text-secondary)] uppercase">Estado</th>
                                    <th scope="col" className="px-4 py-2 text-center text-xs font-medium text-[var(--text-secondary)] uppercase">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-primary)]">
                                {updateJobs.map(job => {
                                    const statusColors: Record<UpdateJobStatus, string> = {
                                        [UpdateJobStatus.Pending]: "text-[var(--text-tertiary)]",
                                        [UpdateJobStatus.Running]: "text-yellow-400 animate-pulse",
                                        [UpdateJobStatus.Completed]: "text-green-400",
                                        [UpdateJobStatus.Failed]: "text-red-400",
                                    };
                                    return (
                                        <tr key={job.id}>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-[var(--text-primary)]">{job.zona}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-[var(--text-secondary)]">{job.propertyType}</td>
                                            <td className={`px-4 py-2 whitespace-nowrap text-sm font-semibold flex items-center ${statusColors[job.status]}`}>
                                                {job.status}
                                                {job.status === UpdateJobStatus.Failed && job.errorMessage && (
                                                    <div className="relative group ml-2">
                                                        <ExclamationCircleIcon className="h-4 w-4 text-red-400" />
                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-black text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-gray-600 shadow-lg">{job.errorMessage}</div>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-2 whitespace-nowrap text-center">
                                                <button
                                                    onClick={() => onManualUpdateTrigger(job.id)}
                                                    disabled={job.status === UpdateJobStatus.Running || job.status === UpdateJobStatus.Completed}
                                                    className="p-1.5 rounded-md hover:bg-[var(--bg-primary)] text-green-400 disabled:text-gray-600 disabled:cursor-not-allowed"
                                                    title="Disparar y marcar como completado"
                                                >
                                                    <RocketIcon className="h-4 w-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </details>

            <details className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] overflow-hidden">
                <summary className="p-4 cursor-pointer hover:bg-[var(--bg-tertiary)] flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-bold text-[var(--text-primary)]">Actualizador Diario - MercadoLibre</h2>
                    </div>
                    <ChevronDownIcon className="h-5 w-5 transition-transform transform details-open:rotate-180" />
                </summary>
                <div className="p-4 border-t border-[var(--border-primary)] space-y-4">
                    <p className="text-sm text-[var(--text-secondary)]">
                        Este sistema actualiza las propiedades de MercadoLibre diariamente. Dispara un job cada 90 segundos.
                    </p>
                    <div className="bg-[var(--bg-primary)] p-4 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-center sm:text-left">
                            <p className="font-bold text-lg text-[var(--text-primary)]">Progreso de Hoy</p>
                            <p className="text-sm text-[var(--text-secondary)]">{mercadolibreUpdaterStats.completed} de {mercadolibreUpdaterStats.total} completados ({mercadolibreUpdaterStats.failed} fallidos)</p>
                        </div>

                        {isMercadolibreUpdaterRunning && (
                            <div className="flex flex-col items-center border-y-2 border-dashed border-[var(--border-primary)] py-2 px-6 text-center">
                                <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wider flex items-center">
                                    <ClockIcon className="h-4 w-4 mr-2" />
                                    Próxima ejecución
                                </p>
                                <p className="text-4xl font-mono font-bold text-[var(--primary-accent-text)] tracking-wider">
                                    {formatCountdown(mercadolibreUpdaterCountdown)}
                                </p>
                            </div>
                        )}

                        <div className="flex items-center space-x-2">
                            <button onClick={onResetMercadolibreUpdater} disabled={isMercadolibreUpdaterRunning} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-md text-sm transition-colors flex items-center disabled:opacity-50">
                                <RetryIcon className="h-4 w-4 mr-2" />
                                Reiniciar
                            </button>
                            <button onClick={() => onToggleMercadolibreUpdater(!isMercadolibreUpdaterRunning)} className={`w-36 font-bold py-2 px-4 rounded-md transition-colors flex items-center justify-center ${isMercadolibreUpdaterRunning ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}`}>
                                {isMercadolibreUpdaterRunning ? <><PauseIcon className="h-5 w-5 mr-2" /> Pausar</> : <><PlayIcon className="h-5 w-5 mr-2" /> Iniciar</>}
                            </button>
                        </div>
                    </div>
                    <div className="overflow-auto border border-[var(--border-primary)] rounded-lg max-h-96">
                        <table className="min-w-full divide-y divide-[var(--border-primary)]">
                            <thead className="bg-[var(--bg-tertiary)]/50 sticky top-0">
                                <tr>
                                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-[var(--text-secondary)] uppercase">Zona</th>
                                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-[var(--text-secondary)] uppercase">Tipo</th>
                                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-[var(--text-secondary)] uppercase">Estado</th>
                                    <th scope="col" className="px-4 py-2 text-center text-xs font-medium text-[var(--text-secondary)] uppercase">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-primary)]">
                                {mercadolibreUpdateJobs.map(job => {
                                    const statusColors: Record<UpdateJobStatus, string> = {
                                        [UpdateJobStatus.Pending]: "text-[var(--text-tertiary)]",
                                        [UpdateJobStatus.Running]: "text-yellow-400 animate-pulse",
                                        [UpdateJobStatus.Completed]: "text-green-400",
                                        [UpdateJobStatus.Failed]: "text-red-400",
                                    };
                                    return (
                                        <tr key={job.id}>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-[var(--text-primary)]">{job.zona}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-[var(--text-secondary)]">{job.propertyType}</td>
                                            <td className={`px-4 py-2 whitespace-nowrap text-sm font-semibold flex items-center ${statusColors[job.status]}`}>
                                                {job.status}
                                                {job.status === UpdateJobStatus.Failed && job.errorMessage && (
                                                    <div className="relative group ml-2">
                                                        <ExclamationCircleIcon className="h-4 w-4 text-red-400" />
                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-black text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-gray-600 shadow-lg">{job.errorMessage}</div>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-2 whitespace-nowrap text-center">
                                                <button
                                                    onClick={() => onManualMercadolibreUpdateTrigger(job.id)}
                                                    disabled={job.status === UpdateJobStatus.Running || job.status === UpdateJobStatus.Completed}
                                                    className="p-1.5 rounded-md hover:bg-[var(--bg-primary)] text-green-400 disabled:text-gray-600 disabled:cursor-not-allowed"
                                                    title="Disparar y marcar como completado"
                                                >
                                                    <RocketIcon className="h-4 w-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </details>

            <details className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] overflow-hidden">
                <summary className="p-4 cursor-pointer hover:bg-[var(--bg-tertiary)] flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-bold text-[var(--text-primary)]">Actualizador Diario - Argenprop</h2>
                    </div>
                    <ChevronDownIcon className="h-5 w-5 transition-transform transform details-open:rotate-180" />
                </summary>
                <div className="p-4 border-t border-[var(--border-primary)] space-y-4">
                    <p className="text-sm text-[var(--text-secondary)]">
                        Este sistema actualiza las propiedades de Argenprop diariamente. Dispara un job cada 90 segundos.
                    </p>
                    <div className="bg-[var(--bg-primary)] p-4 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-center sm:text-left">
                            <p className="font-bold text-lg text-[var(--text-primary)]">Progreso de Hoy</p>
                            <p className="text-sm text-[var(--text-secondary)]">{argenpropUpdaterStats.completed} de {argenpropUpdaterStats.total} completados ({argenpropUpdaterStats.failed} fallidos)</p>
                        </div>

                        {isArgenpropUpdaterRunning && (
                            <div className="flex flex-col items-center border-y-2 border-dashed border-[var(--border-primary)] py-2 px-6 text-center">
                                <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wider flex items-center">
                                    <ClockIcon className="h-4 w-4 mr-2" />
                                    Próxima ejecución
                                </p>
                                <p className="text-4xl font-mono font-bold text-[var(--primary-accent-text)] tracking-wider">
                                    {formatCountdown(argenpropUpdaterCountdown)}
                                </p>
                            </div>
                        )}

                        <div className="flex items-center space-x-2">
                            <button onClick={onResetArgenpropUpdater} disabled={isArgenpropUpdaterRunning} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-md text-sm transition-colors flex items-center disabled:opacity-50">
                                <RetryIcon className="h-4 w-4 mr-2" />
                                Reiniciar
                            </button>
                            <button onClick={() => onToggleArgenpropUpdater(!isArgenpropUpdaterRunning)} className={`w-36 font-bold py-2 px-4 rounded-md transition-colors flex items-center justify-center ${isArgenpropUpdaterRunning ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}`}>
                                {isArgenpropUpdaterRunning ? <><PauseIcon className="h-5 w-5 mr-2" /> Pausar</> : <><PlayIcon className="h-5 w-5 mr-2" /> Iniciar</>}
                            </button>
                        </div>
                    </div>
                    <div className="overflow-auto border border-[var(--border-primary)] rounded-lg max-h-96">
                        <table className="min-w-full divide-y divide-[var(--border-primary)]">
                            <thead className="bg-[var(--bg-tertiary)]/50 sticky top-0">
                                <tr>
                                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-[var(--text-secondary)] uppercase">Zona</th>
                                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-[var(--text-secondary)] uppercase">Tipo</th>
                                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-[var(--text-secondary)] uppercase">Estado</th>
                                    <th scope="col" className="px-4 py-2 text-center text-xs font-medium text-[var(--text-secondary)] uppercase">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border-primary)]">
                                {argenpropUpdateJobs.map(job => {
                                    const statusColors: Record<UpdateJobStatus, string> = {
                                        [UpdateJobStatus.Pending]: "text-[var(--text-tertiary)]",
                                        [UpdateJobStatus.Running]: "text-yellow-400 animate-pulse",
                                        [UpdateJobStatus.Completed]: "text-green-400",
                                        [UpdateJobStatus.Failed]: "text-red-400",
                                    };
                                    return (
                                        <tr key={job.id}>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-[var(--text-primary)]">{job.zona}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-[var(--text-secondary)]">{job.propertyType}</td>
                                            <td className={`px-4 py-2 whitespace-nowrap text-sm font-semibold flex items-center ${statusColors[job.status]}`}>
                                                {job.status}
                                                {job.status === UpdateJobStatus.Failed && job.errorMessage && (
                                                    <div className="relative group ml-2">
                                                        <ExclamationCircleIcon className="h-4 w-4 text-red-400" />
                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-black text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-gray-600 shadow-lg">{job.errorMessage}</div>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-2 whitespace-nowrap text-center">
                                                <button
                                                    onClick={() => onManualArgenpropUpdateTrigger(job.id)}
                                                    disabled={job.status === UpdateJobStatus.Running || job.status === UpdateJobStatus.Completed}
                                                    className="p-1.5 rounded-md hover:bg-[var(--bg-primary)] text-green-400 disabled:text-gray-600 disabled:cursor-not-allowed"
                                                    title="Disparar y marcar como completado"
                                                >
                                                    <RocketIcon className="h-4 w-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </details>

            <h2 className="text-xl font-bold text-[var(--text-primary)] border-t border-[var(--border-primary)] pt-6">Orquestador de Scraping Profundo</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard title="Activos" value={stats.running} color={isOrchestratorPaused ? "text-yellow-400/50" : "text-yellow-400"} />
                <StatCard title="Pendientes" value={stats.pending} color="text-[var(--text-secondary)]" />
                <StatCard title="Fallidos" value={stats.failed} color="text-red-400" />
                <StatCard title="Completados" value={stats.completed} color="text-green-400" />
            </div>

            <div className="bg-[var(--bg-secondary)] p-4 rounded-lg border border-[var(--border-primary)] flex flex-col sm:flex-row items-center justify-between gap-4">
                <button onClick={() => setIsOrchestratorPaused(!isOrchestratorPaused)} className={`w-full sm:w-auto font-bold py-2 px-4 rounded-md transition-colors flex items-center justify-center ${isOrchestratorPaused ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-amber-500 hover:bg-amber-600 text-white'}`}>
                    {isOrchestratorPaused ? <><PlayIcon className="h-5 w-5 mr-2" /> Reanudar Orquestador</> : <><PauseIcon className="h-5 w-5 mr-2" /> Pausar Orquestador</>}
                </button>
                <div className="flex space-x-2">
                    <button onClick={handleRetryFailed} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-md text-sm transition-colors">Reintentar Fallidos</button>
                </div>
            </div>

            <div className="space-y-4">
                {isLoadingJobs ? (
                    <div className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] p-8 text-center">
                        <p className="text-[var(--text-secondary)]">Sincronizando trabajos del orquestador...</p>
                    </div>
                ) : (
                    SCRAPER_CONFIG.map(portalConfig => (
                        <details key={portalConfig.name} className="bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-primary)] overflow-hidden" open>
                            <summary className="p-4 cursor-pointer hover:bg-[var(--bg-tertiary)] flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <h3 className="text-lg font-semibold text-[var(--text-primary)]">{portalConfig.name}</h3>
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            handleTriggerPortal(portalConfig.name);
                                        }}
                                        className="bg-cyan-600/50 hover:bg-cyan-600 text-white text-xs font-bold py-1 px-3 rounded-md transition-colors flex items-center gap-2"
                                        title={`Disparar todos los jobs para ${portalConfig.name}`}
                                    >
                                        <RocketIcon className="h-4 w-4" />
                                        Disparar Portal
                                    </button>
                                </div>
                                <ChevronDownIcon className="h-5 w-5 transition-transform transform details-open:rotate-180" />
                            </summary>
                            <div className="overflow-x-auto border-t border-[var(--border-primary)]">
                                <table className="min-w-full divide-y divide-[var(--border-primary)]">
                                    <thead className="bg-[var(--bg-tertiary)]/50">
                                        <tr>
                                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase">Zona</th>
                                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase">Tipo Prop.</th>
                                            <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-[var(--text-secondary)] uppercase">Prop. Hoy</th>
                                            <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-[var(--text-secondary)] uppercase">Duración</th>
                                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase">Estado</th>
                                            <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-[var(--text-secondary)] uppercase">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--border-primary)]">
                                        {(jobsByPortal[portalConfig.name] || []).map(job => {
                                            const statusColors: Record<ScrapingJobStatus, string> = {
                                                [ScrapingJobStatus.Pending]: "text-[var(--text-tertiary)]",
                                                [ScrapingJobStatus.Running]: "text-yellow-400 animate-pulse",
                                                [ScrapingJobStatus.Completed]: "text-green-400",
                                                [ScrapingJobStatus.Failed]: "text-red-400",
                                                [ScrapingJobStatus.Paused]: "text-blue-400",
                                            };
                                            return (
                                                <tr key={job.id} className="hover:bg-[var(--bg-tertiary)]">
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-[var(--text-primary)]">{job.zona}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-[var(--text-secondary)]">{job.propertyType}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-[var(--text-secondary)] text-right font-mono">{todaysCounts.get(job.zona) || 0}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-[var(--text-secondary)] text-right font-mono">{formatDuration(job.duration)}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold flex items-center">
                                                        <span className={statusColors[job.status]}>{job.status}</span>
                                                        {job.status === ScrapingJobStatus.Failed && job.errorMessage && (
                                                            <div className="relative group ml-2">
                                                                <ExclamationCircleIcon className="h-4 w-4 text-red-400" />
                                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-black text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-gray-600 shadow-lg">{job.errorMessage}</div>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-center">
                                                        <div className="flex items-center justify-center space-x-2">
                                                            <button onClick={() => handleManualJobTrigger(job.id)} className="p-1.5 rounded-md hover:bg-[var(--bg-primary)] disabled:opacity-30 disabled:cursor-not-allowed" title="Ejecutar Manualmente" disabled={job.status === ScrapingJobStatus.Running}>
                                                                <PlayIcon className="h-4 w-4 text-green-400" />
                                                            </button>
                                                            <div className="relative group">
                                                                <select
                                                                    value={job.status}
                                                                    onChange={(e) => handleJobStatusChange(job.id, e.target.value as ScrapingJobStatus)}
                                                                    className="bg-transparent text-transparent appearance-none cursor-pointer p-1.5 rounded-md hover:bg-[var(--bg-primary)] focus:outline-none"
                                                                    title="Cambiar Estado Manualmente"
                                                                >
                                                                    {Object.values(ScrapingJobStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                                                </select>
                                                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                                    <WifiIcon className="h-4 w-4 text-[var(--text-secondary)]" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </details>
                    ))
                )}
            </div>

            <style>{`
                details > summary { list-style: none; }
                details > summary::-webkit-details-marker { display: none; }
                details[open] .details-open\\:rotate-180 { transform: rotate(180deg); }
            `}</style>
        </div>
    );
};