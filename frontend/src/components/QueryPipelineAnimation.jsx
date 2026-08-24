import { useState, useEffect, useCallback } from 'react';

const PIPELINE_STAGE_DURATION = 800; // ms per stage

const STAGES = [
  {
    id: 'user-query',
    label: 'User Query',
    icon: '📝',
    color: 'from-blue-500 to-blue-600',
    glowColor: 'shadow-blue-500/40',
    borderColor: 'border-blue-500/40',
    textColor: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    description: 'Raw SQL string received from the client application.',
  },
  {
    id: 'parser',
    label: 'Parser',
    icon: '🔤',
    color: 'from-violet-500 to-violet-600',
    glowColor: 'shadow-violet-500/40',
    borderColor: 'border-violet-500/40',
    textColor: 'text-violet-400',
    bgColor: 'bg-violet-500/10',
    description: 'Tokenizes keywords, identifiers, and literals into a parse tree (AST).',
  },
  {
    id: 'syntax-checker',
    label: 'Syntax Checker',
    icon: '✅',
    color: 'from-emerald-500 to-emerald-600',
    glowColor: 'shadow-emerald-500/40',
    borderColor: 'border-emerald-500/40',
    textColor: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    description: 'Validates grammar rules, table references, column names, and data types.',
  },
  {
    id: 'optimizer',
    label: 'Optimizer',
    icon: '⚡',
    color: 'from-amber-500 to-amber-600',
    glowColor: 'shadow-amber-500/40',
    borderColor: 'border-amber-500/40',
    textColor: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    description: 'Rewrites the query, evaluates join orders, selects best index strategy.',
  },
  {
    id: 'execution-plan',
    label: 'Execution Plan',
    icon: '🗺️',
    color: 'from-cyan-500 to-cyan-600',
    glowColor: 'shadow-cyan-500/40',
    borderColor: 'border-cyan-500/40',
    textColor: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    description: 'Produces a directed acyclic graph of physical operators (Seq Scan, Index Scan, Hash Join …).',
  },
  {
    id: 'buffer-pool',
    label: 'Buffer Pool',
    icon: '🧊',
    color: 'from-indigo-500 to-indigo-600',
    glowColor: 'shadow-indigo-500/40',
    borderColor: 'border-indigo-500/40',
    textColor: 'text-indigo-400',
    bgColor: 'bg-indigo-500/10',
    description: 'Checks in-memory page cache. Cache hit → skip disk. Cache miss → fetch from disk.',
  },
  {
    id: 'disk',
    label: 'Disk',
    icon: '💾',
    color: 'from-rose-500 to-rose-600',
    glowColor: 'shadow-rose-500/40',
    borderColor: 'border-rose-500/40',
    textColor: 'text-rose-400',
    bgColor: 'bg-rose-500/10',
    description: 'Physical I/O: reads data pages from tablespace files into the buffer pool.',
  },
  {
    id: 'result',
    label: 'Result',
    icon: '📊',
    color: 'from-green-400 to-emerald-500',
    glowColor: 'shadow-emerald-400/40',
    borderColor: 'border-emerald-400/40',
    textColor: 'text-emerald-300',
    bgColor: 'bg-emerald-400/10',
    description: 'Rows assembled into a result set and streamed back to the client.',
  },
];

