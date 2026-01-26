import { useState } from 'react';
import { useOrganization } from '../context/OrganizationContext';

export function OrganizationSwitcher() {
  const { currentOrganization, organizations, setCurrentOrganization } = useOrganization();
  const [isOpen, setIsOpen] = useState(false);

  if (!currentOrganization) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-white/60 backdrop-blur-xl border border-white/50 rounded-full px-4 py-2 flex items-center gap-3 shadow-sm hover:bg-white/80 transition-all"
      >
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
          {currentOrganization.name.substring(0, 2).toUpperCase()}
        </div>
        <span className="text-sm font-medium text-gray-700 pr-1">
          {currentOrganization.name}
        </span>
      </button>

      {isOpen && organizations.length > 1 && (
        <div className="absolute top-full mt-2 right-0 bg-white rounded-lg shadow-xl border border-gray-200 min-w-[200px] z-50">
          {organizations.map(org => (
            <button
              key={org.id}
              onClick={() => {
                setCurrentOrganization(org);
                setIsOpen(false);
              }}
              className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                org.id === currentOrganization.id ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
              }`}
            >
              {org.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
