import React, { createContext, useContext, useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../supabase';
import { UserProfile } from '../types';
import { fetchUserProfile } from '../services/userService';

interface AuthContextType {
  session: Session | null;
  userProfile: UserProfile | null;
  isAppLoading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  userProfile: null,
  isAppLoading: true,
  error: null,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get initial session
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setIsAppLoading(false);
      return;
    }

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

  // Fetch profile when session changes
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

  return (
    <AuthContext.Provider value={{ session, userProfile, isAppLoading, error }}>
      {children}
    </AuthContext.Provider>
  );
};
