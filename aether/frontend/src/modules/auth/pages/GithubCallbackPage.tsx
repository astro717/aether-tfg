import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { connectGithub } from "../api/authApi";
import { useAuth } from "../context/AuthContext";

export const GithubCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 1. Wait for AuthContext to finish loading the user session
    if (authLoading) return;

    // 2. If no user is found after loading, it means the session is lost/invalid
    if (!user) {
      setError("You are not logged in. Please log in and try again.");
      return;
    }

    // 3. Check for specific errors returned by GitHub (e.g. user denied access)
    const errorParam = searchParams.get("error");
    if (errorParam) {
      setError(`GitHub authorization failed: ${searchParams.get("error_description") || errorParam}`);
      return;
    }

    // 4. Check for the authorization code
    const code = searchParams.get("code");
    if (!code) {
      setError("No authorization code received from GitHub");
      return;
    }

    // 5. Attempt to connect the account
    const connectAccount = async () => {
      try {
        await connectGithub(code);
        navigate("/organization-setup");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to connect GitHub account");
      }
    };

    // Prevent double-execution in StrictMode if not careful, but useEffect dep array handles it reasonably.
    // Ideally we should track a 'connecting' state locally to avoid double submission.
    connectAccount();
  }, [searchParams, navigate, user, authLoading]);

  // Handler for valid re-login attempt or retry
  const handleTryAgain = () => {
    if (!user) {
      navigate("/login");
    } else {
      navigate("/connect-github");
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center text-center font-sans"
      style={{
        background: "radial-gradient(circle at center, #5f656d 0%, #dce0e6 100%)",
      }}
    >
      {/* Top logo */}
      <h1 className="text-7xl font-light text-white mb-12 tracking-wide opacity-90">
        aether.
      </h1>

      {/* Main card */}
      <div className="w-[420px] bg-[#fdfdfd] rounded-[32px] shadow-2xl p-10 flex flex-col items-center">
        {error ? (
          <>
            <h2 className="text-[#18181b] text-[22px] font-semibold mb-4">
              Connection Failed
            </h2>
            <p className="text-[#71717a] text-sm mb-8">{error}</p>
            <button
              onClick={handleTryAgain}
              className="text-[#3b82f6] hover:text-[#2563eb] text-[15px] underline underline-offset-4 decoration-1 font-medium transition-colors"
            >
              {!user ? "Go to Login" : "Try Again"}
            </button>
          </>
        ) : (
          <>
            <Loader2 className="w-12 h-12 text-[#3b82f6] animate-spin mb-6" />
            <h2 className="text-[#18181b] text-[22px] font-semibold mb-2">
              Connecting to GitHub...
            </h2>
            <p className="text-[#71717a] text-sm">
              Please wait while we link your account
            </p>
          </>
        )}
      </div>
    </div>
  );
};
