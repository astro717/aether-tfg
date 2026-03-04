import { useState } from 'react';
import type { FormEvent } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { organizationApi } from '../api/organizationApi';
import { useOrganization } from '../context/OrganizationContext';

type Mode = 'create' | 'join';

interface OrganizationSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OrganizationSetupModal({ isOpen, onClose }: OrganizationSetupModalProps) {
  const [mode, setMode] = useState<Mode>('create');
  const [orgName, setOrgName] = useState('');
  const [orgId, setOrgId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { refetch, setCurrentOrganization } = useOrganization();

  const resetForm = () => {
    setOrgName('');
    setOrgId('');
    setError(null);
    setMode('create');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!orgName.trim()) {
      setError('Organization name is required.');
      return;
    }

    setIsSubmitting(true);

    try {
      const org = await organizationApi.createOrganization(orgName.trim());
      localStorage.setItem('currentOrganizationId', org.id);
      await refetch();
      setCurrentOrganization(org);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create organization');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!orgId.trim()) {
      setError('Organization ID is required.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await organizationApi.joinOrganization(orgId.trim());
      localStorage.setItem('currentOrganizationId', result.organization.id);
      await refetch();
      setCurrentOrganization(result.organization);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join organization');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={handleClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-md mx-4 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl border border-white/50 dark:border-white/10 rounded-3xl shadow-2xl p-8 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Add workspace
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Create a new organization or join an existing one.
          </p>
        </div>

        {/* Toggle */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex rounded-full bg-gray-100/80 dark:bg-zinc-800/80 p-1 border border-gray-200/50 dark:border-white/10">
            <button
              type="button"
              onClick={() => {
                setMode('create');
                setError(null);
              }}
              className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-200 ${
                mode === 'create'
                  ? 'bg-white dark:bg-zinc-700 shadow-sm text-gray-900 dark:text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('join');
                setError(null);
              }}
              className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-200 ${
                mode === 'join'
                  ? 'bg-white dark:bg-zinc-700 shadow-sm text-gray-900 dark:text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              Join
            </button>
          </div>
        </div>

        {/* Forms */}
        {mode === 'create' ? (
          <form className="space-y-4" onSubmit={handleCreateSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Organization name
              </label>
              <Input
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g., Aether Labs"
                className="h-11 rounded-xl bg-white/60 dark:bg-zinc-800/60 border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-gray-300 dark:focus:border-zinc-600 focus:ring-1 focus:ring-gray-300 dark:focus:ring-zinc-600"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                You can change the name later.
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-semibold shadow-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-all duration-150 active:translate-y-px disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create organization'}
            </Button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={handleJoinSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Organization ID
              </label>
              <Input
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                placeholder="Paste the ID here"
                className="h-11 rounded-xl bg-white/60 dark:bg-zinc-800/60 border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-gray-300 dark:focus:border-zinc-600 focus:ring-1 focus:ring-gray-300 dark:focus:ring-zinc-600"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Ask a team member for the organization ID.
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-semibold shadow-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-all duration-150 active:translate-y-px disabled:opacity-50"
            >
              {isSubmitting ? 'Joining...' : 'Join organization'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
