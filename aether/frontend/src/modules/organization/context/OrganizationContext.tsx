import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { organizationApi } from '../api/organizationApi';
import type { Organization } from '../api/organizationApi';

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
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchOrganizations = async () => {
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

  useEffect(() => {
    fetchOrganizations();
  }, []);

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
        loading,
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
