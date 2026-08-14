import { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';

const getTableIcon = (name) => {
  const lower = name.toLowerCase();
  if (lower.includes('student')) return '🎓';
  if (lower.includes('course')) return '📚';
  if (lower.includes('department')) return '🏢';
  return '📊';
};

const getTableColor = (name) => {
  const lower = name.toLowerCase();
  if (lower.includes('student')) return 'from-pink-500/20 to-rose-500/5 hover:border-pink-500/40 text-pink-400';
  if (lower.includes('course')) return 'from-purple-500/20 to-indigo-500/5 hover:border-purple-500/40 text-purple-400';
  if (lower.includes('department')) return 'from-primary-500/20 to-blue-500/5 hover:border-primary-500/40 text-primary-400';
  return 'from-amber-500/20 to-yellow-500/5 hover:border-amber-500/40 text-amber-400';
};

export default function DatabaseViewer() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Selected table workspace states
  const [selectedTable, setSelectedTable] = useState(null);
  const [tableDetails, setTableDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState(null);
  const [rowSearch, setRowSearch] = useState('');

  // Fetch all database tables
  const fetchTables = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axiosClient.get('/metadata/tables');
      setTables(response.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load tables list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
  }, []);

  // Fetch schema columns & rows when selecting a card
  const selectTable = async (tableName) => {
    setSelectedTable(tableName);
    setDetailsLoading(true);
    setDetailsError(null);
    setRowSearch('');
    try {
      const response = await axiosClient.get(`/metadata/tables/${tableName}`);
      setTableDetails(response.data);
    } catch (err) {
      setDetailsError(err.response?.data?.message || err.message || 'Error loading schema data');
      setTableDetails(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!tableDetails || !tableDetails.rows || tableDetails.rows.length === 0) return;
    
    const headers = tableDetails.columns.map(c => c.columnName);
    const csvRows = [headers.join(',')];

    for (const row of tableDetails.rows) {
      const values = headers.map(header => {
        const val = row[header];
        const escaped = ('' + (val ?? '')).replace(/"/g, '\\"');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${selectedTable}_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter rows based on search bar input
  const getFilteredRows = () => {
    if (!tableDetails || !tableDetails.rows) return [];
    if (!rowSearch.trim()) return tableDetails.rows;

    const query = rowSearch.toLowerCase().trim();
    return tableDetails.rows.filter(row => {
      return Object.values(row).some(val => 
        ('' + (val ?? '')).toLowerCase().includes(query)
      );
    });
  };

  const filteredRows = getFilteredRows();

  return (
    <div className="min-h-screen pt-24 pb-12 px-6 bg-surface-900">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="animate-slide-up">
          <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">
            Database <span className="gradient-text">Viewer</span>
          </h1>
          <p className="text-gray-400 text-sm">
            Dynamically analyze database tables, inspect columns definitions, types, and browse data rows.
          </p>
        </div>

        {/* Loading state for cards */}
        {loading ? (
          <div className="py-20 text-center text-gray-400">
            <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full mx-auto mb-4" />
            Reading database schema metadata...
          </div>
        ) : error ? (
          <div className="glass-card border-red-500/30 bg-red-500/5 p-6 text-center text-red-400">
            <span className="text-3xl mb-2 block">⚠️</span>
            <p className="font-semibold">{error}</p>
            <button onClick={fetchTables} className="btn-outline text-xs mt-4 px-4 py-2">
              Try Again
            </button>
          </div>
        ) : (
          /* Cards Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in">
            {tables.map((table) => {
              const isActive = selectedTable === table.tableName;
              const themeColor = getTableColor(table.tableName);
              return (
                <button
                  key={table.tableName}
                  onClick={() => selectTable(table.tableName)}
                  className={`w-full text-left p-6 rounded-2xl border bg-gradient-to-br transition-all duration-300 ${themeColor} ${
                    isActive 
                      ? 'border-white/40 ring-2 ring-white/10 scale-105' 
                      : 'border-white/10'
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-4xl">{getTableIcon(table.tableName)}</span>
                    <span className="text-xs bg-white/10 border border-white/10 px-2 py-0.5 rounded text-white font-mono">
                      {table.rowCount} Rows
                    </span>
                  </div>
                  
                  <h3 className="text-lg font-bold text-white mb-1 truncate">
                    {table.tableName}
                  </h3>
                  
                  <p className="text-xs text-gray-400">
                    Click to view table definition and browse records.
                  </p>
                </button>
              );
            })}
          </div>
        )}

        {/* Selected Table Workspace */}
        {selectedTable && (
          <div className="glass-card overflow-hidden animate-slide-up border-primary-500/20">
            
            {/* Header section */}
            <div className="bg-white/5 px-6 py-4 border-b border-white/10 flex justify-between items-center flex-wrap gap-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="text-2xl">{getTableIcon(selectedTable)}</span>
                  {selectedTable}
                </h2>
                <p className="text-xs text-gray-500 font-mono mt-0.5">
                  schema details &amp; browser
                </p>
              </div>

              <div className="flex gap-2">
                {tableDetails && tableDetails.rows && tableDetails.rows.length > 0 && (
                  <button
                    onClick={handleExportCSV}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 transition-all"
                  >
                    📥 Export CSV
                  </button>
                )}
                <button
                  onClick={() => { setSelectedTable(null); setTableDetails(null); }}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white transition-all"
                >
                  Close Viewer
                </button>
              </div>
            </div>

            {/* Inner details loading / contents */}
            {detailsLoading ? (
              <div className="py-20 text-center text-gray-400">
                <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full mx-auto mb-3" />
                Querying columns &amp; rows...
              </div>
            ) : detailsError ? (
              <div className="p-8 text-center text-red-400 text-sm">
                ❌ {detailsError}
              </div>
            ) : tableDetails ? (
              <div className="grid grid-cols-1 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-white/10">
                
                {/* Columns Definition list (1 Column wide) */}
                <div className="lg:col-span-1 p-6 space-y-4">
                  <h3 className="text-xs font-bold text-primary-400 uppercase tracking-wider">
                    Columns Definition
                  </h3>
                  <div className="space-y-3 font-mono text-xs max-h-96 overflow-y-auto pr-2">
                    {tableDetails.columns.map((col) => (
                      <div key={col.columnName} className="p-2.5 rounded-lg bg-white/5 border border-white/5 flex flex-col gap-1">
                        <div className="flex justify-between items-center">
                          <span className="text-white font-semibold break-all">{col.columnName}</span>
                          {col.columnKey === 'PRI' && (
                            <span className="text-[9px] bg-amber-500/25 border border-amber-500/30 text-amber-400 px-1 py-0.5 rounded font-bold uppercase">PK</span>
                          )}
                          {col.columnKey === 'MUL' && (
                            <span className="text-[9px] bg-purple-500/25 border border-purple-500/30 text-purple-400 px-1 py-0.5 rounded font-bold uppercase">FK</span>
                          )}
                        </div>
                        <div className="flex justify-between text-[10px] text-gray-500">
                          <span>{col.dataType.toUpperCase()}</span>
                          <span>{col.isNullable === 'YES' ? 'Nullable' : 'Not Null'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Rows data list (3 Columns wide) */}
                <div className="lg:col-span-3 p-6 space-y-4">
                  
                  {/* Row count / Search */}
                  <div className="flex justify-between items-center gap-4 flex-wrap">
                    <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider">
                      Records Grid ({filteredRows.length} found)
                    </h3>
                    <input
                      type="text"
                      value={rowSearch}
                      onChange={(e) => setRowSearch(e.target.value)}
                      placeholder="Filter records..."
                      className="bg-surface-800 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-primary-500 max-w-xs w-full"
                    />
                  </div>

                  {/* Table display */}
                  {filteredRows.length === 0 ? (
                    <div className="py-16 text-center text-gray-500 text-xs">
                      No records matched filter query.
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-96 border border-white/10 rounded-xl">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-white/5 border-b border-white/10 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                            {tableDetails.columns.map((col) => (
                              <th key={col.columnName} className="px-4 py-3 font-mono">
                                {col.columnName}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-xs text-gray-300">
                          {filteredRows.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-white/5 transition-colors">
                              {tableDetails.columns.map((col) => (
                                <td key={col.columnName} className="px-4 py-3 font-mono">
                                  {row[col.columnName] === null ? (
                                    <span className="text-gray-600 italic">NULL</span>
                                  ) : typeof row[col.columnName] === 'object' ? (
                                    JSON.stringify(row[col.columnName])
                                  ) : (
                                    '' + row[col.columnName]
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                </div>

              </div>
            ) : null}

          </div>
        )}

      </div>
    </div>
  );
}
