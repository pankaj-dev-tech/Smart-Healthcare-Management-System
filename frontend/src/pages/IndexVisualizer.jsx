import { useState } from 'react';

// Sample dataset of records
const DATASET = [
  { id: 1, name: 'Aarav Mehta', email: 'aarav.mehta@university.edu', roll_number: 'CSE2024001', dept: 'CSE' },
  { id: 2, name: 'Ananya Iyer', email: 'ananya.iyer@university.edu', roll_number: 'CSE2024002', dept: 'CSE' },
  { id: 3, name: 'Bhavya Sharma', email: 'bhavya.sharma@university.edu', roll_number: 'CSE2024003', dept: 'CSE' },
  { id: 4, name: 'Chaitanya Rao', email: 'chaitanya.rao@university.edu', roll_number: 'ECE2024001', dept: 'ECE' },
  { id: 5, name: 'Divya Nair', email: 'divya.nair@university.edu', roll_number: 'ECE2024002', dept: 'ECE' },
  { id: 6, name: 'Eshwar Prasad', email: 'eshwar.prasad@university.edu', roll_number: 'ECE2024003', dept: 'ECE' },
  { id: 7, name: 'Gaurav Sen', email: 'gaurav.sen@university.edu', roll_number: 'ME2024001', dept: 'ME' },
  { id: 8, name: 'Ishita Gupta', email: 'ishita.gupta@university.edu', roll_number: 'ME2024002', dept: 'ME' },
  { id: 9, name: 'Kabir Kapoor', email: 'kabir.kapoor@university.edu', roll_number: 'ME2024003', dept: 'ME' },
  { id: 10, name: 'Kavya Pillai', email: 'kavya.pillai@university.edu', roll_number: 'CE2024001', dept: 'CE' },
  { id: 11, name: 'Manish Verma', email: 'manish.verma@university.edu', roll_number: 'CE2024002', dept: 'CE' },
  { id: 12, name: 'Neha Joshi', email: 'neha.joshi@university.edu', roll_number: 'CE2024003', dept: 'CE' },
  { id: 13, name: 'Pranav Shah', email: 'pranav.shah@university.edu', roll_number: 'EE2024001', dept: 'EE' },
  { id: 14, name: 'Riya Das', email: 'riya.das@university.edu', roll_number: 'EE2024002', dept: 'EE' },
  { id: 15, name: 'Siddharth Roy', email: 'siddharth.roy@university.edu', roll_number: 'EE2024003', dept: 'EE' }
];

