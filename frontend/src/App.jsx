import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import SqlEditor from './pages/SqlEditor';
import DatabaseViewer from './pages/DatabaseViewer';
import IndexVisualizer from './pages/IndexVisualizer';
import TransactionVisualizer from './pages/TransactionVisualizer';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-surface-900">
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/sql-editor" element={<SqlEditor />} />
          <Route path="/db-viewer" element={<DatabaseViewer />} />
          <Route path="/index-visualizer" element={<IndexVisualizer />} />
          <Route path="/transaction-visualizer" element={<TransactionVisualizer />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
