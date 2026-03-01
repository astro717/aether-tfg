import { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  FileText,
  Users,
  AlertTriangle,
  Loader2,
  Calendar,
  ChevronRight,
  Copy,
  Check,
  CheckCircle,
  RefreshCw,
  Download,
  BarChart3,
  ArrowLeft,
} from 'lucide-react';
import { useOrganization } from '../../organization/context/OrganizationContext';
import { managerApi, type AIReport, type AIReportRequest, type ReportAvailability } from '../api/managerApi';
import { generateManagerReportPDF } from '../../../utils/pdfGenerator';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  RadarMetricChart,
  ScatterCycleChart,
  ThroughputChart,
} from '../../../components/charts';
import {
  SparklineCard,
  SmoothCFDChart,
  InvestmentSunburst,
  WorkloadHeatmap,
  PredictiveBurndownChart,
} from './charts';

interface AIReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ReportType = 'weekly_organization' | 'user_performance' | 'bottleneck_prediction';
type PeriodType = 'week' | 'month' | 'quarter';

const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'Last 3 Months' },
];

interface ReportOption {
  type: ReportType;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  gradient: string;
}

const reportOptions: ReportOption[] = [
  {
    type: 'weekly_organization',
    title: 'Weekly Organization Report',
    description: 'Comprehensive overview of team productivity, completed milestones, and upcoming priorities.',
    icon: <Calendar className="w-6 h-6" />,
    color: 'text-blue-500',
    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    type: 'user_performance',
    title: 'Performance Analysis',
    description: 'Deep dive into individual or team member contributions, task completion rates, and trends.',
    icon: <Users className="w-6 h-6" />,
    color: 'text-purple-500',
    gradient: 'from-purple-500 to-pink-500',
  },
  {
    type: 'bottleneck_prediction',
    title: 'Bottleneck Prediction',
    description: 'AI-powered analysis of potential blockers, resource constraints, and risk areas.',
    icon: <AlertTriangle className="w-6 h-6" />,
    color: 'text-amber-500',
    gradient: 'from-amber-500 to-orange-500',
  },
];