export default function IndexVisualizer() {
  const [searchKey, setSearchKey] = useState('9');
  const [searching, setSearching] = useState(false);
  
  // Sequential Scan states
  const [seqActiveIndex, setSeqActiveIndex] = useState(-1);
  const [seqStatus, setSeqStatus] = useState('idle'); // idle, scanning, found, failed
  const [seqReads, setSeqReads] = useState(0);

  // B+ Tree states
  const [treeActiveNode, setTreeActiveNode] = useState(null); // 'root', 'int-L', 'int-R', 'leaf-1', 'leaf-2', 'leaf-3', 'leaf-4', 'record'
  const [treeStatus, setTreeStatus] = useState('idle');
  const [treeReads, setTreeReads] = useState(0);

  // Comparison metrics
  const [showComparison, setShowComparison] = useState(false);

  const targetId = parseInt(searchKey, 10);

  // Run Sequential Scan Simulation
  const startSequentialScan = (targetVal) => {
    setSeqStatus('scanning');
    setSeqReads(0);
    let currentIdx = 0;

    const timer = setInterval(() => {
      if (currentIdx < DATASET.length) {
        setSeqActiveIndex(currentIdx);
        setSeqReads(prev => prev + 1);

        if (DATASET[currentIdx].id === targetVal) {
          clearInterval(timer);
          setSeqStatus('found');
        } else {
          currentIdx++;
        }
      } else {
        clearInterval(timer);
        setSeqStatus('failed');
      }
    }, 150);

    return timer;
  };

  // Run B+ Tree Simulation
  const startBPlusTreeScan = (targetVal) => {
    setTreeStatus('scanning');
    setTreeReads(0);
    setTreeActiveNode('root');
    setTreeReads(1);

    // Step-by-step traversal timers
    setTimeout(() => {
      // Step 2: Determine Intermediate node
      if (targetVal < 8) {
        setTreeActiveNode('int-L');
      } else {
        setTreeActiveNode('int-R');
      }
      setTreeReads(2);

      setTimeout(() => {
        // Step 3: Determine Leaf node
        if (targetVal < 4) {
          setTreeActiveNode('leaf-1');
        } else if (targetVal < 8) {
          setTreeActiveNode('leaf-2');
        } else if (targetVal < 12) {
          setTreeActiveNode('leaf-3');
        } else {
          setTreeActiveNode('leaf-4');
        }
        setTreeReads(3);

        setTimeout(() => {
          // Step 4: Point to record
          setTreeActiveNode('record');
          setTreeReads(4); // 3 tree levels + 1 record lookup pointer
          setTreeStatus('found');
        }, 600);

      }, 600);

    }, 600);
  };

  const handleStartSearch = () => {
    if (isNaN(targetId) || targetId < 1 || targetId > 15) {
      alert('Please enter a target ID between 1 and 15');
      return;
    }

    setSearching(true);
    setShowComparison(false);

    // Initialize states
    setSeqActiveIndex(-1);
    setSeqStatus('scanning');
    setTreeActiveNode(null);
    setTreeStatus('scanning');

    const seqTimer = startSequentialScan(targetId);
    startBPlusTreeScan(targetId);

    // Wait for sequential scanner to finish to display full charts
    const checkTimer = setInterval(() => {
      // check if sequential is finished
    }, 100);

    const seqCompletionTimer = setTimeout(() => {
      clearInterval(seqTimer);
      clearInterval(checkTimer);
      setSeqActiveIndex(targetId - 1);
      setSeqReads(targetId);
      setSeqStatus('found');
      setSearching(false);
      setShowComparison(true);
    }, targetId * 150 + 100);
  };

  return (
    <div className="min-h-screen pt-24 pb-12 px-6 bg-surface-900 text-gray-300">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="animate-slide-up">
          <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">
            Index <span className="gradient-text">Visualizer</span>
          </h1>
          <p className="text-gray-400 text-sm max-w-2xl">
            Explore why indexes speed up queries. Compare sequential scans (Without Index) against B+ Tree traversal routes (With Index) in real-time.
          </p>
        </div>

        {/* Concept Card */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-slide-up">
          <div className="glass-card p-6 border-cyan-500/20 bg-surface-950/40">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-cyan-400 font-bold">🔍</span>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Sequential Scan (Without Index)</h3>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              When queries search for an unindexed column, the SQL engine executes a **Full Table Scan**. It scans every record in the database sequentially from the first page until it finds a match, requiring <strong className="text-cyan-400 font-mono">O(N)</strong> page accesses.
            </p>
          </div>
          <div className="glass-card p-6 border-purple-500/20 bg-surface-950/40">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-purple-400 font-bold">🌳</span>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">B+ Tree Scan (With Index)</h3>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              An index structures data in a **B+ Tree**, enabling traversal down height levels directly to the target record pointer. Traversal complexity drops to <strong className="text-purple-400 font-mono">O(log N)</strong>, significantly minimizing disk I/O reads.
            </p>
          </div>
        </div>

        {/* Input Bar */}
        <div className="glass-card p-6 flex flex-wrap gap-4 items-center justify-between border-primary-500/20">
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Search Record by ID (1 - 15):</label>
            <input 
              type="number" 
              min="1" 
              max="15" 
              value={searchKey} 
              onChange={(e) => setSearchKey(e.target.value)} 
              className="bg-surface-950 border border-white/10 rounded-xl px-4 py-2 text-sm text-white font-mono w-24 focus:outline-none focus:border-primary-500 transition-colors"
            />
          </div>
          <button
            onClick={handleStartSearch}
            disabled={searching}
            className="px-6 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-primary-600 to-primary-500 text-white hover:from-primary-500 hover:to-primary-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary-500/10 active:scale-95"
          >
            {searching ? '🔍 Searching...' : '⚡ Start Comparison Scan'}
          </button>
        </div>

        {/* Twin Visualizers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* SEQUENTIAL SCAN VISUALIZER */}
          <div className="glass-card p-6 border-cyan-500/10 bg-surface-950/20 flex flex-col h-[520px]">
            <div className="border-b border-white/5 pb-3 mb-4 flex justify-between items-center">
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                Sequential Scan Simulator
              </span>
              <span className="text-[10px] text-gray-500 font-mono">Complexity: O(N)</span>
            </div>

            {/* Simulated Block Storage */}
            <div className="grid grid-cols-5 gap-3 overflow-y-auto flex-1 pr-1 py-2">
              {DATASET.map((item, idx) => {
                const isActive = seqActiveIndex === idx;
                const isChecked = seqActiveIndex > idx;
                const isMatch = seqStatus === 'found' && seqActiveIndex === idx;

                return (
                  <div 
                    key={item.id}
                    className={`border rounded-xl p-2.5 transition-all duration-300 flex flex-col justify-between h-20 ${
                      isMatch 
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-500/10 scale-105 font-bold'
                        : isActive
                          ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400 scale-105 shadow-md shadow-cyan-500/5'
                          : isChecked
                            ? 'bg-red-500/10 border-red-500/30 text-red-400/70'
                            : 'bg-white/5 border-white/10 text-gray-500'
                    }`}
                  >
                    <div className="text-[9px] font-bold uppercase tracking-wider font-mono">Row #{item.id}</div>
                    <div className="text-center font-mono text-xs">{item.dept}</div>
                    <div className="text-[8px] font-mono text-right truncate">
                      {isMatch ? 'Match! ✅' : isActive ? 'Read ⚡' : isChecked ? 'Skip ❌' : 'Block'}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Performance Indicators */}
            <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center">
              <div>
                <span className="text-[9px] text-gray-500 uppercase tracking-wider">Page Reads</span>
                <div className="text-xl font-extrabold font-mono text-cyan-400">{seqReads}</div>
              </div>
              <div className="text-right">
                <span className="text-[9px] text-gray-500 uppercase tracking-wider">Estimated Scan Cost</span>
                <div className="text-xl font-extrabold font-mono text-cyan-400">{(seqReads * 8.5).toFixed(1)} ms</div>
              </div>
            </div>
          </div>

          {/* B+ TREE SCAN VISUALIZER */}
          <div className="glass-card p-6 border-purple-500/10 bg-surface-950/20 flex flex-col h-[520px]">
            <div className="border-b border-white/5 pb-3 mb-4 flex justify-between items-center">
              <span className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
                B+ Tree Traversal Simulator
              </span>
              <span className="text-[10px] text-gray-500 font-mono">Complexity: O(log N)</span>
            </div>

            {/* Graphical B+ Tree Hierarchy */}
            <div className="flex-1 flex flex-col justify-around py-2 font-mono">
              
              {/* Level 0: Root */}
              <div className="flex justify-center">
                <div className={`px-4 py-2 border rounded-xl bg-surface-950 text-center transition-all duration-300 ${
                  treeActiveNode === 'root' 
                    ? 'border-purple-500 text-purple-400 ring-2 ring-purple-500/20 scale-105 font-bold shadow-lg' 
                    : treeActiveNode !== null 
                      ? 'border-white/5 text-gray-600' 
                      : 'border-white/10 text-gray-400'
                }`}>
                  <div className="text-[8px] text-gray-500 uppercase">Root Node</div>
                  <div className="text-xs">Keys: [8]</div>
                </div>
              </div>

              {/* Connectors level 1 */}
              <div className="flex justify-around px-24 text-gray-600 text-[10px] -my-2 h-4 items-center">
                <span className={treeActiveNode === 'int-L' || treeActiveNode === 'leaf-1' || treeActiveNode === 'leaf-2' ? 'text-purple-400 font-bold' : ''}>↙ (Val &lt; 8)</span>
                <span className={treeActiveNode === 'int-R' || treeActiveNode === 'leaf-3' || treeActiveNode === 'leaf-4' ? 'text-purple-400 font-bold' : ''}>(Val ≥ 8) ↘</span>
              </div>

              {/* Level 1: Intermediate Nodes */}
              <div className="flex justify-around">
                <div className={`px-4 py-2 border rounded-xl bg-surface-950 text-center transition-all duration-300 ${
                  treeActiveNode === 'int-L' 
                    ? 'border-purple-500 text-purple-400 ring-2 ring-purple-500/20 scale-105 font-bold shadow-lg' 
                    : (treeActiveNode === 'leaf-1' || treeActiveNode === 'leaf-2')
                      ? 'border-purple-500/30 text-purple-400/50'
                      : treeActiveNode !== null 
                        ? 'border-white/5 text-gray-700' 
                        : 'border-white/10 text-gray-400'
                }`}>
                  <div className="text-[8px] text-gray-500 uppercase">Left Intermediate</div>
                  <div className="text-xs">Keys: [4]</div>
                </div>
                
                <div className={`px-4 py-2 border rounded-xl bg-surface-950 text-center transition-all duration-300 ${
                  treeActiveNode === 'int-R' 
                    ? 'border-purple-500 text-purple-400 ring-2 ring-purple-500/20 scale-105 font-bold shadow-lg' 
                    : (treeActiveNode === 'leaf-3' || treeActiveNode === 'leaf-4')
                      ? 'border-purple-500/30 text-purple-400/50'
                      : treeActiveNode !== null 
                        ? 'border-white/5 text-gray-700' 
                        : 'border-white/10 text-gray-400'
                }`}>
                  <div className="text-[8px] text-gray-500 uppercase">Right Intermediate</div>
                  <div className="text-xs">Keys: [12]</div>
                </div>
              </div>

              {/* Connectors level 2 */}
              <div className="flex justify-between px-8 text-gray-600 text-[8px] -my-2 h-4 items-center">
                <span className={treeActiveNode === 'leaf-1' ? 'text-purple-400 font-bold' : ''}>↙ &lt; 4</span>
                <span className={treeActiveNode === 'leaf-2' ? 'text-purple-400 font-bold' : ''}>≥ 4 ↘</span>
                <span className={treeActiveNode === 'leaf-3' ? 'text-purple-400 font-bold' : ''}>↙ &lt; 12</span>
                <span className={treeActiveNode === 'leaf-4' ? 'text-purple-400 font-bold' : ''}>≥ 12 ↘</span>
              </div>

              {/* Level 2: Leaves */}
              <div className="grid grid-cols-4 gap-2 px-2">
                {[
                  { id: 'leaf-1', keys: '[1,2,3]' },
                  { id: 'leaf-2', keys: '[4,5,6,7]' },
                  { id: 'leaf-3', keys: '[8,9,10,11]' },
                  { id: 'leaf-4', keys: '[12,13,14,15]' }
                ].map((lf) => {
                  const isActive = treeActiveNode === lf.id;

                  return (
                    <div 
                      key={lf.id}
                      className={`px-1.5 py-2 border rounded-xl bg-surface-950 text-center transition-all duration-300 ${
                        isActive 
                          ? 'border-purple-500 text-purple-400 ring-2 ring-purple-500/20 scale-105 font-bold shadow-lg' 
                          : treeActiveNode !== null 
                            ? 'border-white/5 text-gray-700' 
                            : 'border-white/10 text-gray-400'
                      }`}
                    >
                      <div className="text-[7px] text-gray-500 uppercase">Leaf Node</div>
                      <div className="text-[10px]">{lf.keys}</div>
                    </div>
                  );
                })}
              </div>

              {/* Record Pointer Destination */}
              <div className="flex justify-center mt-2">
                <div className={`px-4 py-1.5 border rounded-xl bg-surface-950 text-center transition-all duration-500 ${
                  treeActiveNode === 'record' 
                    ? 'border-emerald-500 text-emerald-400 ring-2 ring-emerald-500/25 scale-105 font-bold' 
                    : 'border-white/5 text-gray-600'
                }`}>
                  <div className="text-[8px] text-gray-500 uppercase">Pointers Table Record Lookup</div>
                  <div className="text-[10px]">Student ID: {targetId || '—'}</div>
                </div>
              </div>

            </div>

            {/* Performance Indicators */}
            <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center">
              <div>
                <span className="text-[9px] text-gray-500 uppercase tracking-wider">Node Traversals</span>
                <div className="text-xl font-extrabold font-mono text-purple-400">{treeReads}</div>
              </div>
              <div className="text-right">
                <span className="text-[9px] text-gray-500 uppercase tracking-wider">Estimated Tree Cost</span>
                <div className="text-xl font-extrabold font-mono text-purple-400">{(treeReads * 0.9).toFixed(1)} ms</div>
              </div>
            </div>
          </div>

        </div>

        {/* COMPARISON RESULTS SCREEN */}
        {showComparison && (
          <div className="glass-card p-6 border-emerald-500/20 bg-surface-950/40 animate-slide-up space-y-6">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-white/5 pb-2">
              Performance Benchmark Report
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Stat 1: Reads Ratio */}
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <span className="text-[9px] text-gray-500 font-mono uppercase tracking-wider">I/O Reads Ratio</span>
                <div className="text-2xl font-extrabold font-mono text-white mt-1">
                  {seqReads} : {treeReads}
                </div>
                <p className="text-[10px] text-emerald-400 font-bold mt-1">
                  B+ Tree saves {(100 - (treeReads / seqReads * 100)).toFixed(0)}% page reads!
                </p>
              </div>

              {/* Stat 2: Time comparison */}
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <span className="text-[9px] text-gray-500 font-mono uppercase tracking-wider">Scan Duration Ratio</span>
                <div className="text-2xl font-extrabold font-mono text-white mt-1">
                  {(seqReads * 8.5).toFixed(1)}ms : {(treeReads * 0.9).toFixed(1)}ms
                </div>
                <p className="text-[10px] text-emerald-400 font-bold mt-1">
                  Index is {((seqReads * 8.5) / (treeReads * 0.9)).toFixed(1)}x faster!
                </p>
              </div>

              {/* Stat 3: Record details */}
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <span className="text-[9px] text-gray-500 font-mono uppercase tracking-wider">Matched Record Address</span>
                <div className="text-xs font-mono text-gray-300 mt-1 truncate">
                  Name: <strong>{DATASET[targetId - 1]?.name}</strong>
                </div>
                <p className="text-[9px] text-gray-500 font-mono mt-0.5 truncate">
                  Email: {DATASET[targetId - 1]?.email}
                </p>
              </div>

            </div>

            {/* Performance Scale Bar */}
            <div className="space-y-3">
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider font-mono">
                Visual Comparison (Query Execution Time)
              </span>

              {/* Bar 1: Seq Scan */}
              <div className="space-y-1">
                <div className="flex justify-between text-[9px] font-mono">
                  <span>Sequential Scan (Without Index)</span>
                  <span>{(seqReads * 8.5).toFixed(1)} ms</span>
                </div>
                <div className="w-full h-3 rounded-full bg-white/5 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-red-500 to-cyan-500 rounded-full transition-all duration-1000"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              {/* Bar 2: B+ Tree */}
              <div className="space-y-1">
                <div className="flex justify-between text-[9px] font-mono">
                  <span>B+ Tree Index Scan (With Index)</span>
                  <span>{(treeReads * 0.9).toFixed(1)} ms</span>
                </div>
                <div className="w-full h-3 rounded-full bg-white/5 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-500 to-emerald-500 rounded-full transition-all duration-1000"
                    style={{ width: `${( (treeReads * 0.9) / (seqReads * 8.5) ) * 100}%` }}
                  />
                </div>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
