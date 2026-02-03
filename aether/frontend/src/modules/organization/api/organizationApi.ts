const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface Organization {
  id: string;
  name: string;
  created_at: string;
}

class OrganizationApi {
  private getAuthHeaders() {
    const token = localStorage.getItem('token'); // Note: 'token' not 'authToken'
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  async getMyOrganizations(): Promise<Organization[]> {
    const response = await fetch(
      `${API_BASE_URL}/organizations/my-organizations`,
      { headers: this.getAuthHeaders() }
    );
    if (!response.ok) throw new Error('Failed to fetch organizations');
    return response.json();
  }

  async getOrganizationById(id: string): Promise<Organization> {
    const response = await fetch(
      `${API_BASE_URL}/organizations/${id}`,
      { headers: this.getAuthHeaders() }
    );
    if (!response.ok) throw new Error('Failed to fetch organization');
    return response.json();
  }

  async createOrganization(name: string): Promise<Organization> {
    const response = await fetch(
      `${API_BASE_URL}/organizations`,
      {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ name })
      }
    );
    if (!response.ok) throw new Error('Failed to create organization');
    return response.json();
  }

  async joinOrganization(organizationId: string): Promise<{ success: boolean; organization: Organization }> {
    const response = await fetch(
      `${API_BASE_URL}/organizations/join`,
      {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ organizationId })
      }
    );
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to join organization');
    }
    return response.json();
  }
}

export const organizationApi = new OrganizationApi();
