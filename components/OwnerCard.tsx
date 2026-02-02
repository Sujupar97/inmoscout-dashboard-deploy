import React from 'react';
import { Owner } from '../types';

interface OwnerCardProps {
  owner: Owner;
  onClick: () => void;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  isDraggable: boolean;
}

export const OwnerCard: React.FC<OwnerCardProps> = ({ owner, onClick, onDragStart, isDraggable }) => {
  const cursorClass = isDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer';

  return (
    <div
      draggable={isDraggable}
      onDragStart={onDragStart}
      onClick={onClick}
      className={`bg-[var(--bg-tertiary)] p-3 rounded-md shadow-sm border border-[var(--border-primary)] hover:border-[var(--primary-accent)] transition-all ${cursorClass}`}
    >
      <h4 className="font-semibold text-sm text-[var(--text-primary)] truncate">{owner.nombre_propietario}</h4>
      <p className="text-xs text-[var(--text-secondary)] truncate">{owner.direccion_propiedad}</p>
      {(owner.telefono || owner.email) &&
        <p className="text-xs text-[var(--text-tertiary)] mt-1 truncate">{owner.telefono || owner.email}</p>
      }
    </div>
  );
};