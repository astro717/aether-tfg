const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface User {
  id: string;
  username: string;
  email: string;
}

export interface Repo {
  id: string;
  name: string;
}

export interface Task {
  id: string;
  repo_id: string | null;
  title: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'done';
  assignee_id: string | null;
  start_date: string;
  due_date: string | null;
  validated_by: string | null;
  created_at: string;
  comments: string | null;
  users_tasks_assignee_idTousers?: User;
  repos?: Repo;
}

export interface KanbanData {
  pending: Task[];
  in_progress: Task[];
  done: Task[];
  totals: {
    pending: number;
    in_progress: number;
    done: number;
    all: number;
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
}

export const tasksApi = new TasksApi();
