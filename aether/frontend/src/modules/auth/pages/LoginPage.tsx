import { Link } from "react-router-dom";
import { LoginForm } from "../components/LoginForm";
import { SocialButtons } from "../components/SocialButtons";

export const LoginPage = () => (
  <div
    className="min-h-screen flex flex-col items-center justify-center"
    style={{
      background:"radial-gradient(ellipse at center, #23282b 0%, #f4f5f7 100%)",
    }}
    // style={{
    //     background: "radial-gradient(circle at center, #f4f5f7 0%, #d8dadf 100%)",
    //     backgroundRepeat: "no-repeat",
    //     backgroundAttachment: "fixed",
    //     backgroundColor: "transparent !important",
    //   }}
      
  >
    {/* Logo outside the card */}
    <h1 className="text-7xl font-light text-[#e3e3e3] mb-12 tracking-wide">
      aether.
    </h1>

    {/* Main card */}
    <div className="w-[500px] bg-white/40 backdrop-blur-3xl rounded-3xl shadow-xl p-8 flex flex-col">
      {/* Title */}
      <h2 className="text-center text-gray-900 text-2xl font-semibold mb-6">
        Login
      </h2>

      {/* Form */}
      <LoginForm />

      {/* Forgot Password Link */}
      <div className="text-center mt-3">
        <Link
          to="/forgot-password"
          className="text-gray-500 text-sm hover:text-gray-700 transition-colors"
        >
          Forgot your password?
        </Link>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-4 my-6">
        <div className="flex-1 border-t border-gray-300"></div>
        <span className="text-gray-600 text-sm">or</span>
        <div className="flex-1 border-t border-gray-300"></div>
      </div>

      {/* Social buttons */}
      <SocialButtons />

      {/* Bottom navigation */}
      <div className="flex justify-between mt-6">
      <button
        onClick={() => (window.location.href = "/")}
        className="text-blue-500 text-sm font-medium px-6 py-2 rounded-xl hover:bg-blue-50 transition-colors"
        >
        Back
        </button>
        {/* <button className="bg-blue-500 text-white text-sm font-medium px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors">
          Log in
        </button> */}
      </div>
    </div>
  </div>
);
