// frontend/src/modules/auth/api/authApi.ts
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

