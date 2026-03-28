import React, { useState, useCallback, useTransition } from 'react';
import { isSupabaseConfigured } from './supabase';
import { Property, PropertyStatus, View } from './types';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PropertyProvider, useProperties } from './contexts/PropertyContext';
import { ScraperProvider, useScraper } from './contexts/ScraperContext';
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
import { Login } from './components/Login';
import { SCRAPER_CONFIG, TARGET_ZONES } from './config';

/**
 * Inner app component that uses contexts.
 * Separated from App to allow context consumption.
 */
const AppContent: React.FC = () => {
  const { session, userProfile, isAppLoading, error: authError } = useAuth();
  const {
    properties, totalCount, isLoading: isPropertiesLoading, error: propertiesError,
    filters, setFilters, initialFilters, filterValues,
    page, setPage, pageSize, totalPages,
    sort, setSort,
    activeView, setActiveView,
    selectedProperty, setSelectedProperty,
    handleUpdateStatus, handleBulkUpdate, refresh,
  } = useProperties();
  const scraper = useScraper();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [newOpportunity, setNewOpportunity] = useState<Property | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleViewChange = useCallback((newView: View) => {
    startTransition(() => {
      setActiveView(newView);
    });
  }, [setActiveView]);

  const handleSelectProperty = useCallback((property: Property) => {
    setSelectedProperty(property);
    setNewOpportunity(null);
  }, [setSelectedProperty]);

  const error = authError || propertiesError;

  const renderView = () => {
    switch (activeView) {
      case 'inventory':
      case 'opportunities':
      case 'anomalies':
        return (
          <Dashboard
            properties={properties}
            totalCount={totalCount}
            onSelectProperty={handleSelectProperty}
            filters={filters}
            onFilterChange={setFilters}
            onUpdateStatus={handleUpdateStatus}
            onBulkUpdate={handleBulkUpdate}
            initialFilters={initialFilters}
            activeView={activeView}
            filterValues={filterValues}
            page={page}
            onPageChange={setPage}
            pageSize={pageSize}
            totalPages={totalPages}
            sort={sort}
            onSortChange={setSort}
            isLoading={isPropertiesLoading}
          />
        );
      case 'metrics':
        return <MetricsView />;
      case 'analysis':
        return <ComparativeAnalysisView onSelectProperty={handleSelectProperty} />;
      case 'orchestrator':
        return (
          <ScrapingOrchestratorView
            SCRAPER_CONFIG={SCRAPER_CONFIG}
            TARGET_ZONES={TARGET_ZONES}
            updateJobs={scraper.zonaprop.jobs}
            isUpdaterRunning={scraper.zonaprop.isRunning}
            onToggleUpdater={scraper.zonaprop.toggle}
            onResetUpdater={scraper.zonaprop.reset}
            updaterCountdown={null}
            onManualUpdateTrigger={scraper.zonaprop.manualTrigger}
            mercadolibreUpdateJobs={scraper.mercadolibre.jobs}
            isMercadolibreUpdaterRunning={scraper.mercadolibre.isRunning}
            onToggleMercadolibreUpdater={scraper.mercadolibre.toggle}
            onResetMercadolibreUpdater={scraper.mercadolibre.reset}
            mercadolibreUpdaterCountdown={null}
            onManualMercadolibreUpdateTrigger={scraper.mercadolibre.manualTrigger}
            argenpropUpdateJobs={scraper.argenprop.jobs}
            isArgenpropUpdaterRunning={scraper.argenprop.isRunning}
            onToggleArgenpropUpdater={scraper.argenprop.toggle}
            onResetArgenpropUpdater={scraper.argenprop.reset}
            argenpropUpdaterCountdown={null}
            onManualArgenpropUpdateTrigger={scraper.argenprop.manualTrigger}
            dailyExecutionCounts={scraper.dailyExecutionCounts}
          />
        );
      case 'user_management':
        return <UserManagementView />;
      default:
        return <div className="text-white">Vista no encontrada</div>;
    }
  };

  // Loading states
  if (isAppLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--bg-primary)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--primary-accent)] mx-auto" />
        </div>
      </div>
    );
  }

  if (!session) return <Login />;

  if (!userProfile) {
    return (
      <div className="flex items-center justify-center h-screen bg-[var(--bg-primary)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--primary-accent)] mx-auto" />
          <p className="mt-4 text-lg text-[var(--text-secondary)]">Cargando perfil de usuario...</p>
          {error && <p className="mt-2 text-red-400">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[var(--bg-primary)] text-white font-sans">
      <Sidebar activeView={activeView} setActiveView={handleViewChange} user={userProfile} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      {isSidebarOpen && <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={() => setIsSidebarOpen(false)} />}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header activeView={activeView} onMenuClick={() => setIsSidebarOpen(true)} onRefresh={refresh} />
        <main className={`flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 ${isPending ? 'opacity-70 pointer-events-none' : ''}`}>
          {error ? (
            <div className="text-red-400">Error: {error}</div>
          ) : isPropertiesLoading && properties.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--primary-accent)] mx-auto" />
                <p className="mt-4 text-lg text-[var(--text-secondary)]">Cargando propiedades...</p>
              </div>
            </div>
          ) : (
            renderView()
          )}
        </main>
      </div>
      {selectedProperty && (
        <PropertyDetailModal
          property={selectedProperty}
          onClose={() => setSelectedProperty(null)}
          onUpdateStatus={handleUpdateStatus}
        />
      )}
      <AIChatWidget properties={properties} onSelectProperty={handleSelectProperty} />
      {newOpportunity && (
        <OpportunityToast
          property={newOpportunity}
          onClose={() => setNewOpportunity(null)}
          onView={handleSelectProperty}
        />
      )}
    </div>
  );
};

/**
 * Root App component with context providers.
 * Dramatically simplified from 925 lines to ~170 lines by extracting:
 * - Auth logic → AuthContext
 * - Property data + filtering → PropertyContext (server-side)
 * - Scraper updater logic → ScraperContext + usePortalUpdater hook
 */
export const App: React.FC = () => {
  if (!isSupabaseConfigured) return <SupabaseConfigScreen />;

  return (
    <AuthProvider>
      <AuthConsumer />
    </AuthProvider>
  );
};

/**
 * Intermediate component that reads auth state to conditionally
 * provide property and scraper contexts.
 */
const AuthConsumer: React.FC = () => {
  const { userProfile } = useAuth();

  return (
    <PropertyProvider isAuthenticated={!!userProfile}>
      <ScraperProvider>
        <AppContent />
      </ScraperProvider>
    </PropertyProvider>
  );
};
