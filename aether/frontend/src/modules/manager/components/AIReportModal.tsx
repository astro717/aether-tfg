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
} from 'lucide-react';
import { useOrganization } from '../../organization/context/OrganizationContext';
import { managerApi, type AIReport, type AIReportRequest } from '../api/managerApi';

interface AIReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ReportType = 'weekly_organization' | 'user_performance' | 'bottleneck_prediction';

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

export function AIReportModal({ isOpen, onClose }: AIReportModalProps) {
  const { currentOrganization } = useOrganization();
  const [selectedType, setSelectedType] = useState<ReportType | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; username: string; avatar_color: string; role_in_org: string }>>([]);
  const [report, setReport] = useState<AIReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

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

  const handleGenerateReport = async () => {
    if (!selectedType || !currentOrganization?.id) return;

    setLoading(true);
    setError(null);

    try {
      const request: AIReportRequest = {
        type: selectedType,
        organizationId: currentOrganization.id,
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


  const formatBoldText = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={index} className="font-bold text-gray-900 dark:text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  const formatReportContent = (text: string) => {
    if (!text) return null;
    // Split by numbered list items (e.g. "1. ", "2. ")
    // We use a lookahead to keep the number with the item
    const parts = text.split(/(?=\b\d+\.\s)/g);

    // If no numbering found or just one part, render normally with bold formatting
    if (parts.length <= 1) {
      return formatBoldText(text);
    }

    return (
      <div className="space-y-3">
        {parts.map((part, index) => {
          const trimmedPart = part.trim();
          if (!trimmedPart) return null;

          return (
            <div key={index} className={trimmedPart.match(/^\d+\.\s/) ? "pl-2" : ""}>
              {formatBoldText(trimmedPart)}
            </div>
          );
        })}
      </div>
    );
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
          relative w-full max-w-4xl max-h-[90vh] mx-4
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
        <div className="px-8 py-6 max-h-[60vh] overflow-y-auto">
          {!report ? (
            <>
              {/* Report Type Selection */}
              <div className="space-y-4 mb-6">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                  Select Report Type
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {reportOptions.map((option) => (
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
                      <div className={`mb-3 ${selectedType === option.type ? 'text-white' : option.color}`}>
                        {option.icon}
                      </div>
                      <h4 className={`font-semibold mb-1 ${selectedType === option.type ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                        {option.title}
                      </h4>
                      <p className={`text-xs ${selectedType === option.type ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>
                        {option.description}
                      </p>
                    </button>
                  ))}
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
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {reportOptions.find(o => o.type === selectedType)?.title}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Generated just now
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
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
                <div className="text-gray-600 dark:text-gray-300 leading-relaxed">
                  {formatReportContent(report.summary)}
                </div>
              </div>

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
                  <div className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {formatReportContent(section.content)}
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
              <button
                onClick={handleGenerateReport}
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
                    Generate Report
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
