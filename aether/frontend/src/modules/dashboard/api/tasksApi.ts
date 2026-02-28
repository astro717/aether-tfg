const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface User {
  id: string;
  username: string;
  email: string;
  avatar_color?: string;
}

export interface Repo {
  id: string;
  name: string;
}

export interface LinkedCommit {
  sha: string;
  message: string;
  author_login: string | null;
  committed_at: string;
}

export interface TaskCommit {
  commit_sha: string;
  linked_at: string;
  commits: LinkedCommit;
}

export interface Task {
  id: string;
  readable_id: string;
  repo_id: string | null;
  title: string;
  description: string | null;
  status: 'pending_validation' | 'todo' | 'pending' | 'in_progress' | 'done';
  assignee_id: string | null;
  start_date: string;
  due_date: string | null;
  validated_by: string | null;
  created_at: string;
  comments: string | null;
  is_archived?: boolean;
  users_tasks_assignee_idTousers?: User;
  repos?: Repo;
  task_commits?: TaskCommit[];
}

export interface KanbanData {
  pending_validation: Task[];
  todo: Task[];
  pending: Task[];
  in_progress: Task[];
  done: Task[];
  totals: {
    pending_validation: number;
    todo: number;
    pending: number;
    in_progress: number;
    done: number;
    all: number;
  };
}

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  users: {
    id: string;
    username: string;
    email: string;
    avatar_color?: string;
  };
}

export interface CommitFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

export interface CommitDiff {
  sha: string;
  message: string;
  files: CommitFile[];
  stats: {
    additions: number;
    deletions: number;
    total: number;
  };
}

export interface CommitExplanation {
  sha: string;
  summary: string;
  filesChanged: string[];
  impact: string;
  codeQuality: string;
  cached: boolean;
  timestamp?: string; // ISO date string of when the explanation was generated
}

export interface CommitInTaskContextExplanation {
  sha: string;
  taskId: string;
  taskTitle: string;
  readableId: string;
  explanation: string;
  howItFulfillsTask: string;
  remainingWork: string[];
  technicalDetails: string;
  cached: boolean;
  timestamp?: string;
}

export interface CodeAnalysisResult {
  summary: string;
  score: string;
  issues: {
    severity: 'high' | 'medium' | 'low';
    title: string;
    file: string;
    line: number;
  }[];
  cached: boolean;
  timestamp?: string;
}

export interface TaskReportResult {
  summary: string;
  sections: {
    title: string;
    content: string;
  }[];
  cached: boolean;
  timestamp?: string;
}

export interface PersonalPulseData {
  weeklyVelocity: number;
  trend: number;
  onTimeRate: number;
  cycleTime: number; // in days
  streak: number; // in days
  progress: {
    todo: number;
    inProgress: number;
    done: number;
    total: number;
  };
}

class TasksApi {
  private getAuthHeaders() {
    const token = localStorage.getItem('token'); // Note: 'token' not 'authToken'
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  async getKanbanData(organizationId: string): Promise<KanbanData> {
    const response = await fetch(
      `${API_BASE_URL}/tasks/organization/${organizationId}/kanban`,
      { headers: this.getAuthHeaders() }
    );
    if (!response.ok) throw new Error('Failed to fetch kanban data');
    return response.json();
  }

  async updateTask(id: string, data: Partial<Task>): Promise<Task> {
    const response = await fetch(
      `${API_BASE_URL}/tasks/${id}`,
      {
        method: 'PATCH',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data)
      }
    );
    if (!response.ok) throw new Error('Failed to update task');
    return response.json();
  }

  async getMyTasks(): Promise<Task[]> {
    const response = await fetch(
      `${API_BASE_URL}/tasks/my-tasks`,
      { headers: this.getAuthHeaders() }
    );
    if (!response.ok) throw new Error('Failed to fetch my tasks');
    return response.json();
  }

  async getMyPulse(): Promise<PersonalPulseData> {
    const response = await fetch(
      `${API_BASE_URL}/tasks/my-pulse`,
      { headers: this.getAuthHeaders() }
    );
    if (!response.ok) throw new Error('Failed to fetch personal pulse');
    return response.json();
  }

  async getTask(id: string): Promise<Task> {
    const response = await fetch(
      `${API_BASE_URL}/tasks/${id}`,
      { headers: this.getAuthHeaders() }
    );
    if (!response.ok) throw new Error('Failed to fetch task');
    return response.json();
  }

  async getComments(taskId: string): Promise<TaskComment[]> {
    const response = await fetch(
      `${API_BASE_URL}/tasks/${taskId}/comments`,
      { headers: this.getAuthHeaders() }
    );
    if (!response.ok) throw new Error('Failed to fetch comments');
    return response.json();
  }

