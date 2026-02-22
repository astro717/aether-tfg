import { useState, useEffect } from 'react';
import { ClipboardCheck, Users, ChevronLeft, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { TaskValidationList } from '../components/TaskValidationList';
import { ManagerUsersList } from '../components/ManagerUsersList';
import { AnalyticsDashboard } from '../components/AnalyticsDashboard';
import { AIReportModal } from '../components/AIReportModal';
import { useOrganization } from '../../organization/context/OrganizationContext';
import { managerApi } from '../api/managerApi';

type TabType = 'validation' | 'users' | 'analytics';

export function ManagerZonePage() {
  const [activeTab, setActiveTab] = useState<TabType>('analytics');
  const [showAIModal, setShowAIModal] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const { currentOrganization } = useOrganization();

  // Fetch count on mount and listen to refresh event
  useEffect(() => {
    const fetchCount = async () => {
      if (currentOrganization?.id) {
        try {
          const tasks = await managerApi.getPendingValidationTasks(currentOrganization.id);
          setPendingCount(tasks.length);
        } catch (e) {
          console.error("Error fetching pending validation count:", e);
        }
      }
    };

    fetchCount();

    // Refresh count if a task is validated/rejected
    const handleRefresh = () => fetchCount();
    window.addEventListener('refreshPendingValidation', handleRefresh);
    return () => window.removeEventListener('refreshPendingValidation', handleRefresh);
  }, [currentOrganization?.id]);

  const handleTabChange = (newTab: TabType) => {
    // If we're leaving the validation tab, refresh the global notification counts
    if (activeTab === 'validation' && newTab !== 'validation') {
      window.dispatchEvent(new Event('refreshPendingValidation'));
    }
    setActiveTab(newTab);
  };

  const tabs = [
    {
      id: 'analytics' as TabType,
      label: 'Analytics',
      icon: BarChart3,
    },
    {
      id: 'validation' as TabType,
      label: 'Task Validation',
      icon: ClipboardCheck,
      hasNotification: pendingCount > 0,
    },
    {
      id: 'users' as TabType,
      label: 'Team Members',
      icon: Users,
    },
  ];

  return (
    <>
      <div className="h-full flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 dark:from-zinc-900 dark:to-zinc-950 overflow-auto">
        {/* Header */}
        <div className="flex-shrink-0 px-8 pt-8 pb-6">
          <div className="flex items-center gap-4 mb-6">
            <Link
              to="/dashboard"
              className="p-2 rounded-xl bg-white/60 dark:bg-zinc-800/60 backdrop-blur-sm border border-white/20 dark:border-zinc-700/50 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Manager Zone
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {currentOrganization?.name}
              </p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`
                    flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
                    transition-all duration-200
                    ${isActive
                      ? 'bg-white dark:bg-zinc-800 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-zinc-800/50'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {tab.hasNotification && (
                    <span className="w-2 h-2 rounded-full bg-blue-500 ml-1"></span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 px-8 pb-8 overflow-auto">
          {activeTab === 'analytics' && (
            <AnalyticsDashboard onOpenAIReport={() => setShowAIModal(true)} />
          )}
          {activeTab === 'validation' && <TaskValidationList />}
          {activeTab === 'users' && <ManagerUsersList />}
        </div>
      </div>

      {/* AI Report Modal */}
      <AIReportModal
        isOpen={showAIModal}
        onClose={() => setShowAIModal(false)}
      />
    </>
  );
}
