// import { useState } from "react";
// import type { FormEvent } from "react";
// import { useNavigate } from "react-router-dom";
// import { Input } from "@/components/ui/input";
// import { Button } from "@/components/ui/button";

// type Mode = "create" | "join";

// export function OrganizationSetupPage() {
//   const [mode, setMode] = useState<Mode>("create");
//   const [orgName, setOrgName] = useState("");
//   const [orgId, setOrgId] = useState("");
//   const [error, setError] = useState<string | null>(null);
//   const [isSubmitting, setIsSubmitting] = useState(false);

//   const navigate = useNavigate();

//   const handleCreateSubmit = (e: FormEvent) => {
//     e.preventDefault();
//     setError(null);

//     if (!orgName.trim()) {
//       setError("El nombre de la organización es obligatorio.");
//       return;
//     }

//     setIsSubmitting(true);

//     // TODO: llamar al endpoint de creación de organización
//     // Por ahora sólo simulamos:
//     setTimeout(() => {
//       console.log("Crear organización:", { name: orgName.trim() });
//       setIsSubmitting(false);
//       // Cuando exista dashboard, seguramente: navigate("/dashboard");
//     }, 500);
//   };

//   const handleJoinSubmit = (e: FormEvent) => {
//     e.preventDefault();
//     setError(null);

//     if (!orgId.trim()) {
//       setError("El ID de la organización es obligatorio.");
//       return;
//     }

//     setIsSubmitting(true);

//     // TODO: llamar al endpoint para unirse a una organización existente
//     setTimeout(() => {
//       console.log("Unirse a organización:", { organizationId: orgId.trim() });
//       setIsSubmitting(false);
//       // Cuando exista dashboard, seguramente: navigate("/dashboard");
//     }, 500);
//   };

//   const renderForm = () => {
//     if (mode === "create") {
//       return (
//         <form className="space-y-5" onSubmit={handleCreateSubmit}>
//           <div className="space-y-2">
//             <label className="text-sm font-medium text-zinc-700">
//               Nombre de la organización
//             </label>
//             <Input
//               value={orgName}
//               onChange={(e) => setOrgName(e.target.value)}
//               placeholder="Por ejemplo, Aether Labs"
//               className="h-12 rounded-2xl bg-white/60 border-gray-200 text-gray-700 placeholder:text-gray-400 focus:border-gray-300 focus:ring-1 focus:ring-gray-300"
//             />
//             <p className="text-xs text-zinc-500">
//               Puedes cambiar el nombre o añadir más detalles más adelante.
//             </p>
//           </div>

//           {error && (
//             <p className="text-sm text-red-500">
//               {error}
//             </p>
//           )}

//           <Button
//             type="submit"
//             disabled={isSubmitting}
//             className="w-full h-12 rounded-2xl bg-[#0B0D10] text-white text-sm font-semibold tracking-wide shadow-[0_18px_45px_rgba(15,23,42,0.45)] hover:bg-[#111827] hover:shadow-[0_22px_55px_rgba(15,23,42,0.55)] transition-all duration-150 active:translate-y-px"
//           >
//             {isSubmitting ? "Creando..." : "Crear organización"}
//           </Button>
//         </form>
//       );
//     }

//     // mode === "join"
//     return (
//       <form className="space-y-5" onSubmit={handleJoinSubmit}>
//         <div className="space-y-2">
//           <label className="text-sm font-medium text-zinc-700">
//             ID de la organización
//           </label>
//           <Input
//             value={orgId}
//             onChange={(e) => setOrgId(e.target.value)}
//             placeholder="Pega aquí el ID que te han compartido"
//             className="h-12 rounded-2xl bg-white/60 border-gray-200 text-gray-700 placeholder:text-gray-400 focus:border-gray-300 focus:ring-1 focus:ring-gray-300"
//           />
//           <p className="text-xs text-zinc-500">
//             Pide a alguien de tu equipo que te comparta el ID de organización.
//           </p>
//         </div>

//         {error && (
//           <p className="text-sm text-red-500">
//             {error}
//           </p>
//         )}

