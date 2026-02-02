import { supabase, isSupabaseConfigured } from '../supabase';
import { UserProfile, Role } from '../types';

export const fetchUserProfile = async (userId: string): Promise<UserProfile | null> => {
    if (!isSupabaseConfigured || !supabase) throw new Error("Supabase no está configurado");
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (error) {
        console.error("Error fetching user profile:", error);
        // No lanzar un error si es 'PGRST116' (0 filas), es un caso válido para nuevos usuarios.
        if (error.code !== 'PGRST116') {
            throw error;
        }
        return null;
    }
    return data as UserProfile | null;
};

export const fetchUsers = async (): Promise<UserProfile[]> => {
    if (!isSupabaseConfigured || !supabase) throw new Error("Supabase no está configurado");
    // Esto requiere que RLS esté configurado para que solo SUPER_ADMIN pueda leer la tabla de perfiles.
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) {
        console.error("Error fetching users, check RLS policy on 'profiles' table for SUPER_ADMIN role.", error);
        throw error;
    }

    const sortedData = (data as any[]).sort((a, b) => {
        const roleOrder = { [Role.SUPER_ADMIN]: 0, [Role.ADMIN]: 1, [Role.USER]: 2 };
        return roleOrder[a.role as Role] - roleOrder[b.role as Role];
    });
    return sortedData as UserProfile[];
};

export const inviteUser = async (email: string, password: string, role: Role): Promise<void> => {
    if (!isSupabaseConfigured || !supabase) throw new Error("Supabase no está configurado");
    
    // This securely calls the 'create-user' Edge Function.
    const { error } = await supabase.functions.invoke('create-user', {
        body: { email, password, role },
    });

    if (error) {
        const context = (error as any).context;
        if (context && context.json) {
            const jsonError = await context.json();
            throw new Error(jsonError.error || `Error en la función: ${error.message}. Asegúrate de que la Edge Function 'create-user' esté desplegada.`);
        }
        throw error;
    }
};

export const deleteUser = async (userId: string): Promise<void> => {
    if (!isSupabaseConfigured || !supabase) throw new Error("Supabase no está configurado");
    const { error } = await supabase.functions.invoke('delete-user', {
        body: { userId },
    });
    if (error) {
        const context = (error as any).context;
        if (context && context.json) {
            const jsonError = await context.json();
            throw new Error(jsonError.error || error.message);
        }
        throw error;
    }
};

// FIX: Updated function signature to accept partial updates for both role and email, resolving a type mismatch.
export const updateUser = async (userId: string, updates: Partial<{ email: string; role: Role }>): Promise<void> => {
    if (!isSupabaseConfigured || !supabase) throw new Error("Supabase no está configurado");
    const { error } = await supabase.functions.invoke('update-user', {
        body: { userId, ...updates },
    });
    if (error) {
        const context = (error as any).context;
        if (context && context.json) {
            const jsonError = await context.json();
            throw new Error(jsonError.error || error.message);
        }
        throw error;
    }
};