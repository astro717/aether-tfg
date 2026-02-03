// frontend/src/modules/auth/api/authApi.ts

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: string;
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

