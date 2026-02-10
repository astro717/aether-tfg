import { useState, useEffect } from "react";
import { X, Search, Loader2, GitCommit, AlertCircle, RefreshCw } from "lucide-react";
import { tasksApi, type LinkedCommit } from "../../dashboard/api/tasksApi";

interface LinkCommitModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  repoId: string | null;
  linkedCommitShas: string[]; // Already linked commit SHAs to disable them
  onLinkSuccess: () => void;
}

export function LinkCommitModal({
  isOpen,
  onClose,
  taskId,
  repoId,
  linkedCommitShas,
  onLinkSuccess,
}: LinkCommitModalProps) {
  const [commits, setCommits] = useState<LinkedCommit[]>([]);
  const [filteredCommits, setFilteredCommits] = useState<LinkedCommit[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCommit, setSelectedCommit] = useState<LinkedCommit | null>(null);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null);

  // Fetch commits when modal opens
  useEffect(() => {
    async function fetchCommits() {
      if (!isOpen || !repoId) return;

      try {
        setLoading(true);
        setError(null);
        const fetchedCommits = await tasksApi.getCommitsByRepo(repoId);
        setCommits(fetchedCommits);
        setFilteredCommits(fetchedCommits);
      } catch (err) {
        console.error("Failed to fetch commits:", err);
        setError("Failed to load commits. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    fetchCommits();
  }, [isOpen, repoId]);

  // Filter commits based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredCommits(commits);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = commits.filter(
      (commit) =>
        commit.message?.toLowerCase().includes(query) ||
        commit.sha.toLowerCase().includes(query) ||
        commit.author_login?.toLowerCase().includes(query)
    );
    setFilteredCommits(filtered);
  }, [searchQuery, commits]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setSelectedCommit(null);
      setError(null);
      setSyncSuccess(null);
    }
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  const handleLinkCommit = async () => {
    if (!selectedCommit || linking) return;

    setLinking(true);
    try {
      await tasksApi.linkCommitToTask(taskId, selectedCommit.sha);
      onLinkSuccess();
      onClose();
    } catch (err: any) {
      console.error("Failed to link commit:", err);
      setError(err.message || "Failed to link commit. Please try again.");
    } finally {
      setLinking(false);
    }
  };

  const handleSyncCommits = async () => {
    if (!repoId || syncing) return;

    setSyncing(true);
    setError(null);
    setSyncSuccess(null);
    try {
      const result = await tasksApi.syncCommitsFromGithub(repoId, 100);

      // Refresh the commits list
      const fetchedCommits = await tasksApi.getCommitsByRepo(repoId);
      setCommits(fetchedCommits);
      setFilteredCommits(fetchedCommits);

      // Show success message
      setSyncSuccess(`Synced ${result.synced} new commits from GitHub`);

      // Clear success message after 3 seconds
      setTimeout(() => setSyncSuccess(null), 3000);
    } catch (err: any) {
      console.error("Failed to sync commits:", err);
      setError(err.message || "Failed to sync commits. Please try again.");
    } finally {
      setSyncing(false);
    }
  };

  const isCommitLinked = (sha: string) => linkedCommitShas.includes(sha);

  if (!isOpen) return null;

  // Show error if no repo is assigned
  if (!repoId) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/20 backdrop-blur-md" />
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md mx-4 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-3xl shadow-2xl p-6"
          style={{
            boxShadow:
              "0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)",
          }}
        >
          <div className="flex flex-col items-center gap-3 text-center">
            <AlertCircle className="w-10 h-10 text-orange-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No Repository Assigned</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              This task doesn't have a repository assigned. Please assign a repository first.
            </p>
            <button
              onClick={onClose}
              className="mt-2 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop with blur */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-md" />

      {/* Modal Card */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl mx-4 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-3xl shadow-2xl transform transition-all duration-200 ease-out animate-modal-enter"
        style={{
          boxShadow:
            "0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-200/50 dark:border-zinc-700/50">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Link Commit</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Select a commit to link to this task
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X size={18} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Search Input with Sync Button */}
        <div className="px-6 pt-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by message, hash, or author..."
                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-sm text-gray-800 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 dark:focus:border-blue-500 transition-all"
              />
            </div>
            <button
              onClick={handleSyncCommits}
              disabled={syncing || loading}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 disabled:bg-gray-50 dark:disabled:bg-zinc-800/50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300 disabled:text-gray-400 dark:disabled:text-gray-500 rounded-xl text-sm font-medium transition-all"
              title="Sync commits from GitHub"
            >
              <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Syncing..." : "Sync"}
            </button>
          </div>

          {/* Success Message */}
          {syncSuccess && (
            <div className="mt-2 flex items-center gap-2 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              {syncSuccess}
            </div>
          )}
        </div>

        {/* Commits List */}
        <div className="px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400 dark:text-gray-500" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <AlertCircle className="w-8 h-8 text-red-400" />
              <p className="text-sm text-gray-600 dark:text-gray-400">{error}</p>
            </div>
          ) : filteredCommits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <GitCommit className="w-8 h-8 text-gray-300 dark:text-gray-600" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {commits.length === 0
                  ? "No commits found. Please sync commits from GitHub first."
                  : "No commits match your search."}
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {filteredCommits.map((commit) => {
                const isLinked = isCommitLinked(commit.sha);
                const isSelected = selectedCommit?.sha === commit.sha;

                return (
                  <button
                    key={commit.sha}
                    onClick={() => !isLinked && setSelectedCommit(commit)}
                    disabled={isLinked}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                      isLinked
                        ? "bg-gray-50 dark:bg-zinc-800/50 border-gray-200 dark:border-zinc-700 opacity-50 cursor-not-allowed"
                        : isSelected
                        ? "bg-blue-50 dark:bg-blue-900/20 border-blue-400 shadow-sm"
                        : "bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 hover:border-gray-300 dark:hover:border-zinc-600 hover:bg-gray-50 dark:hover:bg-zinc-700/50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        <GitCommit
                          size={16}
                          className={
                            isLinked
                              ? "text-gray-300 dark:text-gray-600"
                              : isSelected
                              ? "text-blue-500"
                              : "text-gray-400 dark:text-gray-500"
                          }
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <code className="text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-zinc-700 px-2 py-0.5 rounded">
                            {commit.sha.substring(0, 7)}
                          </code>
                          {commit.author_login && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                              {commit.author_login}
                            </span>
                          )}
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            {new Date(commit.committed_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                          {isLinked && (
                            <span className="text-xs text-gray-400 dark:text-gray-500 italic ml-auto">
                              Already linked
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                          {commit.message || "No message"}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-6 pb-5 pt-2 border-t border-gray-200/50 dark:border-zinc-700/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleLinkCommit}
            disabled={!selectedCommit || linking}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-[#007AFF] rounded-xl hover:bg-[#0066DD] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            {linking ? "Linking..." : "Link Commit"}
          </button>
        </div>
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes modal-enter {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .animate-modal-enter {
          animation: modal-enter 0.2s ease-out forwards;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #9ca3af;
        }
      `}</style>
    </div>
  );
}
