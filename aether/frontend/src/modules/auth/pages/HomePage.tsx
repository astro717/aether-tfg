import { useNavigate } from "react-router-dom";

export const HomePage = () => {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center text-center"
      style={{
        background:
          // "radial-gradient(ellipse at center, #f4f5f7 0%, #23282b 100%)",
          "radial-gradient(ellipse at center, #23282b 0%, #f4f5f7 100%)",
      }}
    >
      {/* Logo */}
      <h1 className="text-8xl font-light text-[#e3e3e3] mb-16 tracking-wide">
        aether.
      </h1>

      {/* Buttons */}
      <div className="flex flex-col gap-6 w-[220px]">
        {/* <button
          onClick={() => navigate("/login")}
          className="h-14 rounded-2xl bg-gray-800 text-[#e3e3e3] text-lg font-medium hover:bg-gray-800 transition-colors shadow-md"
        >
          Log in
        </button> */}
        <button
          onClick={() => navigate("/login")}
          className="
          h-12 w-full rounded-2xl 
          bg-[#0B0D10]
          text-white font-medium tracking-wide
          shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),_0_8px_30px_rgba(0,0,0,0.35)]
          hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),_0_8px_40px_rgba(0,0,0,0.45)]
          hover:bg-[#121418]
          active:translate-y-[1px]
          transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
          "
        >
          Log in
        </button>
        <button
          onClick={() => navigate("/signup")}
          className="
          h-12 w-full rounded-2xl 
          bg-[#7D7D7D]
          text-white font-medium tracking-wide
          shadow-[inset_0_1px_1px_rgba(255,255,255,0.15),_0_8px_30px_rgba(0,0,0,0.35)]
          hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),_0_8px_40px_rgba(0,0,0,0.45)]
          hover:bg-[#8D7D7D]
          active:translate-y-[1px]
          transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
          "
        >
          Sign up
        </button>
      </div>
    </div>
  );
};
