
import { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, FileCode, FilePlus, FileMinus, FileEdit, Maximize2, Minimize2 } from 'lucide-react';
import { motion } from 'framer-motion';
import type { CommitFile } from '../../dashboard/api/tasksApi';

interface CommitCodeViewerProps {
  files: CommitFile[];
  className?: string;
}

interface ParsedLine {
  type: 'addition' | 'deletion' | 'context' | 'header';
  content: string;
  oldLineNum?: number;
  newLineNum?: number;
}

// Parse git diff patch into structured lines
function parsePatch(patch: string): ParsedLine[] {
  if (!patch) return [];

  const lines = patch.split('\n');
  const parsed: ParsedLine[] = [];

  let oldLine = 0;
  let newLine = 0;

  for (const line of lines) {
    // Handle hunk headers like @@ -1,5 +1,7 @@
    if (line.startsWith('@@')) {
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldLine = parseInt(match[1], 10);
        newLine = parseInt(match[2], 10);
      }
      parsed.push({ type: 'header', content: line });
      continue;
    }

    if (line.startsWith('+')) {
      parsed.push({
        type: 'addition',
        content: line.substring(1),
        newLineNum: newLine++,
      });
    } else if (line.startsWith('-')) {
      parsed.push({
        type: 'deletion',
        content: line.substring(1),
        oldLineNum: oldLine++,
      });
    } else if (line.startsWith(' ') || line === '') {
      parsed.push({
        type: 'context',
        content: line.substring(1) || '',
        oldLineNum: oldLine++,
        newLineNum: newLine++,
      });
    }
  }

  return parsed;
}

// Get file status icon
function FileStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'added':
      return <FilePlus size={14} className="text-green-400" />;
    case 'removed':
      return <FileMinus size={14} className="text-red-400" />;
    case 'modified':
    default:
      return <FileEdit size={14} className="text-amber-400" />;
  }
}

// Line number gutter component
function LineGutter({ oldNum, newNum }: { oldNum?: number; newNum?: number }) {
  return (
    <div className="flex-shrink-0 w-20 flex text-slate-600 text-xs select-none border-r border-slate-700/50 mr-3">
      <span className="w-10 text-right pr-2 opacity-60">{oldNum ?? ''}</span>
      <span className="w-10 text-right pr-2 opacity-60">{newNum ?? ''}</span>
    </div>
  );
}