export default function QueryPipelineAnimation({ query, onClose }) {
  const [activeStage, setActiveStage] = useState(-1);
  const [completed, setCompleted] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const runPipeline = useCallback(() => {
    setActiveStage(-1);
    setCompleted(false);
    setShowDetails(false);

    // Animate through each stage sequentially
    STAGES.forEach((_, index) => {
      setTimeout(() => {
        setActiveStage(index);
      }, PIPELINE_STAGE_DURATION * (index + 1));
    });

    // Mark complete after all stages
    setTimeout(() => {
      setCompleted(true);
      setTimeout(() => setShowDetails(true), 400);
    }, PIPELINE_STAGE_DURATION * (STAGES.length + 1));
  }, []);

  useEffect(() => {
    // Auto-start on mount
    const timer = setTimeout(runPipeline, 300);
    return () => clearTimeout(timer);
  }, [runPipeline]);

  const getStageState = (index) => {
    if (index < activeStage) return 'completed';
    if (index === activeStage) return 'active';
    return 'pending';
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm pipeline-overlay-enter">
      <div className="relative w-full max-w-5xl mx-auto px-4 sm:px-6">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute -top-2 right-4 sm:right-6 z-10 w-9 h-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-all hover:scale-110 active:scale-95"
        >
          ✕
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Query Processing{' '}
            <span className="bg-gradient-to-r from-cyan-400 via-violet-400 to-pink-400 bg-clip-text text-transparent">
              Pipeline
            </span>
          </h2>
          <p className="text-gray-400 text-xs sm:text-sm mt-1.5 max-w-lg mx-auto">
            Visualizing how the DBMS engine processes your SQL statement through each internal stage.
          </p>
        </div>

        {/* Query Display */}
        <div className="mb-6 mx-auto max-w-2xl">
          <div className="bg-surface-950/80 border border-white/10 rounded-xl px-4 py-3 font-mono text-xs text-cyan-300 overflow-x-auto whitespace-pre-wrap break-all max-h-20 overflow-y-auto">
            {query || 'SELECT * FROM ...'}
          </div>
        </div>

        {/* Pipeline Stages */}
        <div className="flex flex-col items-center gap-0">
          {STAGES.map((stage, index) => {
            const state = getStageState(index);

            return (
              <div key={stage.id} className="flex flex-col items-center w-full max-w-2xl">
                {/* Stage Card */}
                <div
                  className={`
                    pipeline-stage-card w-full flex items-center gap-4 px-5 py-3.5 rounded-xl border transition-all duration-500 relative overflow-hidden
                    ${state === 'active'
                      ? `${stage.bgColor} ${stage.borderColor} shadow-lg ${stage.glowColor} pipeline-stage-active scale-[1.03]`
                      : state === 'completed'
                        ? `bg-white/5 border-white/15 opacity-80`
                        : 'bg-white/[0.02] border-white/[0.06] opacity-40'
                    }
                  `}
                  style={{
                    animationDelay: `${index * 100}ms`,
                  }}
                >
                  {/* Progress indicator */}
                  {state === 'active' && (
                    <div className="absolute inset-0 pipeline-scan-line" />
                  )}

                  {/* Icon */}
                  <div
                    className={`
                      flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold transition-all duration-500
                      ${state === 'active'
                        ? `bg-gradient-to-br ${stage.color} shadow-lg ${stage.glowColor} scale-110`
                        : state === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-white/5 text-gray-600'
                      }
                    `}
                  >
                    {state === 'completed' ? '✓' : stage.icon}
                  </div>

                  {/* Label & Description */}
                  <div className="flex-1 min-w-0">
                    <div
                      className={`font-bold text-sm transition-colors duration-500 ${
                        state === 'active'
                          ? stage.textColor
                          : state === 'completed'
                            ? 'text-gray-300'
                            : 'text-gray-600'
                      }`}
                    >
                      {stage.label}
                    </div>
                    <div
                      className={`text-[10px] mt-0.5 leading-snug transition-all duration-500 ${
                        state === 'active'
                          ? 'text-gray-300 max-h-20 opacity-100'
                          : state === 'completed'
                            ? 'text-gray-500 max-h-20 opacity-70'
                            : 'text-gray-700 max-h-0 opacity-0 overflow-hidden'
                      }`}
                    >
                      {stage.description}
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="flex-shrink-0">
                    {state === 'active' && (
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${stage.bgColor} ${stage.textColor} ${stage.borderColor} border`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                        PROCESSING
                      </span>
                    )}
                    {state === 'completed' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        ✓ DONE
                      </span>
                    )}
                    {state === 'pending' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-white/5 text-gray-600 border border-white/5">
                        WAITING
                      </span>
                    )}
                  </div>
                </div>

                {/* Connector Arrow */}
                {index < STAGES.length - 1 && (
                  <div className="flex flex-col items-center py-0.5">
                    <div
                      className={`w-0.5 h-5 rounded-full transition-all duration-500 ${
                        index < activeStage
                          ? 'bg-emerald-500/60'
                          : index === activeStage
                            ? `pipeline-connector-pulse bg-gradient-to-b ${STAGES[index + 1].color}`
                            : 'bg-white/10'
                      }`}
                    />
                    <svg
                      width="12" height="8" viewBox="0 0 12 8"
                      className={`transition-all duration-500 ${
                        index < activeStage
                          ? 'text-emerald-500/60'
                          : index === activeStage
                            ? STAGES[index + 1].textColor
                            : 'text-white/10'
                      }`}
                    >
                      <path d="M6 8L0 0h12z" fill="currentColor" />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Completion Summary */}
        {completed && (
          <div className={`mt-6 transition-all duration-700 ${showDetails ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <div className="max-w-2xl mx-auto bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-5 shadow-lg shadow-emerald-500/5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center text-sm shadow-lg shadow-emerald-500/30">
                  🎉
                </div>
                <div>
                  <div className="text-emerald-300 font-bold text-sm">Pipeline Complete</div>
                  <div className="text-gray-500 text-[10px]">
                    All {STAGES.length} stages processed in ~{((STAGES.length + 1) * PIPELINE_STAGE_DURATION / 1000).toFixed(1)}s (simulated)
                  </div>
                </div>
              </div>

              {/* Stage Summary Grid */}
              <div className="grid grid-cols-4 gap-2">
                {STAGES.map((stage) => (
                  <div
                    key={stage.id}
                    className={`flex flex-col items-center p-2 rounded-lg border bg-white/[0.02] ${stage.borderColor} transition-all hover:bg-white/5`}
                  >
                    <span className="text-base">{stage.icon}</span>
                    <span className={`text-[8px] font-bold mt-0.5 ${stage.textColor} text-center leading-tight`}>{stage.label}</span>
                  </div>
                ))}
              </div>

              {/* Buttons */}
              <div className="flex justify-center gap-3 mt-4">
                <button
                  onClick={runPipeline}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all active:scale-95 flex items-center gap-1.5"
                >
                  🔄 Replay
                </button>
                <button
                  onClick={onClose}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:from-emerald-500 hover:to-emerald-400 transition-all active:scale-95 flex items-center gap-1.5"
                >
                  ✓ Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
