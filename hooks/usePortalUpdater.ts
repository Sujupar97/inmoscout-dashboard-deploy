import { useState, useEffect, useCallback, useRef } from 'react';
import { UpdateJob, UpdateJobStatus } from '../types';
import { TARGET_ZONES, PROPERTY_TYPES, EDGE_FUNCTION_BASE_URL } from '../config';
import { supabase } from '../supabase';

const POLL_INTERVAL_MS = 5_000;  // Poll status every 5 seconds
const PROCESS_INTERVAL_MS = 3_000;  // Process queue every 3 seconds

interface PortalUpdaterConfig {
  portal: string;
  storagePrefix: string;
}

export interface RunProgress {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  skipped: number;
  properties_new: number;
  properties_skipped: number;
  is_complete: boolean;
}

export interface PortalUpdaterState {
  jobs: UpdateJob[];
  isRunning: boolean;
  progress: RunProgress | null;
  toggle: (run: boolean) => void;
  reset: () => void;
  manualTrigger: (jobId: string) => void;
}

async function callEdgeFunction(name: string, body: Record<string, unknown>): Promise<unknown> {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw error;
  return data;
}

export function usePortalUpdater(config: PortalUpdaterConfig): PortalUpdaterState {
  const { portal, storagePrefix } = config;
  const jobsKey = `${storagePrefix}DailyUpdateJobs`;
  const dateKey = `${storagePrefix}DailyUpdateJobsDate`;

  const [jobs, setJobs] = useState<UpdateJob[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<RunProgress | null>(null);
  const processIntervalRef = useRef<number | null>(null);
  const activeRunIdsRef = useRef<Map<string, number>>(new Map());  // jobId -> run_id

  const createJobs = useCallback((): UpdateJob[] => {
    const newJobs: UpdateJob[] = [];
    for (const zona of TARGET_ZONES) {
      for (const type of PROPERTY_TYPES) {
        newJobs.push({
          id: `update-${portal}-${zona}-${type}`,
          portal,
          zona,
          propertyType: type,
          status: UpdateJobStatus.Pending,
        });
      }
    }
    return newJobs;
  }, [portal]);

  const toggle = useCallback((run: boolean) => {
    setIsRunning(run);
    if (!run) {
      setJobs(prev => {
        const paused = prev.map(j =>
          j.status === UpdateJobStatus.Running
            ? { ...j, status: UpdateJobStatus.Pending, lastRun: undefined }
            : j
        );
        localStorage.setItem(jobsKey, JSON.stringify(paused));
        return paused;
      });
      setProgress(null);
    }
  }, [jobsKey]);

  const reset = useCallback(() => {
    setIsRunning(false);
    setProgress(null);
    activeRunIdsRef.current.clear();
    const newJobs = createJobs();
    setJobs(newJobs);
    localStorage.setItem(jobsKey, JSON.stringify(newJobs));
    localStorage.setItem(dateKey, new Date().toISOString().split('T')[0]);
  }, [createJobs, jobsKey, dateKey]);

  const manualTrigger = useCallback(async (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    if (!window.confirm(`¿Estás seguro de que quieres disparar la ejecución para ${job.zona} - ${job.propertyType}?`)) {
      return;
    }

    try {
      const result = await callEdgeFunction('scrape-orchestrator', {
        portal: job.portal,
        zona: job.zona,
        property_type: job.propertyType,
        pages: 1,
      }) as { run_id: number };

      if (result?.run_id) {
        activeRunIdsRef.current.set(jobId, result.run_id);
      }

      setJobs(prev => {
        const updated = prev.map(j =>
          j.id === jobId ? { ...j, status: UpdateJobStatus.Completed, lastRun: Date.now() } : j
        );
        localStorage.setItem(jobsKey, JSON.stringify(updated));
        return updated;
      });
    } catch (error) {
      console.error(`Manual trigger failed for ${jobId}:`, error);
    }
  }, [jobs, jobsKey]);

  // Initialize from localStorage or reset
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const stored = localStorage.getItem(jobsKey);
    const storedDate = localStorage.getItem(dateKey);

    if (stored && storedDate === today) {
      setJobs(JSON.parse(stored));
    } else {
      reset();
    }
    setIsRunning(false);
  }, [reset, jobsKey, dateKey]);

  // Main processing loop: dispatch jobs to Edge Functions
  useEffect(() => {
    if (processIntervalRef.current) clearInterval(processIntervalRef.current);
    if (!isRunning) return;

    const BATCH_SIZE = 3;  // Process 3 jobs in parallel

    const processQueue = async () => {
      setJobs(currentJobs => {
        let newState = [...currentJobs];
        const now = Date.now();

        // Check running jobs: poll their status
        const runningJobs = newState.filter(j => j.status === UpdateJobStatus.Running);
        for (const rj of runningJobs) {
          const runId = activeRunIdsRef.current.get(rj.id);
          if (runId) {
            // Check status asynchronously (fire and forget, update in next tick)
            callEdgeFunction('scrape-run-status', { run_id: runId })
              .then((statusData) => {
                const status = statusData as RunProgress;
                setProgress(status);
                if (status.is_complete) {
                  setJobs(prev => {
                    const completed = prev.map(j =>
                      j.id === rj.id ? { ...j, status: UpdateJobStatus.Completed } : j
                    );
                    localStorage.setItem(jobsKey, JSON.stringify(completed));
                    return completed;
                  });
                  activeRunIdsRef.current.delete(rj.id);
                }
              })
              .catch(() => { /* ignore polling errors */ });
          } else if (rj.lastRun && (now - rj.lastRun) >= 120_000) {
            // Fallback timeout: if no run_id tracked, mark as completed after 2 min
            newState = newState.map(j =>
              j.id === rj.id ? { ...j, status: UpdateJobStatus.Completed } : j
            );
          }
        }

        // Fill available slots with new jobs
        const stillRunning = newState.filter(j => j.status === UpdateJobStatus.Running).length;
        const slots = BATCH_SIZE - stillRunning;

        if (slots > 0) {
          const pending = newState.filter(j => j.status === UpdateJobStatus.Pending).slice(0, slots);
          if (pending.length > 0) {
            for (const jobToStart of pending) {
              // Call scrape-orchestrator for each job
              callEdgeFunction('scrape-orchestrator', {
                portal: jobToStart.portal,
                zona: jobToStart.zona,
                property_type: jobToStart.propertyType,
                pages: 5,
              })
                .then((result) => {
                  const data = result as { run_id: number };
                  if (data?.run_id) {
                    activeRunIdsRef.current.set(jobToStart.id, data.run_id);
                  }
                })
                .catch(error => {
                  console.error(`Orchestrator call failed for ${jobToStart.id}:`, error);
                  setJobs(prev => {
                    const failed = prev.map(j =>
                      j.id === jobToStart.id ? { ...j, status: UpdateJobStatus.Failed, errorMessage: (error as Error).message } : j
                    );
                    localStorage.setItem(jobsKey, JSON.stringify(failed));
                    return failed;
                  });
                });

              newState = newState.map(j =>
                j.id === jobToStart.id ? { ...j, status: UpdateJobStatus.Running, lastRun: now } : j
              );
            }
          } else if (stillRunning === 0) {
            // All done
            setIsRunning(false);
          }
        }

        localStorage.setItem(jobsKey, JSON.stringify(newState));
        return newState;
      });
    };

    processQueue();
    processIntervalRef.current = window.setInterval(processQueue, PROCESS_INTERVAL_MS);
    return () => { if (processIntervalRef.current) clearInterval(processIntervalRef.current); };
  }, [isRunning, jobsKey]);

  return { jobs, isRunning, progress, toggle, reset, manualTrigger };
}
