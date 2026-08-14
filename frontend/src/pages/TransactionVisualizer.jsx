import { useState } from 'react';

const INITIAL_ROWS = [
  { id: 1, name: 'Amit Sharma', dept: 'CSE', year: 2, status: 'committed' },
  { id: 2, name: 'Priya Patel', dept: 'ECE', year: 3, status: 'committed' },
  { id: 3, name: 'Rohan Gupta', dept: 'ME', year: 1, status: 'committed' }
];

export default function TransactionVisualizer() {
  const [rows, setRows] = useState(INITIAL_ROWS);
  const [undoLog, setUndoLog] = useState([]);
  const [txStep, setTxStep] = useState(0); // 0: Idle, 1: BEGIN, 2: INSERT, 3: UPDATE, 4: DELETE, 5: COMMIT, 6: ROLLBACK
  const [status, setStatus] = useState('NO_ACTIVE_TRANSACTION'); // active, committed, rolled_back
  const [animating, setAnimating] = useState(false);
  const [isErrorState, setIsErrorState] = useState(false);

  // Go to next step in success flow
  const handleNextStep = () => {
    if (animating) return;

    if (txStep === 0) {
      // BEGIN
      setTxStep(1);
      setStatus('TRANSACTION_ACTIVE');
      setUndoLog([{ action: 'BEGIN TRANSACTION', desc: 'Sandbox isolation activated. Undo buffer initialized.' }]);
    } 
    else if (txStep === 1) {
      // INSERT
      setTxStep(2);
      setRows(prev => [
        ...prev,
        { id: 4, name: 'Sneha Reddy', dept: 'CE', year: 1, status: 'uncommitted_insert' }
      ]);
      setUndoLog(prev => [
        ...prev,
        { action: 'INSERT RECORD', desc: 'Staged ID 4 (Sneha Reddy). Undo operation: DELETE ID 4' }
      ]);
    } 
    else if (txStep === 2) {
      // UPDATE
      setTxStep(3);
      setRows(prev => prev.map(r => r.id === 2 ? { ...r, year: 4, status: 'uncommitted_update' } : r));
      setUndoLog(prev => [
        ...prev,
        { action: 'UPDATE RECORD', desc: 'Staged ID 2 year to 4. Undo operation: SET ID 2 year = 3' }
      ]);
    } 
    else if (txStep === 3) {
      // DELETE
      setTxStep(4);
      setRows(prev => prev.map(r => r.id === 3 ? { ...r, status: 'uncommitted_delete' } : r));
      setUndoLog(prev => [
        ...prev,
        { action: 'DELETE RECORD', desc: 'Staged ID 3 for deletion. Undo operation: RESTORE ID 3' }
      ]);
    } 
    else if (txStep === 4) {
      // COMMIT
      setAnimating(true);
      setTxStep(5);
      
      setTimeout(() => {
        setRows(prev => prev
          .filter(r => r.status !== 'uncommitted_delete')
          .map(r => ({ ...r, status: 'committed' }))
        );
        setStatus('TRANSACTION_COMMITTED');
        setUndoLog(prev => [
          ...prev,
          { action: 'COMMIT', desc: 'All changes written to disk. Log cleared.' }
        ]);
        setAnimating(false);
      }, 1000);
    }
  };

  // Inject Error and ROLLBACK
  const handleRollback = () => {
    if (animating || txStep === 0 || txStep === 5) return;
    
    setAnimating(true);
    setIsErrorState(true);
    setStatus('ROLLBACK_IN_PROGRESS');

    // Undo step-by-step with delay
    let currentStep = txStep;
    
    const interval = setInterval(() => {
      if (currentStep === 4) {
        // Undo DELETE
        setRows(prev => prev.map(r => r.id === 3 ? { ...r, status: 'committed' } : r));
        setUndoLog(prev => prev.slice(0, -1));
        currentStep = 3;
      } 
      else if (currentStep === 3) {
        // Undo UPDATE
        setRows(prev => prev.map(r => r.id === 2 ? { ...r, year: 3, status: 'committed' } : r));
        setUndoLog(prev => prev.slice(0, -1));
        currentStep = 2;
      } 
      else if (currentStep === 2) {
        // Undo INSERT
        setRows(prev => prev.filter(r => r.id !== 4));
        setUndoLog(prev => prev.slice(0, -1));
        currentStep = 1;
      } 
      else if (currentStep === 1) {
        // Undo BEGIN
        setUndoLog([]);
        setTxStep(0);
        setStatus('TRANSACTION_ROLLED_BACK');
        setAnimating(false);
        setIsErrorState(false);
        clearInterval(interval);
      }
    }, 800);
  };

  const handleReset = () => {
    setRows(INITIAL_ROWS);
    setUndoLog([]);
    setTxStep(0);
    setStatus('NO_ACTIVE_TRANSACTION');
    setIsErrorState(false);
    setAnimating(false);
  };

  return (
    <div className="min-h-screen pt-24 pb-12 px-6 bg-surface-900 text-gray-300">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="animate-slide-up">
          <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">
            Transaction <span className="gradient-text">Studio</span>
          </h1>
          <p className="text-gray-400 text-sm max-w-2xl">
            Visualize the atomic stages of database transactions. Execute staging commands, inspect uncommitted states inside the sandbox buffer, and compare COMMIT vs ROLLBACK rollbacks.
          </p>
        </div>

        {/* Status bar */}
        <div className="glass-card p-6 flex flex-wrap gap-4 items-center justify-between border-primary-500/20">
          <div className="flex items-center gap-4">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Transaction Status:</span>
            <span className={`px-3 py-1 rounded-xl text-xs font-mono font-bold ${
              status === 'TRANSACTION_ACTIVE' 
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse'
                : status === 'TRANSACTION_COMMITTED'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : status === 'ROLLBACK_IN_PROGRESS'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse'
                    : status === 'TRANSACTION_ROLLED_BACK'
                      ? 'bg-red-500/10 text-red-400 border border-red-500/10'
                      : 'bg-white/5 text-gray-400 border border-white/5'
            }`}>
              {status}
            </span>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleReset}
              disabled={animating}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 border border-white/10 hover:bg-white/10 text-white transition-all disabled:opacity-50"
            >
              Reset
            </button>
            <button
              onClick={handleRollback}
              disabled={animating || txStep === 0 || txStep === 5}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-500 text-white transition-all disabled:opacity-50 shadow-lg shadow-red-600/10"
            >
              ⚠️ Rollback on Error
            </button>
            <button
              onClick={handleNextStep}
              disabled={animating || txStep === 5}
              className="px-6 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-primary-600 to-primary-500 text-white hover:from-primary-500 hover:to-primary-400 disabled:opacity-50 transition-all shadow-lg shadow-primary-500/15"
            >
              {txStep === 0 ? '▶ Begin Transaction' : txStep === 4 ? '✔ Commit Changes' : '→ Next Step'}
            </button>
          </div>
        </div>

        {/* Central Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* DATABASE BUFFER TABLE (Spans 7 cols) */}
          <div className={`lg:col-span-7 border rounded-2xl p-6 bg-surface-950/40 flex flex-col justify-between transition-all duration-700 ${
            status === 'TRANSACTION_ACTIVE' 
              ? 'border-amber-500/30 shadow-lg shadow-amber-500/5 bg-amber-500/[0.01]' 
              : status === 'ROLLBACK_IN_PROGRESS'
                ? 'border-red-500/30 shadow-lg shadow-red-500/5 bg-red-500/[0.01]'
                : 'border-white/5 bg-surface-950/20'
          }`}>
            <div>
              <div className="border-b border-white/5 pb-3 mb-4 flex justify-between items-center">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                  <span>Database State Buffer</span>
                  {status === 'TRANSACTION_ACTIVE' && (
                    <span className="text-[10px] text-amber-400 font-mono animate-pulse bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      Isolated Sandbox
                    </span>
                  )}
                </span>
                <span className="text-[10px] text-gray-500 font-mono">Table: student_temp</span>
              </div>

              {/* Table rendering */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/10 text-gray-500 font-bold uppercase">
                      <th className="px-4 py-3 font-mono">ID</th>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Dept</th>
                      <th className="px-4 py-3 font-mono">Year of Study</th>
                      <th className="px-4 py-3 text-right">State</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {rows.map((row) => {
                      const isUncommittedInsert = row.status === 'uncommitted_insert';
                      const isUncommittedUpdate = row.status === 'uncommitted_update';
                      const isUncommittedDelete = row.status === 'uncommitted_delete';

                      return (
                        <tr 
                          key={row.id}
                          className={`transition-all duration-500 ${
                            isUncommittedInsert 
                              ? 'bg-amber-500/10 text-amber-400 font-semibold border-l-4 border-amber-500 animate-pulse'
                              : isUncommittedUpdate
                                ? 'bg-amber-500/5 text-amber-300 font-semibold'
                                : isUncommittedDelete
                                  ? 'bg-red-500/10 text-red-500/60 line-through border-l-4 border-red-500/30'
                                  : 'text-gray-300'
                          }`}
                        >
                          <td className="px-4 py-3 font-mono">{row.id}</td>
                          <td className="px-4 py-3">{row.name}</td>
                          <td className="px-4 py-3">{row.dept}</td>
                          <td className={`px-4 py-3 font-mono transition-all duration-300 ${
                            isUncommittedUpdate ? 'text-amber-400 font-bold scale-105 bg-amber-500/10 rounded px-1' : ''
                          }`}>
                            {row.year}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {isUncommittedInsert && (
                              <span className="text-[9px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/30 font-bold uppercase tracking-wider animate-pulse">
                                Uncommitted Insert
                              </span>
                            )}
                            {isUncommittedUpdate && (
                              <span className="text-[9px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/30 font-bold uppercase tracking-wider animate-pulse">
                                Uncommitted Update
                              </span>
                            )}
                            {isUncommittedDelete && (
                              <span className="text-[9px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full border border-red-500/30 font-bold uppercase tracking-wider">
                                Pending Delete
                              </span>
                            )}
                            {row.status === 'committed' && (
                              <span className="text-[9px] bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20 font-mono">
                                COMMITTED
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Lifecycle Status flow footer */}
            <div className="mt-8 border-t border-white/5 pt-6">
              <div className="flex justify-between items-center">
                {[
                  { step: 1, label: 'BEGIN', active: txStep >= 1 },
                  { step: 2, label: 'INSERT', active: txStep >= 2 },
                  { step: 3, label: 'UPDATE', active: txStep >= 3 },
                  { step: 4, label: 'DELETE', active: txStep >= 4 },
                  { step: 5, label: 'COMMIT', active: txStep >= 5 },
                ].map((item) => (
                  <div key={item.step} className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-mono font-bold transition-all duration-500 ${
                      item.active
                        ? isErrorState
                          ? 'bg-red-500/20 border-red-500 text-red-400 shadow-md shadow-red-500/10'
                          : txStep === 5
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-md shadow-emerald-500/10'
                            : 'bg-amber-500/20 border-amber-500 text-amber-400 shadow-md shadow-amber-500/10'
                        : 'bg-white/5 border-white/10 text-gray-600'
                    }`}>
                      {item.step}
                    </div>
                    <span className={`text-[9px] font-bold mt-1.5 transition-colors duration-500 ${
                      item.active ? 'text-gray-300' : 'text-gray-600'
                    }`}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* UNDO LOGS PANEL (Spans 5 cols) */}
          <div className="lg:col-span-5 border border-white/5 rounded-2xl p-6 bg-surface-950/20 flex flex-col h-[460px]">
            <div className="border-b border-white/5 pb-3 mb-4 flex justify-between items-center">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                📜 Undo / Transaction Log
              </span>
              {undoLog.length > 0 && (
                <span className="text-[9px] font-mono text-amber-400 animate-pulse">
                  {undoLog.length} staged ops
                </span>
              )}
            </div>

            {/* Logs List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 py-1 font-mono text-[10px]">
              {undoLog.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-gray-600">
                  <span className="text-lg mb-1">💤</span>
                  <span>Undo log empty. Start transaction to stage changes.</span>
                </div>
              ) : (
                undoLog.map((log, idx) => (
                  <div 
                    key={idx}
                    className="p-3 bg-white/5 border border-white/10 rounded-xl space-y-1 animate-slide-up"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-amber-400 font-bold">{log.action}</span>
                      <span className="text-[8px] text-gray-500">Entry #{idx + 1}</span>
                    </div>
                    <div className="text-gray-400 leading-normal">{log.desc}</div>
                  </div>
                ))
              )}
            </div>
            
            {/* Log status description */}
            <div className="mt-4 pt-4 border-t border-white/5 text-[9px] text-gray-500 font-mono leading-relaxed">
              * The SQL engine populates the **Undo Log** buffer during transaction execution. If a rollback is triggered, these records are executed in reverse to reconstruct the initial state.
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
