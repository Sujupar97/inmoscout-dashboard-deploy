import React from 'react';

const CodeBlock: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <pre className="bg-gray-900 rounded-md p-4 mt-2 overflow-x-auto">
    <code className="font-mono text-sm text-yellow-300">{children}</code>
  </pre>
);

export const SupabaseConfigScreen: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-gray-800 rounded-lg shadow-2xl border border-yellow-500/50 p-8">
        <div className="flex items-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-yellow-400 mr-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h1 className="text-2xl font-bold text-white">Configuración de Supabase Requerida</h1>
        </div>
        <p className="text-gray-300 mb-6">
          Para que la aplicación funcione, necesita conectarse a tu base de datos. Por favor, sigue estos pasos para configurar tus credenciales de Supabase.
        </p>

        <div className="space-y-4 text-gray-200">
          <div className="flex items-start">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500 text-gray-900 font-bold flex items-center justify-center mr-3 mt-1">1</div>
            <div>
              <h2 className="font-semibold">Abre el archivo <code className="bg-gray-900 text-cyan-400 px-2 py-1 rounded">supabase.ts</code></h2>
              <p className="text-sm text-gray-400">Este archivo contiene la configuración de la conexión.</p>
            </div>
          </div>
          <div className="flex items-start">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500 text-gray-900 font-bold flex items-center justify-center mr-3 mt-1">2</div>
            <div>
              <h2 className="font-semibold">Reemplaza los valores de ejemplo</h2>
              <p className="text-[var(--text-secondary)] mb-6">Por favor ingresa la URL y la Anon Key de Supabase. Puedes encontrar estos valores en la configuración de tu proyecto de Supabase (Settings {'>'} API).</p>
              <CodeBlock>
                {`const supabaseUrl = 'YOUR_SUPABASE_URL';\nconst supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY';`}
              </CodeBlock>
            </div>
          </div>
          <div className="flex items-start">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500 text-gray-900 font-bold flex items-center justify-center mr-3 mt-1">3</div>
            <div>
              <h2 className="font-semibold">Guarda el archivo</h2>
              <p className="text-sm text-gray-400">Una vez guardes los cambios, la aplicación debería recargarse y funcionar correctamente.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};