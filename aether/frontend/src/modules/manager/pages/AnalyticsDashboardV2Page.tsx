import { lazy, Suspense } from 'react';
import { useState } from 'react';
import { ChevronLeft, FlaskConical, SplitSquareHorizontal } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useOrganization } from '../../organization/context/OrganizationContext';
import { DashboardSkeleton } from '../components/DashboardSkeleton';
import { AIReportModal } from '../components/AIReportModal';

const AnalyticsDashboardV2 = lazy(() =>
  import('../components/AnalyticsDashboardV2').then((m) => ({ default: m.AnalyticsDashboardV2 }))
);

export function AnalyticsDashboardV2Page() {
  const { currentOrganization } = useOrganization();
  const [showAIModal, setShowAIModal] = useState(false);

  return (
    <>
      <div className="h-full flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 dark:from-zinc-900 dark:to-zinc-950 overflow-auto">
        {/* Header */}
        <div className="flex-shrink-0 px-8 pt-8 pb-6">
          <div className="flex items-center gap-4">
            <Link
              to="/manager"
              className="p-2 rounded-xl bg-white/60 dark:bg-zinc-800/60 backdrop-blur-sm border border-white/20 dark:border-zinc-700/50 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
                  <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                    <FlaskConical size={10} />
                    V2 BETA
                  </span>
                  <Link
                    to="/manager/analytics-v3"
                    className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/20 hover:bg-orange-500/25 transition-colors"
                  >
                    <SplitSquareHorizontal size={10} />
                    Compare V3
                  </Link>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {currentOrganization?.name}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Content */}
        <div className="flex-1 px-8 pb-8 overflow-auto">
          <Suspense fallback={<DashboardSkeleton />}>
            <AnalyticsDashboardV2 onOpenAIReport={() => setShowAIModal(true)} />
          </Suspense>
        </div>
      </div>

      <AIReportModal
        isOpen={showAIModal}
        onClose={() => setShowAIModal(false)}
      />
    </>
  );
}
