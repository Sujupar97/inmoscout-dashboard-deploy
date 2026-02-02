import { supabase, isSupabaseConfigured } from '../supabase';
import { AutomatedRun } from '../types';

// Helper to check if an error is a network error
const isNetworkError = (error: any): boolean => {
    const msg = (error?.message || error?.details || '').toLowerCase();
    return (
        msg.includes('failed to fetch') ||
        msg.includes('network request failed') ||
        msg.includes('connection error') ||
        msg.includes('upstream request timeout')
    );
};

// Fetches the status for a specific scheduled run time on a given date.
export const getRunStatus = async (date: string, utcHour: number): Promise<AutomatedRun | null> => {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
      const { data, error } = await supabase
        .from('automated_scraper_runs')
        .select('*')
        .eq('run_date', date)
        .eq('run_time_utc', utcHour)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // No rows found
        
        if (isNetworkError(error)) {
            console.warn('[Scheduler] Network glitch in getRunStatus (suppressed)');
            return null;
        }
        
        console.error('Error fetching run status:', JSON.stringify(error, null, 2));
        return null; // Return null instead of throwing to keep the app alive
      }

      return data as AutomatedRun | null;
  } catch (err: any) {
      if (isNetworkError(err)) return null;
      console.error('Exception in getRunStatus:', err);
      return null;
  }
};

// Creates a new run entry or retrieves the existing one, marking it as 'running'.
export const startOrResumeRun = async (date: string, utcHour: number): Promise<AutomatedRun> => {
    if (!isSupabaseConfigured || !supabase) throw new Error("Supabase not configured");

    try {
        // Try to find an existing run for today at this time.
        const existingRun = await getRunStatus(date, utcHour);
        if (existingRun) {
            // If it exists but wasn't running, mark it as running.
            if (existingRun.status !== 'running') {
                 const { data, error } = await supabase
                    .from('automated_scraper_runs')
                    .update({ status: 'running' })
                    .eq('id', existingRun.id)
                    .select()
                    .single();
                 
                 if (error) throw error;
                 return data as AutomatedRun;
            }
            return existingRun;
        }

        // If no run exists, create a new one.
        const { data, error } = await supabase
            .from('automated_scraper_runs')
            .insert({ run_date: date, run_time_utc: utcHour, status: 'running' })
            .select()
            .single();

        if (error) throw error;
        return data as AutomatedRun;

    } catch (error: any) {
        console.error('Error in startOrResumeRun:', JSON.stringify(error, null, 2));
        throw new Error(`Error starting new run: ${error.message || 'Unknown error'}`);
    }
};

// Finds any run for a given date that is currently in 'running' state.
export const findActiveRun = async (date: string): Promise<AutomatedRun | null> => {
  if (!isSupabaseConfigured || !supabase) return null;

  try {
      const { data, error } = await supabase
        .from('automated_scraper_runs')
        .select('*')
        .eq('run_date', date)
        .eq('status', 'running')
        .order('run_time_utc', { ascending: true }) // Pick the earliest one first
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // No rows found
        
        if (isNetworkError(error)) {
            // Silently fail on network errors for the poller
            return null;
        }

        console.error('Error finding active run:', JSON.stringify(error, null, 2));
        return null;
      }

      return data as AutomatedRun | null;
  } catch (err: any) {
      // Catch hard network crashes (fetch throws)
      if (isNetworkError(err)) {
          return null;
      }
      console.error('Exception in findActiveRun:', err);
      return null;
  }
};

// Updates the progress of a run after a portal has finished.
export const updateRunProgress = async (runId: number, completedPortal: string): Promise<AutomatedRun> => {
    if (!isSupabaseConfigured || !supabase) throw new Error("Supabase not configured");
    
    try {
        const { data, error } = await supabase
            .from('automated_scraper_runs')
            .update({ last_completed_portal: completedPortal })
            .eq('id', runId)
            .select()
            .single();
        
        if (error) throw error;
        return data as AutomatedRun;
    } catch (error: any) {
        console.error('Error updating run progress:', JSON.stringify(error, null, 2));
        throw new Error(`Error updating run progress: ${error.message}`);
    }
};

// Marks a run as fully completed.
export const completeRun = async (runId: number): Promise<AutomatedRun> => {
    if (!isSupabaseConfigured || !supabase) throw new Error("Supabase not configured");
    
    try {
        const { data, error } = await supabase
            .from('automated_scraper_runs')
            .update({ status: 'completed', last_completed_portal: 'Argenprop' }) // Mark final portal
            .eq('id', runId)
            .select()
            .single();

        if (error) throw error;
        return data as AutomatedRun;
    } catch (error: any) {
        console.error('Error completing run:', JSON.stringify(error, null, 2));
        throw new Error(`Error completing run: ${error.message}`);
    }
};