// Helper function to generate period identifier
function getPeriodIdentifier(periodType: PeriodType): string {
  const now = new Date();

  if (periodType === 'week') {
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    return `${now.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
  } else if (periodType === 'month') {
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  } else if (periodType === 'quarter') {
    const quarter = Math.floor(now.getMonth() / 3) + 1;
    return `${now.getFullYear()}-Q${quarter}`;
  }
  return 'all';
}

// Helper function to get dynamic report title
function getReportTitle(type: ReportType, period: PeriodType): string {
  const baseOption = reportOptions.find(o => o.type === type);
  if (!baseOption) return 'Report';

  if (type === 'weekly_organization') {
    switch (period) {
      case 'week':
        return 'Weekly Organization Report';
      case 'month':
        return 'Monthly Organization Report';
      case 'quarter':
        return 'Quarterly Organization Report';
      default:
        return baseOption.title;
    }
  }

  return baseOption.title;
}

// Helper function to get readable date range
function getDateRangeString(period: PeriodType): string {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };

  let start: Date;
  let end: Date;

  switch (period) {
    case 'week': {
      // Assuming week starts on Monday
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      start = new Date(now.setDate(diff));
      end = new Date(now);
      end.setDate(start.getDate() + 6);
      break;
    }
    case 'month': {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
    }
    case 'quarter': {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), currentQuarter * 3, 1);
      end = new Date(now.getFullYear(), (currentQuarter * 3) + 3, 0);
      break;
    }
    default:
      return '';
  }

  return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
}

export function AIReportModal({ isOpen, onClose }: AIReportModalProps) {
  const { currentOrganization } = useOrganization();
  const [selectedType, setSelectedType] = useState<ReportType | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('week');
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; username: string; avatar_color: string; role_in_org: string }>>([]);
  const [report, setReport] = useState<AIReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [availableReports, setAvailableReports] = useState<ReportAvailability[]>([]);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  // Animation state
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    } else {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setSelectedType(null);
        setReport(null);
        setError(null);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Fetch team members when modal opens
  useEffect(() => {
    if (isOpen && currentOrganization?.id) {
      managerApi.getTeamMembers(currentOrganization.id)
        .then(setTeamMembers)
        .catch(console.error);
    }
  }, [isOpen, currentOrganization?.id]);

  // Check report availability when parameters change
  useEffect(() => {
    const checkAvailability = async () => {
      if (!currentOrganization?.id || !selectedPeriod) return;

      setCheckingAvailability(true);
      try {
        const period = getPeriodIdentifier(selectedPeriod);
        const result = await managerApi.checkReportAvailability(currentOrganization.id, period);
        setAvailableReports(result.available);
      } catch (err) {
        console.error('Failed to check availability:', err);
        setAvailableReports([]);
      } finally {
        setCheckingAvailability(false);
      }
    };

    checkAvailability();
  }, [currentOrganization?.id, selectedPeriod]);

  // Helper to check if current selection has an existing report
  const hasExistingReport = (): boolean => {
    if (!selectedType) return false;
    return availableReports.some(
      r => r.type === selectedType &&
        (selectedType === 'user_performance' ? r.userId === selectedUserId : !r.userId)
    );
  };

  const handleGenerateReport = async (forceRegenerate: boolean = false) => {
    if (!selectedType || !currentOrganization?.id) return;

    setLoading(true);
    setError(null);

    try {
      const period = getPeriodIdentifier(selectedPeriod);
      const request: AIReportRequest = {
        type: selectedType,
        organizationId: currentOrganization.id,
        period,
        forceRegenerate,
        ...(selectedType === 'user_performance' && selectedUserId ? { userId: selectedUserId } : {}),
      };

      const result = await managerApi.generateAIReport(request);
      setReport(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyReport = () => {
    if (!report) return;

    const text = `# ${reportOptions.find(o => o.type === selectedType)?.title}\n\n${report.summary}\n\n${report.sections?.map(s => `## ${s.title}\n\n${s.content}`).join('\n\n') || ''}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPDF = async () => {
    if (!report || !selectedType || !currentOrganization) return;

    setDownloadingPdf(true);
    setIsExportingPDF(true);

    const reportOption = reportOptions.find(o => o.type === selectedType);
    const reportTypeName = reportOption?.title || 'Report';
    const periodLabel = PERIOD_OPTIONS.find(p => p.value === selectedPeriod)?.label || selectedPeriod;

    // Delay to allow Recharts to re-render with PDF-optimized layout
    setTimeout(async () => {
      try {
        await generateManagerReportPDF(
          report,
          currentOrganization.name,
          periodLabel,
          reportTypeName
        );
      } catch (error) {
        console.error('Failed to generate PDF:', error);
        setError('Failed to generate PDF. Please try again.');
      } finally {
        setDownloadingPdf(false);
        setIsExportingPDF(false);
      }
    }, 600);
  };


  const markdownComponents = {
    p: ({ node, ...props }: any) => <p className="mb-3 last:mb-0" {...props} />,
    ul: ({ node, ...props }: any) => <ul className="list-disc pl-5 mb-3 space-y-1 marker:text-blue-500" {...props} />,
    ol: ({ node, ...props }: any) => <ol className="list-decimal pl-5 mb-3 space-y-1 marker:text-blue-500" {...props} />,
    li: ({ node, ...props }: any) => <li {...props} />,
    strong: ({ node, ...props }: any) => <strong className="font-semibold text-gray-900 dark:text-gray-100" {...props} />,
    h1: ({ node, ...props }: any) => <h1 className="text-lg font-bold text-gray-900 dark:text-white mt-4 mb-2" {...props} />,
    h2: ({ node, ...props }: any) => <h2 className="text-base font-bold text-gray-900 dark:text-white mt-3 mb-2" {...props} />,
    h3: ({ node, ...props }: any) => <h3 className="text-sm font-bold text-gray-900 dark:text-white mt-2 mb-1" {...props} />,
    code: ({ node, className, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(className || '');
      const isInline = !match && !String(children).includes('\n');
      return isInline
        ? <code className="bg-gray-100 dark:bg-zinc-800 flex-shrink-0 text-blue-600 dark:text-blue-400 px-1 py-0.5 rounded text-[11px] font-mono whitespace-nowrap" {...props}>{children}</code>
        : <pre className="bg-gray-100 dark:bg-zinc-800 p-3 rounded-lg text-xs font-mono mb-3 overflow-x-auto text-gray-800 dark:text-gray-200"><code className={className} {...props}>{children}</code></pre>;
    },
    blockquote: ({ node, ...props }: any) => <blockquote className="border-l-2 border-blue-400 pl-3 italic text-gray-500 dark:text-gray-400 my-2" {...props} />,
  };

  if (!isVisible) return null;

  return (
    <div
      className={`
        fixed inset-0 z-50 flex items-center justify-center
        transition-all duration-300
        ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
      `}
    >
      {/* Backdrop with blur */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div
        className={`
          relative w-full max-w-6xl max-h-[90vh] mx-4
          bg-white dark:bg-zinc-900
          rounded-3xl shadow-2xl
          overflow-hidden
          transform transition-all duration-300
          ${isOpen ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}
        `}
      >
        {/* Header */}
        <div className="relative px-8 pt-8 pb-6 bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-cyan-500/10 dark:from-purple-500/20 dark:via-blue-500/20 dark:to-cyan-500/20">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-4">
            {report && (
              <button
                onClick={() => setReport(null)}
                className="p-2 -ml-2 mr-1 rounded-full text-gray-500 hover:text-gray-700 hover:bg-white/50 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-zinc-800/50 transition-all"
                title="Back to options"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="p-3 rounded-2xl bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg shadow-purple-500/30">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                AI Intelligence Report
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Generate data-driven insights for your team
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-8 py-6 max-h-[75vh] overflow-y-auto">
          {!report ? (
            <>
              {/* Period Selection */}
              <div className="space-y-4 mb-6">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                  Select Time Period
                </h3>
                <div className="flex gap-2">
                  {PERIOD_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setSelectedPeriod(option.value)}
                      className={`
                        px-4 py-2 rounded-xl text-sm font-medium
                        transition-all duration-200
                        ${selectedPeriod === option.value
                          ? 'bg-blue-500 text-white shadow-md'
                          : 'bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
                        }
                      `}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Report Type Selection */}
              <div className="space-y-4 mb-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                    Select Report Type
                  </h3>
                  {checkingAvailability && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Checking availability...
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {reportOptions.map((option) => {
                    const reportExists = selectedType === option.type && hasExistingReport();
                    const title = getReportTitle(option.type, selectedPeriod);
                    return (
                      <button
                        key={option.type}
                        onClick={() => {
                          setSelectedType(option.type);
                          if (option.type !== 'user_performance') {
                            setSelectedUserId(null);
                          }
                        }}
                        className={`
                          relative p-5 rounded-2xl text-left
                          transition-all duration-300
                          ${selectedType === option.type
                            ? 'bg-gradient-to-br ' + option.gradient + ' text-white shadow-lg scale-[1.02]'
                            : 'bg-gray-50 dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700'
                          }
                        `}
                      >
                        {reportExists && (
                          <div className="absolute top-3 right-3">
                            <CheckCircle className="w-5 h-5 text-green-400" />
                          </div>
                        )}
                        <div className={`mb-3 ${selectedType === option.type ? 'text-white' : option.color}`}>
                          {option.icon}
                        </div>
                        <h4 className={`font-semibold mb-1 ${selectedType === option.type ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                          {title}
                        </h4>
                        <p className={`text-xs ${selectedType === option.type ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>
                          {option.description}
                        </p>
                        {reportExists && selectedType === option.type && (
                          <p className="text-xs mt-2 text-white/90 font-medium">
                            ✓ Report available
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* User Selection (for Performance Analysis) */}
              {selectedType === 'user_performance' && (
                <div className="space-y-4 mb-6 animate-in slide-in-from-top-2 duration-300">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                    Select Team Member (Optional)
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelectedUserId(null)}
                      className={`
                        px-4 py-2 rounded-xl text-sm font-medium
                        transition-all duration-200
                        ${!selectedUserId
                          ? 'bg-purple-500 text-white'
                          : 'bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
                        }
                      `}
                    >
                      All Team
                    </button>
                    {teamMembers.map((member) => (
                      <button
                        key={member.id}
                        onClick={() => setSelectedUserId(member.id)}
                        className={`
                          px-4 py-2 rounded-xl text-sm font-medium
                          transition-all duration-200
                          ${selectedUserId === member.id
                            ? 'bg-purple-500 text-white'
                            : 'bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
                          }
                        `}
                      >
                        {member.username}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}
            </>
          ) : (
            /* Report Display */
            <div className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
              {/* Report Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl bg-gradient-to-r ${reportOptions.find(o => o.type === selectedType)?.gradient} text-white`}>
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {reportOptions.find(o => o.type === selectedType) && selectedType ? getReportTitle(selectedType, selectedPeriod) : ''}
                      </h3>
                      {report.cached && (
                        <span className="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 text-xs font-medium">
                          Cached
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <p className="text-xs font-medium text-gray-900 dark:text-gray-300">
                        {getDateRangeString(selectedPeriod)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {report.cached ? 'Retrieved from cache' : 'Generated just now'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownloadPDF}
                    disabled={downloadingPdf}
                    className={`
                      flex items-center gap-2 px-3 py-2 rounded-xl text-white shadow-md transition-all text-sm font-medium
                      ${downloadingPdf
                        ? 'bg-gradient-to-r from-purple-400 to-blue-400 cursor-not-allowed opacity-90'
                        : 'bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 hover:shadow-lg'
                      }
                    `}
                  >
                    {downloadingPdf ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating PDF...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Download PDF
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleCopyReport}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors text-sm"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                  <button
                    onClick={() => setReport(null)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors text-sm"
                  >
                    New Report
                  </button>
                </div>
              </div>

              {/* Summary */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-gray-50 to-gray-100 dark:from-zinc-800/50 dark:to-zinc-800">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Executive Summary
                </h4>
                <div className="text-gray-600 dark:text-gray-300 leading-relaxed max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                    {report.summary}
                  </ReactMarkdown>
                </div>
              </div>

              {/* Advanced Charts Section - Conditional rendering by report type */}
              {report.chartData && (
                <div className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-700">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white">
                      <BarChart3 className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Data Visualizations & Metrics
                    </h3>
                  </div>

                  {/* Weekly Organization Report Charts */}
                  {selectedType === 'weekly_organization' && (
                    <>
                      {/* The Pulse - KPI Cards with Sparklines */}
                      {report.chartData.pulse && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-chart-id="pulse-metrics">
                          <SparklineCard
                            title="Velocity"
                            value={report.chartData.pulse.velocityRate?.value ?? 0}
                            unit="%"
                            sparklineData={report.chartData.pulse.velocityRate?.sparkline ?? []}
                            isVelocityRate={true}
                            subtitle="vs previous 7 days"
                          />
                          <SparklineCard
                            title="Cycle Time"
                            value={report.chartData.pulse.cycleTime.value}
                            unit="days"
                            sparklineData={report.chartData.pulse.cycleTime.sparkline}
                            color="green"
                            subtitle="Avg In Progress → Done"
                          />
                          <SparklineCard
                            title="On-Time Delivery"
                            value={report.chartData.pulse.onTimeDelivery?.value ?? 100}
                            unit="%"
                            sparklineData={report.chartData.pulse.onTimeDelivery?.sparkline ?? []}
                            color="amber"
                            subtitle="Met deadlines"
                          />
                          <SparklineCard
                            title="AI Risk Score"
                            value={report.chartData.pulse.riskScore.value}
                            unit="/100"
                            sparklineData={[]}
                            color={report.chartData.pulse.riskScore.value > 60 ? 'red' : report.chartData.pulse.riskScore.value > 30 ? 'amber' : 'green'}
                            subtitle="Probability of delay"
                          />
                        </div>
                      )}

                      {/* Smooth CFD Chart */}
                      {report.chartData.cfd && (
                        <SmoothCFDChart
                          data={report.chartData.cfd}
                          title="Cumulative Flow Diagram"
                          subtitle="Task flow through stages over time"
                        />
                      )}

                      {/* Full-width Investment Distribution */}
                      {report.chartData.investment && (
                        <InvestmentSunburst
                          data={report.chartData.investment}
                          title="Investment Distribution"
                          subtitle="Task allocation by category"
                          pdfMode={isExportingPDF}
                        />
                      )}

                      {/* Full-width Predictive Burndown */}
                      {report.chartData.burndown && (
                        <PredictiveBurndownChart
                          data={report.chartData.burndown}
                          title="Predictive Burndown"
                          subtitle="AI-powered completion forecast"
                        />
                      )}

                      {/* Workload Heatmap */}
                      {report.chartData.heatmap && (
                        <WorkloadHeatmap
                          data={report.chartData.heatmap}
                          title="Team Workload Heatmap"
                          subtitle="Activity intensity per team member"
                        />
                      )}
                    </>
                  )}

                  {/* User Performance Report Charts */}
                  {selectedType === 'user_performance' && (
                    <>
                      {/* Radar Metrics */}
                      {report.chartData.radar && (
                        <RadarMetricChart data={report.chartData.radar} />
                      )}

                      {/* Two-column layout for Cycle Time & Throughput */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {report.chartData.cycleTime && report.chartData.cycleTime.length > 0 && (
                          <ScatterCycleChart data={report.chartData.cycleTime} />
                        )}
                        {report.chartData.throughput && (
                          <ThroughputChart data={report.chartData.throughput} />
                        )}
                      </div>

                      {/* Investment Profile */}
                      {report.chartData.investment && (
                        <InvestmentSunburst
                          data={report.chartData.investment}
                          title="Task Distribution"
                          subtitle="Individual work allocation"
                          pdfMode={isExportingPDF}
                        />
                      )}
                    </>
                  )}

                  {/* Bottleneck Prediction Report Charts */}
                  {selectedType === 'bottleneck_prediction' && (
                    <>
                      {/* The Pulse - Risk Indicators */}
                      {report.chartData.pulse && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <SparklineCard
                            title="AI Risk Score"
                            value={report.chartData.pulse.riskScore.value}
                            unit="/100"
                            sparklineData={[]}
                            color={report.chartData.pulse.riskScore.value > 60 ? 'red' : report.chartData.pulse.riskScore.value > 30 ? 'amber' : 'green'}
                            subtitle="Delay probability"
                          />
                          <SparklineCard
                            title="Cycle Time"
                            value={report.chartData.pulse.cycleTime.value}
                            unit="days"
                            sparklineData={report.chartData.pulse.cycleTime.sparkline}
                            color="amber"
                            subtitle="Current throughput"
                          />
                          <SparklineCard
                            title="On-Time Delivery"
                            value={report.chartData.pulse.onTimeDelivery?.value ?? 100}
                            unit="%"
                            sparklineData={report.chartData.pulse.onTimeDelivery?.sparkline ?? []}
                            color="purple"
                            subtitle="Met deadlines"
                          />
                          <SparklineCard
                            title="Velocity"
                            value={report.chartData.pulse.velocityRate?.value ?? 0}
                            unit="%"
                            sparklineData={report.chartData.pulse.velocityRate?.sparkline ?? []}
                            isVelocityRate={true}
                            subtitle="vs previous 7 days"
                          />
                        </div>
                      )}

                      {/* Smooth CFD */}
                      {report.chartData.cfd && (
                        <SmoothCFDChart
                          data={report.chartData.cfd}
                          title="Flow Analysis"
                          subtitle="Identify bottlenecks in your pipeline"
                        />
                      )}

                      {/* Risk Forecast - Full Width */}
                      {report.chartData.burndown && (
                        <PredictiveBurndownChart
                          data={report.chartData.burndown}
                          title="Risk Forecast"
                          subtitle="Completion probability"
                        />
                      )}

                      {/* Work Distribution - Full Width */}
                      {report.chartData.investment && (
                        <InvestmentSunburst
                          data={report.chartData.investment}
                          title="Work Distribution"
                          subtitle="Identify imbalances"
                          pdfMode={isExportingPDF}
                        />
                      )}

                      {/* Resource Utilization - Full Width */}
                      {report.chartData.heatmap && (
                        <WorkloadHeatmap
                          data={report.chartData.heatmap}
                          title="Resource Utilization"
                          subtitle="Team capacity analysis"
                        />
                      )}

                      {/* Cycle Time Scatterplot - Full Width */}
                      {report.chartData.cycleTime && report.chartData.cycleTime.length > 0 && (
                        <ScatterCycleChart data={report.chartData.cycleTime} />
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Sections */}
              {report.sections?.map((section, index) => (
                <div
                  key={index}
                  className="p-5 rounded-2xl bg-white dark:bg-zinc-800/50 border border-gray-100 dark:border-zinc-700/50"
                >
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <ChevronRight className="w-4 h-4 text-blue-500" />
                    {section.title}
                  </h4>
                  <div className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                      {section.content}
                    </ReactMarkdown>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {!report && (
          <div className="px-8 py-6 bg-gray-50 dark:bg-zinc-800/50 border-t border-gray-100 dark:border-zinc-700/50">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Powered by Aether AI - Reports are generated based on your organization's data
              </p>
              <div className="flex items-center gap-3">
                {hasExistingReport() && (
                  <button
                    onClick={() => handleGenerateReport(true)}
                    disabled={!selectedType || loading}
                    className={`
                      flex items-center gap-2 px-4 py-3 rounded-xl font-medium text-sm
                      transition-all duration-300
                      ${selectedType && !loading
                        ? 'bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-zinc-600'
                        : 'bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                      }
                    `}
                  >
                    <RefreshCw className="w-4 h-4" />
                    Regenerate
                  </button>
                )}
                <button
                  onClick={() => handleGenerateReport(false)}
                  disabled={!selectedType || loading}
                  className={`
                    flex items-center gap-2 px-6 py-3 rounded-xl font-semibold
                    transition-all duration-300
                    ${selectedType && !loading
                      ? 'bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-[1.02]'
                      : 'bg-gray-200 dark:bg-zinc-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                    }
                  `}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      {hasExistingReport() ? 'View Existing Report' : 'Generate Report'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
