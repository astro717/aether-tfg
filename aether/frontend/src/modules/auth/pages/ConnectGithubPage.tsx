import { useNavigate } from "react-router-dom";
import { Github } from "lucide-react";
import { Button } from "@/components/ui/button";

export const ConnectGithubPage = () => {
  const navigate = useNavigate();

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
      <div className="w-[420px] bg-[#fdfdfd] rounded-[32px] shadow-2xl p-10 flex flex-col items-center relative">
        {/* Step label */}
        <p className="text-[#a1a1aa] text-[13px] font-medium tracking-wide uppercase mb-1">
          Step 2 of 3
        </p>

        {/* Title */}
        <h2 className="text-[#18181b] text-[22px] font-semibold mb-8 mt-2">
          Connect with Github
        </h2>

        {/* Github Logo Circle */}
        <div className="w-[120px] h-[120px] rounded-full bg-[#18181b] flex items-center justify-center mb-6 shadow-lg">
          <Github fill="white" size={75} className="text-white translate-y-1" />
        </div>

        {/* Connect Link */}
        <button
          onClick={() => console.log("GitHub connect clicked")}
          className="text-[#3b82f6] hover:text-[#2563eb] text-[15px] underline underline-offset-4 decoration-1 font-medium mb-12 transition-colors"
        >
          Connect GitHub
        </button>

        {/* Bottom Back Button */}
        <div className="w-full flex justify-start mt-auto">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="text-[#3b82f6] bg-[#eff6ff] hover:bg-[#dbeafe] text-xs font-medium px-5 py-2 h-9 rounded-xl transition-colors border border-[#dbeafe]"
          >
            Back
          </Button>
        </div>
      </div>
    </div>
  );
};
