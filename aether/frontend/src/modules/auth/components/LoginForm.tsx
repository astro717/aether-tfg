import { useState } from "react";
import { Input } from "@/components/ui/input";
import { loginUser } from "../api/authApi"; // usa el mismo archivo que el registro

export const LoginForm = () => {
  const [form, setForm] = useState({ email: "", password: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
      const token = await loginUser(form);
      localStorage.setItem("token", token);
      window.location.href = "/dashboard";
    } catch {
      setError("Invalid email or password");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Input
        name="email"
        type="email"
        placeholder="Email"
        value={form.email}
        onChange={handleChange}
        required
        disabled={isSubmitting}
        className="bg-white/60 border-gray-200 placeholder:text-gray-400 h-12 rounded-xl text-gray-700 focus:border-gray-300 focus:ring-1 focus:ring-gray-300"
      />
      <Input
        name="password"
        type="password"
        placeholder="Password"
        value={form.password}
        onChange={handleChange}
        required
        disabled={isSubmitting}
        className="bg-white/60 border-gray-200 placeholder:text-gray-400 h-12 rounded-xl text-gray-700 focus:border-gray-300 focus:ring-1 focus:ring-gray-300"
      />

      {error && <p className="text-red-500 text-sm text-center mt-2">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-3 bg-blue-500 hover:bg-blue-600 text-white font-medium h-12 rounded-xl transition-colors"
      >
        {isSubmitting ? "Logging in..." : "Submit"}
      </button>
    </form>
  );
};
