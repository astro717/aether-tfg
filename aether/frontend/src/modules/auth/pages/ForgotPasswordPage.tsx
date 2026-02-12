import { useState } from "react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { forgotPassword } from "../api/authApi";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";

export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      await forgotPassword(email.trim());
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reset email");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{
        background: "radial-gradient(ellipse at center, #23282b 0%, #f4f5f7 100%)",
      }}
    >
      <h1 className="text-7xl font-light text-[#e3e3e3] mb-12 tracking-wide">
        aether.
      </h1>

      <div className="w-[500px] bg-white/40 backdrop-blur-3xl rounded-3xl shadow-xl p-8 flex flex-col">
        {success ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-green-600" />
            </div>
            <h2 className="text-gray-900 text-2xl font-semibold mb-3">
              Check Your Email
            </h2>
            <p className="text-gray-600 text-sm mb-6 max-w-sm mx-auto">
              If an account exists with <span className="font-medium">{email}</span>,
              you will receive a password reset link shortly.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-blue-500 font-medium hover:text-blue-600 transition-colors"
            >
              <ArrowLeft size={16} />
              Back to Login
            </Link>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail size={24} className="text-blue-500" />
              </div>
              <h2 className="text-gray-900 text-2xl font-semibold mb-2">
                Forgot Password?
              </h2>
              <p className="text-gray-500 text-sm">
                No worries, we'll send you reset instructions.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="bg-white/60 border-gray-200 placeholder:text-gray-400 h-12 rounded-xl text-gray-700 focus:border-gray-300 focus:ring-1 focus:ring-gray-300"
                />
              </div>

              {error && (
                <p className="text-red-500 text-sm text-center">{error}</p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 bg-[#18181b] hover:bg-[#27272a] text-white font-medium h-12 rounded-xl transition-colors disabled:opacity-50"
              >
                {isSubmitting ? "Sending..." : "Send Reset Link"}
              </button>
            </form>

            <div className="mt-6 text-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-gray-500 text-sm hover:text-gray-700 transition-colors"
              >
                <ArrowLeft size={14} />
                Back to Login
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
