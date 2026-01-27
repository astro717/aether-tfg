import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { organizationApi } from '../api/organizationApi';
import type { Organization } from '../api/organizationApi';
import { useAuth } from '../../auth/context/AuthContext';

interface OrganizationContextType {
  currentOrganization: Organization | null;
  setCurrentOrganization: (org: Organization | null) => void;
  organizations: Organization[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchOrganizations = async () => {
    // Don't fetch if no user is logged in
    if (!user) {
      setLoading(false);
      setOrganizations([]);
      setCurrentOrganization(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const orgs = await organizationApi.getMyOrganizations();
      setOrganizations(orgs);

      // Auto-select: saved org or first org
      const savedOrgId = localStorage.getItem('currentOrganizationId');
      const orgToSelect = savedOrgId
        ? orgs.find(o => o.id === savedOrgId) || orgs[0]
        : orgs[0];

      if (orgToSelect) {
        setCurrentOrganization(orgToSelect);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load organizations'));
      console.error('Error loading organizations:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch organizations when user changes (login/logout)
  useEffect(() => {
    // Wait for auth to finish loading before fetching
    if (!authLoading) {
      fetchOrganizations();
    }
  }, [user, authLoading]);

  // Persist current organization
  useEffect(() => {
    if (currentOrganization) {
      localStorage.setItem('currentOrganizationId', currentOrganization.id);
    } else {
      localStorage.removeItem('currentOrganizationId');
    }
  }, [currentOrganization]);

  return (
    <OrganizationContext.Provider
      value={{
        currentOrganization,
        setCurrentOrganization,
        organizations,
        loading: loading || authLoading,
        error,
        refetch: fetchOrganizations,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within OrganizationProvider');
  }
  return context;
}
