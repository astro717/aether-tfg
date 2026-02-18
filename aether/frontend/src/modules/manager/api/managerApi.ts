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
    // Enriched fields — only present when period === 'today'
    updated_at?: string;
    due_date?: string | null;
    latestCommitDate?: string | null;
    latestCommentDate?: string | null;
  }>;
  // PREMIUM CHARTS: Enhanced visualizations for Analytics Dashboard
  premiumCharts?: {
    // Smooth CFD (Cumulative Flow Diagram)
    cfd: Array<{
      date: string;
      done: number;
      review: number;
      in_progress: number;
      todo: number;
    }>;
    // Investment Distribution (Task Classification)
    investment: {
      labels: string[];
      datasets: Array<{ label: string; data: number[]; color: string }>;
    };
    // Workload Heatmap (GitHub-style activity matrix)
    heatmap: {
      users: string[];
      days: string[];
      data: number[][];
    };
    // Predictive Burndown with Uncertainty Cone
    burndown: {
      real: Array<{ day: number; tasks: number }>;
      ideal: Array<{ day: number; tasks: number }>;
      projection: Array<{ day: number; optimistic: number; pessimistic: number }>;
    };
    // Sparklines for KPI Cards
    sparklines: {
      completionRate: number[];
      velocity: number[];
      cycleTime: number[];
      riskScore: number[];
    };
  };
}

export interface AIReportRequest {
  type: 'weekly_organization' | 'user_performance' | 'bottleneck_prediction';
  userId?: string;
  organizationId: string;
  period: string; // Format: 'YYYY-W##' for weeks or 'YYYY-MM-DD:YYYY-MM-DD' for ranges
  forceRegenerate?: boolean;
}

export interface AIReport {
  id: string;
  type: string;
  content: string;
  summary: string;
  sections: Array<{ title: string; content: string }>;
  created_at: string;
  cached: boolean;
  timestamp?: Date;
  chartData?: {
    // The Pulse - KPI Cards with Sparklines
    pulse?: {
      velocityStability: {
        value: number;
        sparkline: number[];
      };
      cycleTime: {
        value: number;
        sparkline: number[];
      };
      reviewEfficiency: {
        value: number;
        sparkline: number[];
      };
      riskScore: {
        value: number;
        sparkline: number[];
      };
    };
    // Investment Distribution
    investment?: {
      labels: string[];
      datasets: Array<{ label: string; data: number[]; color: string }>;
    };
    // DORA Metrics (Legacy - keeping for backward compatibility)
    dora?: {
      deploymentFrequency: number;
      leadTimeAvg: number;
      velocityStability: number;
      sparklineData: number[];
      cycleTimeSparkline: number[];
      reviewEfficiencySparkline: number[];
    };
    // Smooth CFD (Updated format)
    cfd?: Array<{
      date: string;
      done: number;
      review: number;
      in_progress: number;
      todo: number;
    }>;
    // Workload Heatmap
    heatmap?: {
      users: string[];
      days: string[];
      data: number[][];
    };
    // Predictive Burndown with Uncertainty Cone
    burndown?: {
      real: Array<{ day: number; tasks: number }>;
      ideal: Array<{ day: number; tasks: number }>;
      projection: Array<{ day: number; optimistic: number; pessimistic: number }>;
    };
    // Radar Metrics (User Performance)
    radar?: {
      user: string;
      metrics: {
        reviewSpeed: number;
        codeQuality: number;
        collaboration: number;
        throughput: number;
        consistency: number;
      };
    };
    // Cycle Time Scatter
    cycleTime?: Array<{ date: string; days: number; taskTitle: string }>;
    // Throughput Trend
    throughput?: {
      weeks: string[];
      completed: number[];
      movingAverage: number[];
    };
  };
}

export interface ReportAvailability {
  type: string;
  userId: string | null;
  createdAt: Date;
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

  async getCFD(
    organizationId: string,
    range: '30d' | '90d' | 'all' = '30d',
  ): Promise<Array<{ date: string; done: number; review: number; in_progress: number; todo: number }>> {
    const response = await fetch(
      `${API_BASE_URL}/tasks/organization/${organizationId}/cfd?range=${range}`,
      { headers: this.getAuthHeaders() }
    );
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to fetch CFD data');
    }
    return response.json();
  }

  async checkReportAvailability(organizationId: string, period: string): Promise<{ available: ReportAvailability[] }> {
    const response = await fetch(
      `${API_BASE_URL}/ai/manager-report/availability?organizationId=${organizationId}&period=${period}`,
      { headers: this.getAuthHeaders() }
    );
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to check report availability');
    }
    return response.json();
  }
}

export const managerApi = new ManagerApi();
