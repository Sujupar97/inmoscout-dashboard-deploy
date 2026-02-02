import React, { useState } from 'react';
import { supabase } from '../supabase';

const propertyImages = [
  'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=500&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=500&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=500&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=500&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1605146769289-440113cc3d00?w=500&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=500&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1600566753190-17f0e278a096?w=500&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1628744448845-51aa8a122356?w=500&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1448630360428-65456885c650?w=500&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1600585152225-357ea66c7e20?w=500&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1598228723793-52759bba239c?w=500&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=500&auto=format&fit=crop',
];

const BackgroundGrid = () => {
    // Repite las imágenes para asegurar que la cuadrícula se llene en pantallas más grandes
    const allImages = [...propertyImages, ...propertyImages, ...propertyImages, ...propertyImages]; 
    return (
        <div className="absolute inset-0 w-full h-full overflow-hidden z-0">
            <div className="absolute inset-0 grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 p-4 transform -rotate-12 scale-150">
                {allImages.map((src, i) => (
                    <div key={i} className="aspect-[9/16] md:aspect-[3/4] rounded-lg overflow-hidden">
                        <img 
                            src={src} 
                            alt={`Propiedad de fondo ${i+1}`}
                            className="w-full h-full object-cover opacity-10 filter grayscale"
                            loading="lazy"
                        />
                    </div>
                ))}
            </div>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div>
        </div>
    );
};

const InmoScoutLogo = () => (
    <img src="https://storage.googleapis.com/msgsndr/672ygNPnlPDz5UHb9LAN/media/68c8c91e440460923b8c842a.png" alt="InmoScout Logo" className="h-14 sm:h-16 w-auto" />
);

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (!supabase) {
        setError("La configuración de Supabase no está disponible.");
        setLoading(false);
        return;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        switch (signInError.message) {
            case 'Invalid login credentials':
                setError('Credenciales inválidas. Por favor, revisa tu email y contraseña.');
                break;
            case 'Email not confirmed':
                 setError('Email no confirmado. Por favor, revisa tu bandeja de entrada.');
                 break;
            default:
                setError('Ocurrió un error durante el inicio de sesión.');
        }
        return;
      }
    } catch (err) {
        setError('Ocurrió un error inesperado durante el inicio de sesión.');
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4 font-sans antialiased relative overflow-hidden">
      <BackgroundGrid />
      
      <main className="relative z-10 flex flex-col items-center w-full max-w-sm">
        <div className="w-full bg-[#1c1c1e]/80 backdrop-blur-md p-6 sm:p-8 rounded-2xl border border-white/10">
            <div className="flex flex-col items-center mb-8">
                <InmoScoutLogo />
            </div>
            
            <form className="space-y-4" onSubmit={handleLogin}>
                <div>
                    <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email"
                        className="w-full px-4 py-3 bg-[#2c2c2e] border border-transparent rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 transition"
                    />
                </div>

                <div>
                    <input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Contraseña"
                        className="w-full px-4 py-3 bg-[#2c2c2e] border border-transparent rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 transition"
                    />
                </div>
                
                {error && (
                    <div className="text-center bg-red-500/20 border border-red-500/30 text-red-300 p-2.5 rounded-lg">
                        <p className="text-sm font-medium">{error}</p>
                    </div>
                )}

                <div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full mt-2 py-3 px-4 bg-green-500 hover:bg-green-600 text-black font-bold rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                    >
                        {loading ? 'Ingresando...' : 'Ingresar'}
                    </button>
                </div>
            </form>
        </div>

        <div className="mt-6 w-full text-center">
            <div className="bg-[#1c1c1e]/80 backdrop-blur-md p-4 rounded-lg border border-white/10">
                <p className="font-semibold text-sm text-white">¿No tienes una cuenta?</p>
                <p className="text-xs text-slate-400 mt-1">
                    Por favor, contacta a un administrador para obtener acceso.
                </p>
            </div>
        </div>

      </main>
       <footer className="absolute bottom-4 text-center text-slate-500 text-xs z-10">
          <div className="flex justify-center space-x-4">
            <a href="#" className="hover:text-white transition">Términos de Uso</a>
            <a href="#" className="hover:text-white transition">Política de Privacidad</a>
          </div>
          <p className="mt-2">&copy; {new Date().getFullYear()} InmoScout. Todos los derechos reservados.</p>
        </footer>
    </div>
  );
};