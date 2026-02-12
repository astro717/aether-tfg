// frontend/src/modules/auth/api/authApi.ts

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: string;
  avatar_color?: string; // e.g. "blue", "green"
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export async function getMe(): Promise<AuthUser> {
  const res = await fetch(`${API_BASE_URL}/auth/me`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    throw new Error('Failed to fetch user profile');
  }

  return res.json();
}

export async function registerUser(data: { username: string; email: string; password: string }) {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) throw new Error("Error en registro");

  const json = await res.json();
  return json.access_token;
}
export async function loginUser(data: { email: string; password: string }) {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Login failed: ${errText}`);
  }

  const json = await res.json();
  return json.access_token;
}

export async function connectGithub(code: string) {
  const res = await fetch(`${API_BASE_URL}/auth/github/connect`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ code }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GitHub connection failed: ${errText}`);
  }

  return res.json();
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || 'Failed to send reset email');
  }

  return res.json();
}

export async function resetPassword(token: string, password: string): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || 'Failed to reset password');
  }

  return res.json();
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE_URL}/auth/change-password`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ currentPassword, newPassword }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || 'Failed to change password');
  }

  return res.json();
}

export async function sendResetEmailToCurrentUser(): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE_URL}/auth/send-reset-email`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || 'Failed to send reset email');
  }

  return res.json();
}

export async function updateProfile(data: Partial<AuthUser> & { jobTitle?: string; bio?: string }): Promise<AuthUser> {
  const res = await fetch(`${API_BASE_URL}/users/me/profile`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || 'Failed to update profile');
  }

  return res.json();
}