//         <Button
//           type="submit"
//           disabled={isSubmitting}
//           className="w-full h-12 rounded-2xl bg-[#0B0D10] text-white text-sm font-semibold tracking-wide shadow-[0_18px_45px_rgba(15,23,42,0.45)] hover:bg-[#111827] hover:shadow-[0_22px_55px_rgba(15,23,42,0.55)] transition-all duration-150 active:translate-y-px"
//         >
//           {isSubmitting ? "Uniéndote..." : "Unirse a organización"}
//         </Button>
//       </form>
//     );
//   };

//   return (
//     <div className="min-h-screen flex flex-col">
//       {/* Logo superior */}
//       <header className="px-6 pt-6">
//         <div className="text-2xl font-semibold tracking-tight text-zinc-700">
//           aether<span className="text-zinc-400">.</span>
//         </div>
//       </header>

//       {/* Contenido centrado */}
//       <main className="flex-1 flex items-center justify-center px-4 pb-10">
//         <div className="w-full max-w-xl bg-white/40 border border-white/60 backdrop-blur-3xl rounded-3xl shadow-xl px-7 py-8 md:px-10 md:py-10">
//           {/* Step label */}
//           <p className="text-xs font-medium uppercase tracking-[0.25em] text-zinc-500 mb-3">
//             Step 3 of 3
//           </p>

//           {/* Título y subtítulo */}
//           <div className="mb-6">
//             <h1 className="text-2xl md:text-3xl font-semibold text-zinc-800">
//               Elige tu espacio de trabajo
//             </h1>
//             <p className="mt-2 text-sm text-zinc-500">
//               Crea una nueva organización para tu equipo o únete a una existente
//               con el ID que te hayan compartido.
//             </p>
//           </div>

//           {/* Toggle de modo (Create / Join) */}
//           <div className="mb-6">
//             <div className="inline-flex rounded-full bg-white/60 p-1 shadow-sm border border-white/70">
//               <button
//                 type="button"
//                 onClick={() => {
//                   setMode("create");
//                   setError(null);
//                 }}
//                 className={`px-4 py-1.5 text-xs md:text-sm rounded-full transition-all ${
//                   mode === "create"
//                     ? "bg-white shadow-sm text-zinc-900"
//                     : "text-zinc-500 hover:text-zinc-700"
//                 }`}
//               >
//                 Crear organización
//               </button>
//               <button
//                 type="button"
//                 onClick={() => {
//                   setMode("join");
//                   setError(null);
//                 }}
//                 className={`px-4 py-1.5 text-xs md:text-sm rounded-full transition-all ${
//                   mode === "join"
//                     ? "bg-white shadow-sm text-zinc-900"
//                     : "text-zinc-500 hover:text-zinc-700"
//                 }`}
//               >
//                 Unirse a una organización
//               </button>
//             </div>
//           </div>

//           {/* Formulario dinámico */}
//           <div className="mb-7">
//             {renderForm()}
//           </div>

//           {/* Botón Back */}
//           <div className="flex items-center justify-between gap-4">
//             <Button
//               type="button"
//               variant="outline"
//               onClick={() => navigate("/connect-github")}
//               className="h-10 rounded-2xl border-white/60 bg-white/40 backdrop-blur-xl text-xs md:text-sm text-zinc-700 hover:bg-white/80 hover:text-zinc-900"
//             >
//               Volver al paso anterior
//             </Button>

//             {/* Aquí podríamos añadir más adelante un botón de “Omitir por ahora” si encaja */}
//           </div>
//         </div>
//       </main>
//     </div>
//   );
// }

import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { organizationApi } from "@/modules/organization/api/organizationApi";
import { useOrganization } from "@/modules/organization/context/OrganizationContext";

type Mode = "create" | "join";