  async addComment(taskId: string, content: string): Promise<TaskComment> {
    const response = await fetch(
      `${API_BASE_URL}/tasks/${taskId}/comments`,
      {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ content }),
      }
    );
    if (!response.ok) throw new Error('Failed to add comment');
    return response.json();
  }

  async deleteComment(commentId: string): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/tasks/comments/${commentId}`,
      {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      }
    );
    if (!response.ok) throw new Error('Failed to delete comment');
  }

  async createTask(data: {
    title: string;
    description?: string;
    due_date?: string;
    assignee_id: string;
    organization_id: string;
    repo_id?: string;
  }): Promise<Task> {
    const response = await fetch(
      `${API_BASE_URL}/tasks`,
      {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data),
      }
    );
    if (!response.ok) throw new Error('Failed to create task');
    return response.json();
  }

  async getCommitDiff(sha: string): Promise<CommitDiff> {
    const response = await fetch(
      `${API_BASE_URL}/commits/${sha}/diff`,
      { headers: this.getAuthHeaders() }
    );
    if (!response.ok) throw new Error('Failed to fetch commit diff');
    return response.json();
  }

  async getCommitExplanation(sha: string, options?: { onlyCached?: boolean }): Promise<CommitExplanation> {
    const url = new URL(`${API_BASE_URL}/ai/commits/${sha}/explain`);
    if (options?.onlyCached) {
      url.searchParams.append('onlyCached', 'true');
    }

    const response = await fetch(
      url.toString(),
      { headers: this.getAuthHeaders() }
    );
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.message || `HTTP ${response.status}`;
      throw new Error(`Failed to fetch commit explanation: ${message}`);
    }
    return response.json();
  }

  async getCommitExplanationInContext(taskId: string, sha: string, options?: { onlyCached?: boolean; forceRegenerate?: boolean; language?: string; depth?: string }): Promise<CommitInTaskContextExplanation> {
    const url = new URL(`${API_BASE_URL}/ai/tasks/${taskId}/commits/${sha}/explain`);
    if (options?.onlyCached) {
      url.searchParams.append('onlyCached', 'true');
    }
    if (options?.forceRegenerate) {
      url.searchParams.append('forceRegenerate', 'true');
    }
    if (options?.language) {
      url.searchParams.append('language', options.language);
    }
    if (options?.depth) {
      url.searchParams.append('depth', options.depth);
    }

    const response = await fetch(
      url.toString(),
      { headers: this.getAuthHeaders() }
    );
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.message || `HTTP ${response.status}`;
      throw new Error(`Failed to fetch commit explanation in context: ${message}`);
    }
    return response.json();
  }

  async getCommitCodeAnalysis(sha: string, options?: { onlyCached?: boolean; forceRegenerate?: boolean; language?: string; depth?: string }): Promise<CodeAnalysisResult> {
    const url = new URL(`${API_BASE_URL}/ai/commits/${sha}/analyze`);
    if (options?.onlyCached) {
      url.searchParams.append('onlyCached', 'true');
    }
    if (options?.forceRegenerate) {
      url.searchParams.append('forceRegenerate', 'true');
    }
    if (options?.language) {
      url.searchParams.append('language', options.language);
    }
    if (options?.depth) {
      url.searchParams.append('depth', options.depth);
    }

    const response = await fetch(
      url.toString(),
      { headers: this.getAuthHeaders() }
    );
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.message || `HTTP ${response.status}`;
      throw new Error(`Failed to fetch code analysis: ${message}`);
    }
    return response.json();
  }

  async getTaskReport(taskId: string, commitSha: string, options?: { onlyCached?: boolean; forceRegenerate?: boolean }): Promise<TaskReportResult> {
    const url = new URL(`${API_BASE_URL}/ai/tasks/${taskId}/report`);
    url.searchParams.append('commitSha', commitSha);
    if (options?.onlyCached) {
      url.searchParams.append('onlyCached', 'true');
    }
    if (options?.forceRegenerate) {
      url.searchParams.append('forceRegenerate', 'true');
    }

    const response = await fetch(
      url.toString(),
      { headers: this.getAuthHeaders() }
    );
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.message || `HTTP ${response.status}`;
      throw new Error(`Failed to fetch task report: ${message}`);
    }
    return response.json();
  }

  async getCommitsByRepo(repoId: string): Promise<LinkedCommit[]> {
    const response = await fetch(
      `${API_BASE_URL}/commits/repo/${repoId}`,
      { headers: this.getAuthHeaders() }
    );
    if (!response.ok) throw new Error('Failed to fetch commits');
    return response.json();
  }

  async linkCommitToTask(taskId: string, commitSha: string): Promise<Task> {
    const response = await fetch(
      `${API_BASE_URL}/tasks/${taskId}/commits`,
      {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ commit_sha: commitSha }),
      }
    );
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.message || 'Failed to link commit';
      throw new Error(message);
    }
    return response.json();
  }

  async syncCommitsFromGithub(repoId: string, maxCommits: number = 50): Promise<{ synced: number; linked: number; total: number }> {
    const response = await fetch(
      `${API_BASE_URL}/commits/sync/${repoId}?maxCommits=${maxCommits}`,
      {
        method: 'POST',
        headers: this.getAuthHeaders(),
      }
    );
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.message || 'Failed to sync commits';
      throw new Error(message);
    }
    return response.json();
  }

  async archiveTask(taskId: string): Promise<Task> {
    const response = await fetch(
      `${API_BASE_URL}/tasks/${taskId}/archive`,
      {
        method: 'PATCH',
        headers: this.getAuthHeaders(),
      }
    );
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.message || 'Failed to archive task';
      throw new Error(message);
    }
    return response.json();
  }

  async archiveAllDone(organizationId: string): Promise<{ archived: number }> {
    const response = await fetch(
      `${API_BASE_URL}/tasks/organization/${organizationId}/archive-done`,
      {
        method: 'POST',
        headers: this.getAuthHeaders(),
      }
    );
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.message || 'Failed to archive done tasks';
      throw new Error(message);
    }
    return response.json();
  }
}

export const tasksApi = new TasksApi();
