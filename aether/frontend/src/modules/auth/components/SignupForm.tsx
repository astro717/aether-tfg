// import { useState } from "react";
// import { Input } from "@/components/ui/input";
// import { registerUser } from "../api/authApi";
// import { useNavigate } from "react-router-dom";

// export const SignupForm = () => {
//   const [form, setForm] = useState({ name: "", email: "", password: "" });
//   const [isSubmitting, setIsSubmitting] = useState(false);
//   const [error, setError] = useState("");
//   const navigate = useNavigate();

//   const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
//     setForm({ ...form, [e.target.name]: e.target.value });

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setIsSubmitting(true);
//     setError("");
//     try {
//       const token = await registerUser(form);
//       localStorage.setItem("token", token);
//       navigate("/connect-github");
//     } catch {
//       setError("Error al registrar usuario");
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   return (
//     <form onSubmit={handleSubmit} className="flex flex-col gap-3">
//       <Input
//         name="name"
//         placeholder="Username"
//         value={form.name}
//         onChange={handleChange}
//         required
//         disabled={isSubmitting}
//         className="bg-white/60 border-gray-200 placeholder:text-gray-400 h-12 rounded-xl text-gray-700 focus:border-gray-300 focus:ring-1 focus:ring-gray-300"
//       />
//       <Input
//         name="email"
//         type="email"
//         placeholder="email"
//         value={form.email}
//         onChange={handleChange}
//         required
//         disabled={isSubmitting}
//         className="bg-white/60 border-gray-200 placeholder:text-gray-400 h-12 rounded-xl text-gray-700 focus:border-gray-300 focus:ring-1 focus:ring-gray-300"
//       />
//       <Input
//         name="password"
//         type="password"
//         placeholder="Password"
//         value={form.password}
//         onChange={handleChange}
//         required
//         disabled={isSubmitting}
//         className="bg-white/60 border-gray-200 placeholder:text-gray-400 h-12 rounded-xl text-gray-700 focus:border-gray-300 focus:ring-1 focus:ring-gray-300"
//       />

//       {error && <p className="text-red-500 text-sm text-center mt-2">{error}</p>}
//     </form>
//   );
// };

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { registerUser } from "../api/authApi";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export const SignupForm = () => {
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { refetch } = useAuth();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
      // Register the user and get JWT token
      const token = await registerUser(form);
      localStorage.setItem("token", token);

      // Refetch user data to update AuthContext before navigating
      await refetch();

      // Navigate to Step 2 (GitHub connect)
      navigate("/connect-github");
    } catch {
      setError("Error al registrar usuario");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Input
        name="username"
        placeholder="Username"
        value={form.username}
        onChange={handleChange}
        required
        disabled={isSubmitting}
        className="bg-white/60 border-gray-200 placeholder:text-gray-400 h-12 rounded-2xl text-gray-700 focus:border-gray-300 focus:ring-1 focus:ring-gray-300"
      />
      <Input
        name="email"
        type="email"
        placeholder="Email"
        value={form.email}
        onChange={handleChange}
        required
        disabled={isSubmitting}
        className="bg-white/60 border-gray-200 placeholder:text-gray-400 h-12 rounded-2xl text-gray-700 focus:border-gray-300 focus:ring-1 focus:ring-gray-300"
      />
      <Input
        name="password"
        type="password"
        placeholder="Password"
        value={form.password}
        onChange={handleChange}
        required
        disabled={isSubmitting}
        className="bg-white/60 border-gray-200 placeholder:text-gray-400 h-12 rounded-2xl text-gray-700 focus:border-gray-300 focus:ring-1 focus:ring-gray-300"
      />

      {error && (
        <p className="text-red-500 text-sm text-center mt-2">{error}</p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-3 h-12 rounded-2xl bg-blue-500 text-white font-medium tracking-wide shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),_0_8px_30px_rgba(0,0,0,0.35)] hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),_0_8px_40px_rgba(0,0,0,0.45)] hover:bg-blue-600 active:translate-y-[1px] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
      >
        {isSubmitting ? "Creating account..." : "Continue"}
      </button>
    </form>
  );
};
