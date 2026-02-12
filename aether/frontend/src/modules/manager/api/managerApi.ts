const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface PendingTask {
  id: string;
  readable_id: number;
  title: string;
  description?: string;
  status: string;
  due_date?: string;
  created_at: string;
  users_tasks_assignee_idTousers?: {
    id: string;
    username: string;
    email: string;
    avatar_color?: string;
  };
  repos?: {
    id: string;
    name: string;
  };
}

export interface AnalyticsData {
  kpis: {
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    pendingValidation: number;
    todoTasks: number;
    completionRate: number;
    overdueTasks: number;
    teamSize: number;
  };
  velocityData: Array<{ week: string; completed: number; weekStart: string }>;
  statusDistribution: Array<{ name: string; value: number; color: string }>;
  individualPerformance: Array<{
    id: string;
    username: string;
    avatar_color: string;
    completed: number;
    inProgress: number;
    total: number;
  }>;
  healthData: Array<{ name: string; onTime: number; overdue: number }>;
  recentTasks: Array<{
    id: string;
    title: string;
    status: string;
    assignee: string;
    created_at: string;
  }>;
}

export interface AIReportRequest {
  type: 'weekly_organization' | 'user_performance' | 'bottleneck_prediction';
  userId?: string;
  organizationId: string;
}

export interface AIReport {
  id: string;
  type: string;
  content: string;
  summary: string;
  sections: Array<{ title: string; content: string }>;
  created_at: string;
  cached: boolean;
}

class ManagerApi {
  private getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  async getPendingValidationTasks(organizationId: string): Promise<PendingTask[]> {
    const response = await fetch(
      `${API_BASE_URL}/tasks/organization/${organizationId}/pending-validation`,
      { headers: this.getAuthHeaders() }
    );
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to fetch pending validation tasks');
    }
    return response.json();
  }

  async validateTask(taskId: string): Promise<PendingTask> {
    const response = await fetch(
      `${API_BASE_URL}/tasks/${taskId}/validate`,
      {
        method: 'POST',
        headers: this.getAuthHeaders(),
      }
    );
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to validate task');
    }
    return response.json();
  }

  async rejectTask(taskId: string, reason?: string): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/tasks/${taskId}/reject`,
      {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ reason }),
      }
    );
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to reject task');
    }
  }

  async getAnalytics(organizationId: string, period: string = 'all'): Promise<AnalyticsData> {
    const response = await fetch(
      `${API_BASE_URL}/tasks/organization/${organizationId}/analytics?period=${period}`,
      { headers: this.getAuthHeaders() }
    );
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to fetch analytics');
    }
    return response.json();
  }

  async generateAIReport(request: AIReportRequest): Promise<AIReport> {
    const response = await fetch(
      `${API_BASE_URL}/ai/manager-report`,
      {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(request),
      }
    );
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to generate AI report');
    }
    return response.json();
  }

  async getTeamMembers(organizationId: string): Promise<Array<{ id: string; username: string; avatar_color: string; role_in_org: string }>> {
    const response = await fetch(
      `${API_BASE_URL}/organizations/${organizationId}/users`,
      { headers: this.getAuthHeaders() }
    );
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to fetch team members');
    }
    return response.json();
  }
}

export const managerApi = new ManagerApi();