export function CommitCodeViewer({ files, className = '' }: CommitCodeViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Sort files by impact (additions + deletions) descending
  const sortedFiles = useMemo(() => {
    return [...files].sort((a, b) => {
      const impactA = a.additions + a.deletions;
      const impactB = b.additions + b.deletions;
      return impactB - impactA;
    });
  }, [files]);

  const currentFile = sortedFiles[currentIndex];
  const totalFiles = sortedFiles.length;

  // Parse the current file's patch
  const parsedLines = useMemo(() => {
    if (!currentFile?.patch) return [];
    return parsePatch(currentFile.patch);
  }, [currentFile]);

  // Reset scroll when changing files
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [currentIndex]);

  // Navigation handlers
  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : totalFiles - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev < totalFiles - 1 ? prev + 1 : 0));
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goToPrevious();
      if (e.key === 'ArrowRight') goToNext();
      if (e.key === 'Escape' && isFullscreen) setIsFullscreen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [totalFiles, isFullscreen]);

  // Prevent body scroll when fullscreen
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isFullscreen]);

  // Empty state
  if (!files || files.length === 0) {
    return (
      <div className={`bg-slate-900 rounded-xl border border-slate-700/50 flex items-center justify-center ${className}`}>
        <div className="text-center py-12 px-6">
          <FileCode size={40} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No diff data available</p>
          <p className="text-slate-600 text-xs mt-1">Link commits to view changes</p>
        </div>
      </div>
    );
  }

  const containerClasses = isFullscreen
    ? 'fixed inset-0 z-50 bg-slate-900 m-0 rounded-none w-screen h-screen flex flex-col'
    : `bg-slate-900 rounded-xl border border-slate-700/50 flex flex-col overflow-hidden max-h-[600px] ${className}`;

  return (
    <motion.div
      layout
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className={containerClasses}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800/50 border-b border-slate-700/50">
        {/* Left: File counter */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-400">
            <span className="text-slate-200 font-semibold">{currentIndex + 1}</span>
            <span className="text-slate-600 mx-1">/</span>
            <span>{totalFiles}</span>
            <span className="text-slate-600 ml-1">files</span>
          </span>

          {/* File stats */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-green-400 font-mono">+{currentFile.additions}</span>
            <span className="text-red-400 font-mono">-{currentFile.deletions}</span>
          </div>
        </div>

        {/* Center: Filename with status icon */}
        <div className="flex items-center gap-2 flex-1 justify-center px-4">
          <FileStatusIcon status={currentFile.status} />
          <span className="text-slate-300 text-sm font-mono truncate max-w-[300px]">
            {currentFile.filename}
          </span>
        </div>

        {/* Right: Navigation arrows & Fullscreen */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={goToPrevious}
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors disabled:opacity-30"
              aria-label="Previous file"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={goToNext}
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-colors disabled:opacity-30"
              aria-label="Next file"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="w-px h-4 bg-slate-700/50"></div>

          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-md text-slate-400 hover:text-green-400 hover:bg-slate-700/50 transition-colors"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <Minimize2 size={16} />
            ) : (
              <Maximize2 size={16} />
            )}
          </button>
        </div>
      </div>

      {/* Code Area with Premium Scrollbar */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto font-mono text-sm leading-relaxed premium-scrollbar"
      >
        <div className={`p-4 ${isFullscreen ? 'max-w-6xl mx-auto' : ''}`}>
          {!currentFile.patch ? (
            <div className="text-slate-500 text-center py-8">
              <p>Binary file or no diff content available</p>
            </div>
          ) : (
            <div className={`min-w-fit ${isFullscreen ? 'w-full' : ''}`}>
              {parsedLines.map((line, idx) => {
                if (line.type === 'header') {
                  return (
                    <div
                      key={idx}
                      className="flex items-center py-1.5 px-3 bg-slate-800/30 text-slate-500 text-xs rounded my-2"
                    >
                      <span className="font-mono">{line.content}</span>
                    </div>
                  );
                }

                const bgClass = {
                  addition: 'bg-green-500/10 border-l-2 border-green-500/50',
                  deletion: 'bg-red-500/10 border-l-2 border-red-500/50',
                  context: 'border-l-2 border-transparent',
                }[line.type];

                const textClass = {
                  addition: 'text-green-300',
                  deletion: 'text-red-300',
                  context: 'text-slate-400',
                }[line.type];

                const prefix = {
                  addition: '+',
                  deletion: '-',
                  context: ' ',
                }[line.type];

                return (
                  <div
                    key={idx}
                    className={`flex items-stretch min-h-[1.625rem] ${bgClass}`}
                  >
                    <LineGutter oldNum={line.oldLineNum} newNum={line.newLineNum} />
                    <div className={`flex-1 px-2 py-0.5 ${textClass}`}>
                      <span className="opacity-50 mr-2 select-none">{prefix}</span>
                      <span className="whitespace-pre">{line.content || ' '}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* File list indicator (dots) */}
      {totalFiles > 1 && (
        <div className="flex items-center justify-center gap-1.5 py-2 bg-slate-800/30 border-t border-slate-700/50">
          {sortedFiles.slice(0, Math.min(10, totalFiles)).map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`w-1.5 h-1.5 rounded-full transition-all ${idx === currentIndex
                ? 'bg-slate-300 scale-125'
                : 'bg-slate-600 hover:bg-slate-500'
                }`}
              aria-label={`Go to file ${idx + 1}`}
            />
          ))}
          {totalFiles > 10 && (
            <span className="text-slate-600 text-xs ml-1">+{totalFiles - 10}</span>
          )}
        </div>
      )}
    </motion.div>
  );
}
