import { useState, useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { resetPassword } from "../api/authApi";
import { Lock, ArrowLeft, CheckCircle, AlertCircle, Eye, EyeOff } from "lucide-react";

export const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Invalid or missing reset token");
    }
  }, [token]);

  const validatePassword = () => {
    if (password.length < 8) {
      return "Password must be at least 8 characters long";
    }
    if (password !== confirmPassword) {
      return "Passwords do not match";
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validatePassword();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!token) {
      setError("Invalid or missing reset token");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      await resetPassword(token, password);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setIsSubmitting(false);
    }
  };

  const passwordStrength = () => {
    if (password.length === 0) return null;
    if (password.length < 8) return { label: "Too short", color: "bg-red-400" };
    if (password.length < 12) return { label: "Fair", color: "bg-yellow-400" };
    return { label: "Strong", color: "bg-green-400" };
  };

  const strength = passwordStrength();

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
              Password Reset Complete
            </h2>
            <p className="text-gray-600 text-sm mb-6">
              Your password has been successfully reset. You can now log in with your new password.
            </p>
            <button
              onClick={() => navigate("/login")}
              className="w-full bg-[#18181b] hover:bg-[#27272a] text-white font-medium h-12 rounded-xl transition-colors"
            >
              Continue to Login
            </button>
          </div>
        ) : !token ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={32} className="text-red-600" />
            </div>
            <h2 className="text-gray-900 text-2xl font-semibold mb-3">
              Invalid Reset Link
            </h2>
            <p className="text-gray-600 text-sm mb-6">
              This password reset link is invalid or has expired. Please request a new one.
            </p>
            <Link
              to="/forgot-password"
              className="inline-block w-full bg-[#18181b] hover:bg-[#27272a] text-white font-medium h-12 rounded-xl transition-colors leading-[48px]"
            >
              Request New Link
            </Link>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock size={24} className="text-blue-500" />
              </div>
              <h2 className="text-gray-900 text-2xl font-semibold mb-2">
                Set New Password
              </h2>
              <p className="text-gray-500 text-sm">
                Your new password must be at least 8 characters long.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isSubmitting}
                    className="bg-white/60 border-gray-200 placeholder:text-gray-400 h-12 rounded-xl text-gray-700 focus:border-gray-300 focus:ring-1 focus:ring-gray-300 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {strength && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${strength.color} transition-all`}
                        style={{ width: password.length < 8 ? "33%" : password.length < 12 ? "66%" : "100%" }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">{strength.label}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={isSubmitting}
                    className="bg-white/60 border-gray-200 placeholder:text-gray-400 h-12 rounded-xl text-gray-700 focus:border-gray-300 focus:ring-1 focus:ring-gray-300 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <p className="mt-1 text-xs text-red-500">Passwords do not match</p>
                )}
              </div>

              {error && (
                <p className="text-red-500 text-sm text-center">{error}</p>
              )}

              <button
                type="submit"
                disabled={isSubmitting || password.length < 8 || password !== confirmPassword}
                className="mt-2 bg-[#18181b] hover:bg-[#27272a] text-white font-medium h-12 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Resetting..." : "Reset Password"}
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
