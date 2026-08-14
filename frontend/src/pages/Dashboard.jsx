import { useState, useEffect } from 'react';
import axiosClient from '../api/axiosClient';

export default function Dashboard() {
  // System Health States
  const [health, setHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState(null);

  // Active Tab: 'schema' | 'data' | 'api'
  const [activeTab, setActiveTab] = useState('schema');

  // Data Explorer States
  const [selectedTable, setSelectedTable] = useState('departments'); // 'departments' | 'courses' | 'students'
  const [tableData, setTableData] = useState([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [tableError, setTableError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDept, setFilterDept] = useState(''); // for filtering courses/students by department
  const [departmentsList, setDepartmentsList] = useState([]); // to populate department filter dropdown

  // API/Query Inspector States
  const [apiPreset, setApiPreset] = useState('all-departments');
  const [apiResponse, setApiResponse] = useState(null);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiUrl, setApiUrl] = useState('');

  // Fetch system health on mount and periodically
  useEffect(() => {
    const fetchHealth = async () => {
      try {
        setHealthLoading(true);
        const response = await axiosClient.get('/health');
        setHealth(response.data);
        setHealthError(null);
      } catch (err) {
        setHealthError(err.message || 'Failed to connect to backend');
        setHealth(null);
      } finally {
        setHealthLoading(false);
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch departments list for filters
  useEffect(() => {
    const fetchDepts = async () => {
      try {
        const response = await axiosClient.get('/departments');
        setDepartmentsList(response.data);
      } catch (err) {
        console.error('Error fetching departments:', err);
      }
    };
    fetchDepts();
  }, [health]);

  // Fetch table data based on selection, search, and filters
  const fetchTableData = async () => {
    setTableLoading(true);
    setTableError(null);
    try {
      let endpoint = `/${selectedTable}`;
      
      // If there is a department filter applied
      if (filterDept && (selectedTable === 'courses' || selectedTable === 'students')) {
        endpoint = `/${selectedTable}/department/${filterDept}`;
      } else if (searchQuery) {
        endpoint = `/${selectedTable}/search?name=${encodeURIComponent(searchQuery)}`;
      }

      const response = await axiosClient.get(endpoint);
      setTableData(response.data);
    } catch (err) {
      setTableError(err.response?.data?.message || err.message || 'Error fetching data');
      setTableData([]);
    } finally {
      setTableLoading(false);
    }
  };

  useEffect(() => {
    fetchTableData();
  }, [selectedTable, filterDept]);

  // Execute API Presets
  const executeApiPreset = async (presetKey) => {
    setApiLoading(true);
    setApiResponse(null);
    let endpoint = '/departments';
    
    switch (presetKey) {
      case 'all-departments':
        endpoint = '/departments';
        break;
      case 'all-courses':
        endpoint = '/courses';
        break;
      case 'all-students':
        endpoint = '/students';
        break;
      case 'cse-students':
        // Find CSE department ID first or default to 1
        const cseDept = departmentsList.find(d => d.code === 'CSE');
        endpoint = `/students/department/${cseDept?.id || 1}`;
        break;
      case 'semester-5-courses':
        endpoint = '/courses/semester/5';
        break;
      case 'student-by-roll':
        endpoint = '/students/roll/CSE2024001';
        break;
      default:
        endpoint = '/departments';
    }

    setApiUrl(`/api${endpoint}`);
    try {
      const response = await axiosClient.get(endpoint);
      setApiResponse(response.data);
    } catch (err) {
      setApiResponse({ error: err.message, response: err.response?.data });
    } finally {
      setApiLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'api') {
      executeApiPreset(apiPreset);
    }
  }, [apiPreset, activeTab, departmentsList]);

  // Helper to highlight active tab styling
  const tabClass = (tab) => 
    `flex-1 py-3 text-center text-sm font-semibold border-b-2 transition-all duration-300 ${
      activeTab === tab 
        ? 'border-primary-500 text-primary-400 bg-primary-500/5' 
        : 'border-white/10 text-gray-400 hover:text-white hover:bg-white/5'
    }`;

  return (
    <div className="min-h-screen pt-24 pb-12 px-6 bg-surface-900">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="mb-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4 animate-slide-up">
          <div>
            <h1 className="text-4xl font-extrabold text-white tracking-tight mb-2">
              DBMS <span className="gradient-text">Visualizer</span> Dashboard
            </h1>
            <p className="text-gray-400 text-lg">
              Explore your MySQL tables, relations, and query data in real time.
            </p>
          </div>

          {/* Connection status mini card */}
          <div className="glass-card px-5 py-3 flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${
              healthLoading ? 'bg-amber-400 animate-pulse' : health ? 'bg-emerald-400' : 'bg-red-400'
            }`} />
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Database</div>
              <div className="text-sm font-bold text-white">
                {healthLoading ? 'Checking...' : health?.database === 'connected' ? 'Connected (MySQL)' : 'Disconnected'}
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="glass-card mb-8 overflow-hidden flex">
          <button onClick={() => setActiveTab('schema')} className={tabClass('schema')}>
            📐 Schema Relation Visualizer
          </button>
          <button onClick={() => setActiveTab('data')} className={tabClass('data')}>
            🐬 Real-Time Table Explorer
          </button>
          <button onClick={() => setActiveTab('api')} className={tabClass('api')}>
            🔌 API Inspector & Presets
          </button>
        </div>

        {/* ==================== TAB 1: SCHEMA RELATION VISUALIZER ==================== */}
        {activeTab === 'schema' && (
          <div className="space-y-8 animate-fade-in">
            {/* Intro Alert */}
            <div className="glass-card bg-primary-500/5 border-primary-500/20 p-5 flex gap-4">
              <span className="text-2xl">📐</span>
              <div>
                <h3 className="font-semibold text-primary-400 mb-1">Entity-Relationship Overview</h3>
                <p className="text-sm text-gray-400 leading-relaxed">
                  The relational schema of <strong>dbms_visualizer</strong> contains three primary entities. 
                  A <strong>Department</strong> manages multiple <strong>Courses</strong> and <strong>Students</strong> (One-to-Many relationships represented by foreign keys pointing back to Department).
                </p>
              </div>
            </div>

            {/* Interactive Cards (ER Diagram Style) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative">
              
              {/* Card 1: Department */}
              <div className="glass-card border-primary-500/30 hover:border-primary-500/50 p-6 flex flex-col justify-between transition-all duration-300 relative group">
                <div className="absolute top-0 right-0 p-3 text-xs bg-primary-500/10 text-primary-400 font-mono rounded-bl-xl border-l border-b border-primary-500/10">
                  Primary Table
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-2xl">🏢</span>
                    <h3 className="text-xl font-bold text-white">Department</h3>
                  </div>
                  <p className="text-xs text-gray-400 mb-4">Holds college faculties/branches.</p>
                  
                  <div className="space-y-3 font-mono text-xs">
                    <div className="flex justify-between border-b border-white/5 pb-1">
                      <span className="text-primary-400 font-bold">id (PK)</span>
                      <span className="text-gray-500">BIGINT</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1">
                      <span className="text-white">name</span>
                      <span className="text-gray-500">VARCHAR(100)</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1">
                      <span className="text-white">code (UQ)</span>
                      <span className="text-gray-500">VARCHAR(10)</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1">
                      <span className="text-white">description</span>
                      <span className="text-gray-500">TEXT</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">created_at / updated_at</span>
                      <span className="text-gray-600">TIMESTAMP</span>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-4 border-t border-white/5 text-xs text-gray-400">
                  ⚠️ Has relationships with:
                  <ul className="list-disc pl-4 mt-1 space-y-1 text-primary-400">
                    <li>One-to-Many with Course</li>
                    <li>One-to-Many with Student</li>
                  </ul>
                </div>
              </div>

              {/* Card 2: Course */}
              <div className="glass-card border-purple-500/30 hover:border-purple-500/50 p-6 flex flex-col justify-between transition-all duration-300 relative">
                <div className="absolute top-0 right-0 p-3 text-xs bg-purple-500/10 text-purple-400 font-mono rounded-bl-xl border-l border-b border-purple-500/10">
                  Foreign Keys
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-2xl">📚</span>
                    <h3 className="text-xl font-bold text-white">Course</h3>
                  </div>
                  <p className="text-xs text-gray-400 mb-4">Academic syllabus and units.</p>

                  <div className="space-y-3 font-mono text-xs">
                    <div className="flex justify-between border-b border-white/5 pb-1">
                      <span className="text-purple-400 font-bold">id (PK)</span>
                      <span className="text-gray-500">BIGINT</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1">
                      <span className="text-white">name</span>
                      <span className="text-gray-500">VARCHAR(150)</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1">
                      <span className="text-white">code (UQ)</span>
                      <span className="text-gray-500">VARCHAR(15)</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1">
                      <span className="text-white">credits</span>
                      <span className="text-gray-500">INT</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1">
                      <span className="text-white">semester</span>
                      <span className="text-gray-500">INT</span>
                    </div>
                    <div className="flex justify-between border-b border-purple-500/20 pb-1 bg-purple-500/5 px-1">
                      <span className="text-purple-400 font-bold">department_id (FK)</span>
                      <span className="text-gray-500">BIGINT</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">created_at / updated_at</span>
                      <span className="text-gray-600">TIMESTAMP</span>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-4 border-t border-white/5 text-xs text-gray-400">
                  🔗 Linked to:
                  <ul className="list-disc pl-4 mt-1 space-y-1 text-purple-400">
                    <li>Department Table (FK)</li>
                  </ul>
                </div>
              </div>

              {/* Card 3: Student */}
              <div className="glass-card border-pink-500/30 hover:border-pink-500/50 p-6 flex flex-col justify-between transition-all duration-300 relative">
                <div className="absolute top-0 right-0 p-3 text-xs bg-pink-500/10 text-pink-400 font-mono rounded-bl-xl border-l border-b border-pink-500/10">
                  Foreign Keys
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-2xl">🎓</span>
                    <h3 className="text-xl font-bold text-white">Student</h3>
                  </div>
                  <p className="text-xs text-gray-400 mb-4">Enrolled university members.</p>

                  <div className="space-y-3 font-mono text-xs">
                    <div className="flex justify-between border-b border-white/5 pb-1">
                      <span className="text-pink-400 font-bold">id (PK)</span>
                      <span className="text-gray-500">BIGINT</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1">
                      <span className="text-white">name</span>
                      <span className="text-gray-500">VARCHAR(100)</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1">
                      <span className="text-white">email (UQ)</span>
                      <span className="text-gray-500">VARCHAR(150)</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1">
                      <span className="text-white">roll_number (UQ)</span>
                      <span className="text-gray-500">VARCHAR(20)</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1">
                      <span className="text-white">year_of_study</span>
                      <span className="text-gray-500">INT</span>
                    </div>
                    <div className="flex justify-between border-b border-pink-500/20 pb-1 bg-pink-500/5 px-1">
                      <span className="text-pink-400 font-bold">department_id (FK)</span>
                      <span className="text-gray-500">BIGINT</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">created_at / updated_at</span>
                      <span className="text-gray-600">TIMESTAMP</span>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-4 border-t border-white/5 text-xs text-gray-400">
                  🔗 Linked to:
                  <ul className="list-disc pl-4 mt-1 space-y-1 text-pink-400">
                    <li>Department Table (FK)</li>
                  </ul>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ==================== TAB 2: REAL-TIME TABLE EXPLORER ==================== */}
        {activeTab === 'data' && (
          <div className="space-y-6 animate-fade-in">
            
            {/* Search, Filter, and Table Select controls */}
            <div className="glass-card p-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
              
              {/* Select Table */}
              <div>
                <label className="block text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">Select Table</label>
                <div className="flex gap-2">
                  {['departments', 'courses', 'students'].map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        setSelectedTable(t);
                        setSearchQuery('');
                        setFilterDept('');
                      }}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold capitalize transition-all duration-300 ${
                        selectedTable === t 
                          ? 'bg-primary-500 text-white' 
                          : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Department Filter (Only for Courses and Students) */}
              <div>
                <label className="block text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">Filter by Department</label>
                <select
                  disabled={selectedTable === 'departments'}
                  value={filterDept}
                  onChange={(e) => {
                    setFilterDept(e.target.value);
                    setSearchQuery('');
                  }}
                  className="w-full bg-surface-800 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">All Departments</option>
                  {departmentsList.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name} ({dept.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Search by Name */}
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-400 font-semibold uppercase tracking-wider mb-2">Search Name</label>
                <form onSubmit={(e) => { e.preventDefault(); fetchTableData(); }} className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={`Search in ${selectedTable}...`}
                    className="flex-grow bg-surface-800 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-primary-500"
                  />
                  <button
                    type="submit"
                    className="bg-primary-600 hover:bg-primary-500 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-all"
                  >
                    Search
                  </button>
                </form>
              </div>
            </div>

            {/* Results Table */}
            <div className="glass-card overflow-hidden">
              {tableLoading ? (
                <div className="py-20 text-center text-gray-400">
                  <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full mx-auto mb-4" />
                  Fetching records from database...
                </div>
              ) : tableError ? (
                <div className="py-20 text-center text-red-400">
                  <span className="text-3xl mb-2 block">❌</span>
                  {tableError}
                </div>
              ) : tableData.length === 0 ? (
                <div className="py-20 text-center text-gray-500">
                  No records found in table "{selectedTable}".
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white/5 border-b border-white/10 text-xs font-semibold uppercase tracking-wider text-gray-400">
                        <th className="px-6 py-4">ID</th>
                        {selectedTable === 'departments' && (
                          <>
                            <th className="px-6 py-4">Name</th>
                            <th className="px-6 py-4">Code</th>
                            <th className="px-6 py-4">Description</th>
                          </>
                        )}
                        {selectedTable === 'courses' && (
                          <>
                            <th className="px-6 py-4">Course Name</th>
                            <th className="px-6 py-4">Code</th>
                            <th className="px-6 py-4">Credits</th>
                            <th className="px-6 py-4">Semester</th>
                            <th className="px-6 py-4">Department</th>
                          </>
                        )}
                        {selectedTable === 'students' && (
                          <>
                            <th className="px-6 py-4">Student Name</th>
                            <th className="px-6 py-4">Email Address</th>
                            <th className="px-6 py-4">Roll Number</th>
                            <th className="px-6 py-4">Year of Study</th>
                            <th className="px-6 py-4">Department</th>
                          </>
                        )}
                        <th className="px-6 py-4 text-right">Created At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-xs text-gray-300">
                      {tableData.map((row) => (
                        <tr key={row.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4 font-mono font-bold text-primary-400">{row.id}</td>
                          
                          {/* Departments table columns */}
                          {selectedTable === 'departments' && (
                            <>
                              <td className="px-6 py-4 font-semibold text-white">{row.name}</td>
                              <td className="px-6 py-4"><span className="bg-primary-500/10 border border-primary-500/20 text-primary-400 px-2 py-0.5 rounded font-mono font-semibold">{row.code}</span></td>
                              <td className="px-6 py-4 text-gray-400 max-w-xs truncate">{row.description || '—'}</td>
                            </>
                          )}

                          {/* Courses table columns */}
                          {selectedTable === 'courses' && (
                            <>
                              <td className="px-6 py-4 font-semibold text-white">{row.name}</td>
                              <td className="px-6 py-4"><span className="bg-purple-500/10 border border-purple-500/20 text-purple-400 px-2 py-0.5 rounded font-mono font-semibold">{row.code}</span></td>
                              <td className="px-6 py-4 font-mono">{row.credits} Credits</td>
                              <td className="px-6 py-4">Sem {row.semester || '—'}</td>
                              <td className="px-6 py-4 text-gray-400">{row.departmentName || 'None'}</td>
                            </>
                          )}

                          {/* Students table columns */}
                          {selectedTable === 'students' && (
                            <>
                              <td className="px-6 py-4 font-semibold text-white">{row.name}</td>
                              <td className="px-6 py-4 font-mono text-gray-400">{row.email}</td>
                              <td className="px-6 py-4 font-mono font-semibold text-pink-400">{row.rollNumber}</td>
                              <td className="px-6 py-4">{row.yearOfStudy} Year</td>
                              <td className="px-6 py-4 text-gray-400">{row.departmentName || 'None'}</td>
                            </>
                          )}

                          <td className="px-6 py-4 text-right text-gray-500 font-mono">
                            {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== TAB 3: API INSPECTOR & PRESETS ==================== */}
        {activeTab === 'api' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
            
            {/* Left side: Presets menu */}
            <div className="lg:col-span-1 space-y-4">
              <div className="glass-card p-6">
                <h3 className="text-white font-bold mb-4 text-sm uppercase tracking-wider text-primary-400">
                  Select API Preset
                </h3>
                <div className="flex flex-col gap-2">
                  {[
                    { key: 'all-departments', label: '📂 Get All Departments', path: '/api/departments' },
                    { key: 'all-courses', label: '📚 Get All Courses', path: '/api/courses' },
                    { key: 'all-students', label: '🎓 Get All Students', path: '/api/students' },
                    { key: 'cse-students', label: '💻 Students in CSE Department', path: '/api/students/department/{id}' },
                    { key: 'semester-5-courses', label: '🗓️ Courses in Semester 5', path: '/api/courses/semester/5' },
                    { key: 'student-by-roll', label: '🔍 Find Student by Roll Number', path: '/api/students/roll/CSE2024001' },
                  ].map((preset) => (
                    <button
                      key={preset.key}
                      onClick={() => setApiPreset(preset.key)}
                      className={`text-left p-3 rounded-xl text-xs font-semibold border transition-all duration-300 ${
                        apiPreset === preset.key
                          ? 'bg-primary-500/10 border-primary-500/40 text-primary-400'
                          : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <div className="mb-1">{preset.label}</div>
                      <div className="font-mono text-[10px] text-gray-500">{preset.path}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right side: Inspector Panel */}
            <div className="lg:col-span-2 space-y-4">
              
              {/* Endpoint path indicator */}
              <div className="glass-card p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 overflow-hidden">
                  <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded text-xs font-mono font-bold">
                    GET
                  </span>
                  <span className="font-mono text-xs text-gray-300 truncate">{apiUrl || '/api/departments'}</span>
                </div>
                <button
                  onClick={() => executeApiPreset(apiPreset)}
                  className="bg-primary-600 hover:bg-primary-500 text-white font-semibold text-xs px-4 py-2 rounded-lg transition-all"
                >
                  Send Request
                </button>
              </div>

              {/* JSON code box */}
              <div className="glass-card overflow-hidden">
                <div className="bg-white/5 px-6 py-3 border-b border-white/10 flex justify-between items-center">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Response Payload</span>
                  {apiLoading && <span className="text-xs text-primary-400 animate-pulse">Running query...</span>}
                </div>
                
                <div className="p-6">
                  {apiLoading ? (
                    <div className="py-20 text-center text-gray-400">
                      <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full mx-auto mb-4" />
                      Executing query API...
                    </div>
                  ) : apiResponse ? (
                    <pre className="bg-surface-800 rounded-xl p-4 text-xs font-mono text-gray-300 overflow-auto max-h-[480px]">
                      {JSON.stringify(apiResponse, null, 2)}
                    </pre>
                  ) : (
                    <div className="py-20 text-center text-gray-500 text-xs">
                      No response loaded. Send request to inspect data.
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
