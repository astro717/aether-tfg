const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export interface NotificationSettings {
  notify_email_enabled: boolean;
  notify_email_assignments: boolean;
  notify_email_comments: boolean;
  notify_email_mentions: boolean;
  notify_inapp_enabled: boolean;
  deadline_reminder_hours: number[];
}

/**
 * Get the current user's notification settings
 */
export async function getNotificationSettings(): Promise<NotificationSettings> {
  const res = await fetch(`${API_BASE_URL}/users/me/settings`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || 'Failed to fetch notification settings');
  }

  return res.json();
}

/**
 * Update the current user's notification settings
 */
export async function updateNotificationSettings(
  settings: Partial<NotificationSettings>
): Promise<NotificationSettings> {
  const res = await fetch(`${API_BASE_URL}/users/me/settings`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(settings),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || 'Failed to update notification settings');
  }

  return res.json();
}