export const OrganizationSetupPage = () => {
  const [mode, setMode] = useState<Mode>("create");
  const [orgName, setOrgName] = useState("");
  const [orgId, setOrgId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();
  const { refetch: refetchOrganizations } = useOrganization();

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!orgName.trim()) {
      setError("Organization name is required.");
      return;
    }

    setIsSubmitting(true);

    try {
      const org = await organizationApi.createOrganization(orgName.trim());
      // Store the organization ID for later use
      localStorage.setItem("currentOrganizationId", org.id);
      // Refetch organizations so the context picks up the new org
      await refetchOrganizations();
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create organization");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!orgId.trim()) {
      setError("Organization ID is required.");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await organizationApi.joinOrganization(orgId.trim());
      // Store the organization ID for later use
      localStorage.setItem("currentOrganizationId", result.organization.id);
      // Refetch organizations so the context picks up the joined org
      await refetchOrganizations();
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join organization");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderForm = () => {
    if (mode === "create") {
      return (
        <form className="w-full space-y-5" onSubmit={handleCreateSubmit}>
          <div className="space-y-2 text-left w-full">
            <label className="text-sm font-medium text-gray-800">
              Organization name
            </label>
            <Input
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="For example, Aether Labs"
              className="h-12 rounded-2xl bg-white/60 border-gray-200 text-gray-700 placeholder:text-gray-400 focus:border-gray-300 focus:ring-1 focus:ring-gray-300"
            />
            <p className="text-xs text-gray-500">
              You can change the name or add more details later.
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-500 text-left w-full">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-12 rounded-2xl bg-[#0B0D10] text-white text-sm font-semibold tracking-wide shadow-[0_18px_45px_rgba(15,23,42,0.45)] hover:bg-[#111827] hover:shadow-[0_22px_55px_rgba(15,23,42,0.55)] transition-all duration-150 active:translate-y-px"
          >
            {isSubmitting ? "Creating..." : "Create organization"}
          </Button>
        </form>
      );
    }

    // mode === "join"
    return (
      <form className="w-full space-y-5" onSubmit={handleJoinSubmit}>
        <div className="space-y-2 text-left w-full">
          <label className="text-sm font-medium text-gray-800">
            Organization ID
          </label>
          <Input
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            placeholder="Paste here the ID you were given"
            className="h-12 rounded-2xl bg-white/60 border-gray-200 text-gray-700 placeholder:text-gray-400 focus:border-gray-300 focus:ring-1 focus:ring-gray-300"
          />
          <p className="text-xs text-gray-500">
            Ask someone from your team to share the organization ID with you.
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-500 text-left w-full">
            {error}
          </p>
        )}

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-12 rounded-2xl bg-[#0B0D10] text-white text-sm font-semibold tracking-wide shadow-[0_18px_45px_rgba(15,23,42,0.45)] hover:bg-[#111827] hover:shadow-[0_22px_55px_rgba(15,23,42,0.55)] transition-all duration-150 active:translate-y-px"
        >
          {isSubmitting ? "Joining..." : "Join organization"}
        </Button>
      </form>
    );
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
      <div className="w-[420px] bg-[#fdfdfd] rounded-[32px] shadow-2xl p-10 flex flex-col items-center relative">
        {/* Step label */}
        <p className="text-[#a1a1aa] text-[13px] font-medium tracking-wide uppercase mb-1">
          Step 3 of 3
        </p>

        {/* Title */}
        <h2 className="text-[#18181b] text-[22px] font-semibold mb-3 mt-2">
          Choose your workspace
        </h2>

        {/* Subtitle */}
        <p className="text-sm text-[#71717a] mb-6">
          Create a new organization for your team or join an existing one using
          the ID you&apos;ve been given.
        </p>

        {/* Toggle */}
        <div className="mb-7">
          <div className="inline-flex rounded-full bg-[#f4f4f5] p-1 shadow-inner border border-[#e4e4e7]">
            <button
              type="button"
              onClick={() => {
                setMode("create");
                setError(null);
              }}
              className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all ${mode === "create"
                  ? "bg-white shadow-sm text-[#18181b]"
                  : "text-[#71717a] hover:text-[#18181b]"
                }`}
            >
              Create organization
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("join");
                setError(null);
              }}
              className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all ${mode === "join"
                  ? "bg-white shadow-sm text-[#18181b]"
                  : "text-[#71717a] hover:text-[#18181b]"
                }`}
            >
              Join an organization
            </button>
          </div>
        </div>

        {/* Dynamic form */}
        <div className="w-full mb-8">{renderForm()}</div>

        {/* Bottom navigation */}
        <div className="w-full flex justify-start mt-auto">
          <Button
            variant="ghost"
            onClick={() => navigate("/connect-github")}
            className="text-[#3b82f6] bg-[#eff6ff] hover:bg-[#dbeafe] text-xs font-medium px-5 py-2 h-9 rounded-xl transition-colors border border-[#dbeafe]"
          >
            Back
          </Button>
        </div>
      </div>
    </div>
  );
};
