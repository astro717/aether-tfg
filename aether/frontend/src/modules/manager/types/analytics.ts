export type TimeRange = 'today' | 'week' | 'month' | 'quarter' | 'all';

export type TaskHealthStatus = 'healthy' | 'at_risk' | 'stagnant' | 'blocked';

// Data for the TODAY view — focus on real-time task activity
export interface DailyTaskHealth {
  taskId: string;
  title: string;
  status: string; // 'in_progress', 'todo', etc.
  assignee: {
    id: string;
    username: string;
    avatarColor?: string;
  };
  // AI-derived health status based on last activity
  healthStatus: TaskHealthStatus;
  lastActivity: string; // ISO Date string
  aiInsight: string; // e.g. "No activity in 4h despite being 'In Progress'"
  isUnplanned: boolean; // Added today (interrupt/unplanned work)
}

// Planned vs Unplanned effort distribution for today
export interface DailyEffortDistribution {
  plannedWorkload: number;
  unplannedWorkload: number;
  interruptionRate: number; // percentage (0–100)
}

// Props for the top-level Smart Analytics Widget
export interface AnalyticsWidgetProps {
  period: TimeRange;
  organizationId: string;
}
