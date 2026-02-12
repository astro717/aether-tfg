import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, User, Loader2, Users } from 'lucide-react';
import { organizationApi, type OrganizationMember } from '../../organization/api/organizationApi';
import { useOrganization } from '../../organization/context/OrganizationContext';
import { useAuth } from '../../auth/context/AuthContext';
import { UserAvatar } from '../../../components/ui/UserAvatar';
import { useToast } from '../../../components/ui/Toast';

export function ManagerUsersList() {
  const { currentOrganization, refetch: refetchOrgs } = useOrganization();
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!currentOrganization) return;

    try {
      setLoading(true);
      const orgMembers = await organizationApi.getOrganizationMembers(currentOrganization.id);
      setMembers(orgMembers);
    } catch (error) {
      console.error('Error fetching members:', error);
      showToast('Failed to load team members', 'error');
    } finally {
      setLoading(false);
    }
  }, [currentOrganization, showToast]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'member') => {
    if (!currentOrganization) return;

    try {
      setActionLoading(userId);
      await organizationApi.changeUserRole(currentOrganization.id, userId, newRole);

      // Update local state
      setMembers(prev => prev.map(m =>
        m.id === userId ? { ...m, role_in_org: newRole } : m
      ));

      // If changing own role, refetch organizations to update context
      if (userId === currentUser?.id) {
        await refetchOrgs();
      }

      showToast(`Role updated to ${newRole === 'admin' ? 'Manager' : 'Member'}`, 'success');
    } catch (error) {
      console.error('Error changing role:', error);
      showToast(error instanceof Error ? error.message : 'Failed to change role', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const admins = members.filter(m => m.role_in_org === 'admin');
  const regularMembers = members.filter(m => m.role_in_org !== 'admin');

  return (
    <div className="space-y-8">
      {/* Stats Header */}
      <div className="grid grid-cols-3 gap-4">
        <div className="
          rounded-2xl p-5
          bg-white/60 dark:bg-zinc-900/60
          backdrop-blur-xl
          border border-white/20 dark:border-zinc-700/50
          shadow-lg shadow-black/5 dark:shadow-black/20
        ">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">{members.length}</span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Members</p>
        </div>

        <div className="
          rounded-2xl p-5
          bg-white/60 dark:bg-zinc-900/60
          backdrop-blur-xl
          border border-white/20 dark:border-zinc-700/50
          shadow-lg shadow-black/5 dark:shadow-black/20
        ">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">{admins.length}</span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Managers</p>
        </div>

        <div className="
          rounded-2xl p-5
          bg-white/60 dark:bg-zinc-900/60
          backdrop-blur-xl
          border border-white/20 dark:border-zinc-700/50
          shadow-lg shadow-black/5 dark:shadow-black/20
        ">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-zinc-800 flex items-center justify-center">
              <User className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </div>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">{regularMembers.length}</span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Members</p>
        </div>
      </div>

      {/* Members List */}
      <div className="
        rounded-2xl overflow-hidden
        bg-white/60 dark:bg-zinc-900/60
        backdrop-blur-xl
        border border-white/20 dark:border-zinc-700/50
        shadow-lg shadow-black/5 dark:shadow-black/20
      ">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Team Members
          </h3>
        </div>

        <div className="divide-y divide-gray-100 dark:divide-zinc-800">
          {members.map((member) => {
            const isAdmin = member.role_in_org === 'admin';
            const isCurrentUser = member.id === currentUser?.id;
            const isOnlyAdmin = isAdmin && admins.length === 1;

            return (
              <div
                key={member.id}
                className="flex items-center justify-between px-5 py-4 hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <UserAvatar
                    username={member.username}
                    avatarColor={member.avatar_color}
                    size="md"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {member.username}
                      </span>
                      {isCurrentUser && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                          You
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {member.email}
                    </span>
                  </div>
                </div>

                {/* Role Selector */}
                <div className="flex items-center gap-3">
                  {actionLoading === member.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  ) : (
                    <select
                      value={isAdmin ? 'admin' : 'member'}
                      onChange={(e) => handleRoleChange(member.id, e.target.value as 'admin' | 'member')}
                      disabled={isOnlyAdmin}
                      className="
                        px-3 py-2 rounded-xl text-sm font-medium
                        bg-gray-100 dark:bg-zinc-800
                        text-gray-700 dark:text-gray-300
                        border-0 outline-none
                        focus:ring-2 focus:ring-blue-500/20
                        disabled:opacity-50 disabled:cursor-not-allowed
                        cursor-pointer
                        transition-colors
                      "
                      title={isOnlyAdmin ? 'Cannot demote the last manager' : undefined}
                    >
                      <option value="admin">Manager</option>
                      <option value="member">Member</option>
                    </select>
                  )}

                  {/* Role Badge */}
                  <div className={`
                    p-2 rounded-xl
                    ${isAdmin
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                      : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400'
                    }
                  `}>
                    {isAdmin ? (
                      <ShieldCheck className="w-4 h-4" />
                    ) : (
                      <User className="w-4 h-4" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
