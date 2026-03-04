import { useState, useRef, useEffect } from 'react';
import { Plus, ChevronDown } from 'lucide-react';
import { useOrganization } from '../context/OrganizationContext';
import { OrganizationSetupModal } from './OrganizationSetupModal';

export function OrganizationSwitcher() {
  const { currentOrganization, organizations, setCurrentOrganization } = useOrganization();
  const [isOpen, setIsOpen] = useState(false);
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  if (!currentOrganization) return null;

  const otherOrganizations = organizations.filter(org => org.id !== currentOrganization.id);

  const handleAddOrganization = () => {
    setIsOpen(false);
    setIsSetupModalOpen(true);
  };

  return (
    <>
      <div className="relative" ref={containerRef}>
        {/* Trigger button - stays in document flow */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`
            flex items-center gap-3 px-3 py-2
            bg-white/70 dark:bg-zinc-900/70 backdrop-blur-2xl
            border border-white/60 dark:border-white/[0.08]
            shadow-[0_2px_20px_-4px_rgba(0,0,0,0.1),0_0_0_1px_rgba(255,255,255,0.5)_inset]
            dark:shadow-[0_2px_20px_-4px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.05)_inset]
            hover:bg-white/80 dark:hover:bg-zinc-900/80
            transition-all duration-200
            ${isOpen ? 'rounded-t-[20px] rounded-b-none' : 'rounded-full'}
          `}
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-zinc-600 dark:to-zinc-700 flex items-center justify-center text-xs font-semibold text-gray-600 dark:text-gray-200 shadow-sm">
            {currentOrganization.name.substring(0, 2).toUpperCase()}
          </div>
          <span className="text-[13px] font-medium text-gray-800 dark:text-gray-100 truncate max-w-[140px]">
            {currentOrganization.name}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform duration-300 ease-out ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Expanded dropdown - absolutely positioned */}
        <div
          className={`
            absolute top-full right-0 z-50 min-w-full
            bg-white/70 dark:bg-zinc-900/70 backdrop-blur-2xl
            border border-t-0 border-white/60 dark:border-white/[0.08]
            shadow-[0_8px_32px_-4px_rgba(0,0,0,0.12),0_0_0_1px_rgba(255,255,255,0.5)_inset]
            dark:shadow-[0_8px_32px_-4px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.05)_inset]
            rounded-b-[20px] overflow-hidden
            origin-top
            transition-all duration-[400ms] ease-[cubic-bezier(0.32,0.72,0,1)]
            ${isOpen
              ? 'opacity-100 scale-y-100 translate-y-0'
              : 'opacity-0 scale-y-[0.8] -translate-y-1 pointer-events-none'
            }
          `}
        >
          {/* Other organizations */}
          {otherOrganizations.length > 0 && (
            <div className="py-1.5 px-1.5">
              {otherOrganizations.map((org, index) => (
                <button
                  key={org.id}
                  onClick={() => {
                    setCurrentOrganization(org);
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-2.5 py-2 rounded-[12px] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] active:bg-black/[0.06] dark:active:bg-white/[0.08] transition-colors duration-100"
                  style={{
                    transitionDelay: isOpen ? `${index * 30}ms` : '0ms',
                  }}
                >
                  <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-zinc-700 flex items-center justify-center text-[10px] font-semibold text-gray-500 dark:text-gray-300">
                    {org.name.substring(0, 2).toUpperCase()}
                  </div>
                  <span className="flex-1 text-[13px] font-medium text-gray-700 dark:text-gray-300 text-left truncate">
                    {org.name}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Separator */}
          {otherOrganizations.length > 0 && (
            <div className="mx-3 h-px bg-gradient-to-r from-transparent via-black/[0.06] dark:via-white/[0.06] to-transparent" />
          )}

          {/* Add organization - centered + button */}
          <div className="py-3 flex justify-center">
            <button
              onClick={handleAddOrganization}
              className="w-9 h-9 rounded-full bg-gray-100/80 dark:bg-white/[0.06] hover:bg-gray-200/80 dark:hover:bg-white/[0.1] active:bg-gray-300/60 dark:active:bg-white/[0.12] border border-gray-200/60 dark:border-white/[0.08] flex items-center justify-center transition-all duration-150 hover:scale-105 active:scale-95"
            >
              <Plus className="w-4 h-4 text-gray-500 dark:text-gray-400" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      {/* Setup Modal */}
      <OrganizationSetupModal
        isOpen={isSetupModalOpen}
        onClose={() => setIsSetupModalOpen(false)}
      />
    </>
  );
}
