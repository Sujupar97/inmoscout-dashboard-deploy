import React, { useState, useEffect, useCallback } from 'react';
import { Owner, OwnerStatus } from '../types';
import { fetchOwners, updateOwner } from '../services/crmService';
import { OwnerCard } from './OwnerCard';
import { AddOwnerModal } from './AddOwnerModal';
import { OwnerDetailModal } from './OwnerDetailModal';

const statuses = Object.values(OwnerStatus);

export const CRMView: React.FC = () => {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedOwner, setSelectedOwner] = useState<Owner | null>(null);
  const [activeStatusTab, setActiveStatusTab] = useState<OwnerStatus>(statuses[0]);

  const loadOwners = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const fetchedOwners = await fetchOwners();
      setOwners(fetchedOwners);
    } catch (err) {
      setError("No se pudieron cargar los datos del CRM.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOwners();
  }, [loadOwners]);

  const handleOwnerAdded = (newOwner: Owner) => {
    setOwners(prev => [newOwner, ...prev]);
    // Switch tab to show the new owner
    if(newOwner.estado !== activeStatusTab) {
      setActiveStatusTab(newOwner.estado);
    }
  };
  
  const handleOwnerUpdated = (updatedOwner: Owner) => {
     setOwners(prev => prev.map(o => o.id === updatedOwner.id ? updatedOwner : o));
  };

  // --- Drag and Drop Handlers (for Desktop) ---
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, ownerId: string) => {
    e.dataTransfer.setData("ownerId", ownerId);
    e.dataTransfer.effectAllowed = "move";
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.classList.add('bg-green-900/30');
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-green-900/30');
  };
  
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, newStatus: OwnerStatus) => {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-green-900/30');
    const ownerId = e.dataTransfer.getData("ownerId");
    
    const ownerToMove = owners.find(o => o.id === ownerId);
    if (!ownerToMove || ownerToMove.estado === newStatus) {
      return; // Do nothing if dropped in the same column or owner not found
    }

    const originalOwners = [...owners];
    
    // Optimistic UI update
    setOwners(prevOwners =>
      prevOwners.map(o =>
        o.id === ownerId ? { ...o, estado: newStatus } : o
      )
    );

    // Persist change to the database
    try {
      await updateOwner(ownerId, { estado: newStatus });
    } catch (err) {
      setError('No se pudo actualizar el estado. Inténtalo de nuevo.');
      console.error(err);
      // Revert UI change on failure
      setOwners(originalOwners);
    }
  };

  if (loading) {
    return <div className="text-center p-8 text-[var(--text-secondary)]">Cargando CRM...</div>;
  }
  if (error) {
    return <div className="text-center p-8 text-red-400">{error}</div>;
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-end items-center mb-4">
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-[var(--primary-accent)] hover:bg-[var(--primary-accent-hover)] text-white font-bold py-2 px-4 rounded-md transition-colors"
        >
          + Añadir Propietario
        </button>
      </div>
      
      {/* Mobile Tabbed View */}
      <div className="md:hidden">
          <div className="border-b border-[var(--border-primary)]">
              <nav className="-mb-px flex space-x-4 overflow-x-auto" aria-label="Tabs">
                  {statuses.map(status => (
                      <button
                          key={status}
                          onClick={() => setActiveStatusTab(status)}
                          className={`${
                              status === activeStatusTab
                                  ? 'border-green-500 text-green-400'
                                  : 'border-transparent text-[var(--text-secondary)] hover:text-white hover:border-gray-500'
                          } whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}
                      >
                          {status} ({owners.filter(o => o.estado === status).length})
                      </button>
                  ))}
              </nav>
          </div>
          <div className="mt-4 space-y-3">
             {owners.filter(o => o.estado === activeStatusTab).map(owner => (
                <OwnerCard 
                  key={owner.id} 
                  owner={owner} 
                  onClick={() => setSelectedOwner(owner)} 
                  isDraggable={false}
                />
              ))}
          </div>
      </div>

      {/* Desktop Kanban View */}
      <div className="hidden md:grid flex-1 grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 overflow-x-auto pb-4">
        {statuses.map(status => (
          <div 
            key={status} 
            className="bg-[var(--bg-secondary)] rounded-lg p-3 h-full transition-colors duration-200 flex flex-col border border-[var(--border-primary)]"
            onDrop={(e) => handleDrop(e, status)}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
          >
            <h3 className="font-semibold text-sm text-[var(--text-primary)] mb-3 px-1 flex-shrink-0">{status}</h3>
            <div className="space-y-3 min-h-[6rem] overflow-y-auto">
              {owners.filter(o => o.estado === status).map(owner => (
                <OwnerCard 
                  key={owner.id} 
                  owner={owner} 
                  onClick={() => setSelectedOwner(owner)} 
                  onDragStart={(e) => handleDragStart(e, owner.id)}
                  isDraggable={true}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      
      {isAddModalOpen && (
        <AddOwnerModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onOwnerAdded={handleOwnerAdded}
        />
      )}
      
      {selectedOwner && (
        <OwnerDetailModal
          owner={selectedOwner}
          onClose={() => setSelectedOwner(null)}
          onOwnerUpdated={handleOwnerUpdated}
        />
      )}
    </div>
  );
};