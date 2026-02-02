import React, { useState, useEffect, useCallback } from 'react';
import { UserProfile, Role } from '../types';
import { fetchUsers, updateUser, deleteUser } from '../services/userService';
import { InviteUserModal } from './InviteUserModal';
import { ConfirmationModal } from './ConfirmationModal';
import { UsersIcon } from './icons/UsersIcon';
import { PencilIcon } from './icons/PencilIcon';
import { TrashIcon } from './icons/TrashIcon';

const RoleBadge: React.FC<{ role: Role }> = ({ role }) => {
    const roleStyles: Record<Role, string> = {
        [Role.SUPER_ADMIN]: 'bg-red-900/50 text-red-300 border border-red-500/30',
        [Role.ADMIN]: 'bg-green-900/50 text-green-300 border border-green-500/30',
        [Role.USER]: 'bg-gray-700 text-gray-300 border border-gray-600',
    };
    return (
        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${roleStyles[role]}`}>
            {role.replace('_', ' ')}
        </span>
    );
};

const UserStats: React.FC<{ users: UserProfile[], onInvite: () => void }> = ({ users, onInvite }) => {
    const counts = users.reduce((acc, user) => {
        acc[user.role] = (acc[user.role] || 0) + 1;
        return acc;
    }, {} as Record<Role, number>);

    return (
        <div className="flex flex-col items-center justify-center h-full p-6 text-center">
             <UsersIcon className="h-16 w-16 text-[var(--text-tertiary)] mb-4" />
            <h3 className="text-2xl font-bold text-[var(--text-primary)]">Gestión de Usuarios</h3>
            <p className="text-[var(--text-secondary)] mt-2">Selecciona un usuario para ver sus detalles o invita a uno nuevo.</p>
            <div className="flex space-x-4 mt-6">
                <div className="bg-[var(--bg-primary)] p-3 rounded-md text-center">
                    <p className="text-xs text-[var(--text-secondary)]">TOTAL</p>
                    <p className="text-2xl font-bold">{users.length}</p>
                </div>
                <div className="bg-[var(--bg-primary)] p-3 rounded-md text-center">
                    <p className="text-xs text-red-300">ADMINS</p>
                    <p className="text-2xl font-bold">{counts.SUPER_ADMIN || 0}</p>
                </div>
                <div className="bg-[var(--bg-primary)] p-3 rounded-md text-center">
                    <p className="text-xs text-gray-300">USERS</p>
                    <p className="text-2xl font-bold">{counts.USER || 0}</p>
                </div>
            </div>
             <button
                onClick={onInvite}
                className="mt-8 w-full max-w-xs bg-[var(--primary-accent)] hover:bg-[var(--primary-accent-hover)] text-white font-bold py-2.5 px-4 rounded-md transition-colors"
            >
                + Invitar Nuevo Usuario
            </button>
        </div>
    );
}

const UserDetailPanel: React.FC<{ 
    user: UserProfile; 
    onRoleChange: (userId: string, role: Role) => Promise<void>;
    onDelete: (user: UserProfile) => void;
}> = ({ user, onRoleChange, onDelete }) => {
    const [role, setRole] = useState(user.role);
    const [isSaving, setIsSaving] = useState(false);
    const hasChanges = role !== user.role;

    useEffect(() => {
        setRole(user.role);
    }, [user]);

    const handleSave = async () => {
        setIsSaving(true);
        await onRoleChange(user.id, role);
        setIsSaving(false);
    };

    return (
        <div className="p-6 h-full flex flex-col">
            <div className="flex-grow">
                <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-[var(--bg-tertiary)] rounded-full flex items-center justify-center text-2xl font-bold text-[var(--primary-accent-text)]">
                        {user.email.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-[var(--text-primary)] break-all">{user.email}</h3>
                        <p className="text-xs text-[var(--text-secondary)] font-mono">{user.id}</p>
                    </div>
                </div>

                <div className="mt-8 space-y-4">
                     <div>
                        <label className="block text-sm font-medium text-[var(--text-secondary)]">Rol</label>
                        <select 
                            value={role} 
                            onChange={(e) => setRole(e.target.value as Role)} 
                            className="mt-1 block w-full bg-[var(--bg-tertiary)] border-[var(--border-primary)] rounded-md shadow-sm focus:ring-[var(--primary-accent)] focus:border-[var(--primary-accent)] sm:text-sm text-[var(--text-primary)]"
                        >
                            {Object.values(Role).map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                        </select>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={!hasChanges || isSaving}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>
            </div>

            <div className="mt-8 pt-6 border-t border-red-500/20 flex-shrink-0">
                <h4 className="text-sm font-bold text-red-400">Zona de Peligro</h4>
                <div className="flex items-center justify-between mt-2">
                    <p className="text-sm text-[var(--text-secondary)]">Esta acción no se puede deshacer.</p>
                    <button
                        onClick={() => onDelete(user)}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md text-sm"
                    >
                        Eliminar Usuario
                    </button>
                </div>
            </div>
        </div>
    );
}

export const UserManagementView: React.FC = () => {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);

    const refreshUsers = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const fetchedUsers = await fetchUsers();
            setUsers(fetchedUsers);
            // If the currently selected user was updated or deleted, update the selection
            if(selectedUser) {
                const updatedSelectedUser = fetchedUsers.find(u => u.id === selectedUser.id);
                setSelectedUser(updatedSelectedUser || null);
            }
        } catch (err: any) {
            setError(err.message || "Error al cargar usuarios. Revisa la política RLS y que la tabla 'profiles' exista.");
        } finally {
            setLoading(false);
        }
    }, [selectedUser]);

    useEffect(() => {
        refreshUsers();
    }, []);

    const handleRoleChange = async (userId: string, role: Role) => {
        try {
            await updateUser(userId, { role });
            await refreshUsers();
        } catch(err: any) {
            setError(err.message);
        }
    };

    const handleDelete = async () => {
        if (!userToDelete) return;
        try {
            await deleteUser(userToDelete.id);
            setUserToDelete(null);
            if (selectedUser?.id === userToDelete.id) {
                setSelectedUser(null);
            }
            await refreshUsers();
        } catch(err: any) {
            setError(err.message);
        }
    };

    if (loading) {
        return <div className="text-center p-8 text-[var(--text-secondary)]">Cargando usuarios...</div>;
    }
    
    return (
        <div className="flex h-full bg-[var(--bg-primary)] rounded-lg border border-[var(--border-primary)] overflow-hidden">
            {/* Left Panel: User List */}
            <div className="w-1/3 border-r border-[var(--border-primary)] flex flex-col">
                <div className="p-4 border-b border-[var(--border-primary)] flex-shrink-0">
                    <h2 className="text-lg font-bold">Usuarios ({users.length})</h2>
                </div>
                <div className="overflow-y-auto">
                    {error && <div className="p-4 text-red-400 text-sm">{error}</div>}
                    {users.map(user => (
                        <div
                            key={user.id}
                            onClick={() => setSelectedUser(user)}
                            className={`flex items-center space-x-3 p-3 cursor-pointer border-l-4 transition-colors ${selectedUser?.id === user.id ? 'bg-[var(--bg-tertiary)] border-green-500' : 'border-transparent hover:bg-[var(--bg-tertiary)]'}`}
                        >
                            <div className="w-8 h-8 bg-[var(--bg-tertiary)] rounded-full flex items-center justify-center text-sm font-bold text-[var(--primary-accent-text)] flex-shrink-0">
                                {user.email.charAt(0).toUpperCase()}
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-sm font-medium text-[var(--text-primary)] truncate">{user.email}</p>
                                <p className="text-xs"><RoleBadge role={user.role} /></p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right Panel: Details or Stats */}
            <div className="w-2/3 bg-[var(--bg-secondary)]">
                {selectedUser ? (
                    <UserDetailPanel 
                        user={selectedUser}
                        onRoleChange={handleRoleChange}
                        onDelete={setUserToDelete}
                    />
                ) : (
                    <UserStats users={users} onInvite={() => setIsInviteModalOpen(true)} />
                )}
            </div>

            {isInviteModalOpen && (
                <InviteUserModal
                    isOpen={isInviteModalOpen}
                    onClose={() => setIsInviteModalOpen(false)}
                    onSuccess={refreshUsers}
                />
            )}

            {userToDelete && (
                <ConfirmationModal
                    isOpen={!!userToDelete}
                    onClose={() => setUserToDelete(null)}
                    onConfirm={handleDelete}
                    title="Eliminar Usuario"
                    message={`¿Estás seguro de que quieres eliminar a ${userToDelete.email}? Esta acción es irreversible.`}
                    confirmText="Sí, eliminar"
                    isLoading={false}
                />
            )}
        </div>
    );
};