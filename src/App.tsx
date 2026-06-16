import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import SmartUpload from './pages/SmartUpload';
import StatementImport from './pages/StatementImport';
import CalendarView from './pages/Calendar';
import Insights from './pages/Insights';
import Auth from './pages/Auth';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { clearSession, isSessionExpired } from './lib/session';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('token');
  if (token && isSessionExpired()) {
    clearSession();
    return <Navigate to="/auth" />;
  }
  if (!token) return <Navigate to="/auth" />;
  return <Layout>{children}</Layout>;
};

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
        <Route path="/upload" element={<ProtectedRoute><SmartUpload /></ProtectedRoute>} />
        <Route path="/statement-import" element={<ProtectedRoute><StatementImport /></ProtectedRoute>} />
        <Route path="/calendar" element={<ProtectedRoute><CalendarView /></ProtectedRoute>} />
        <Route path="/insights" element={<ProtectedRoute><Insights /></ProtectedRoute>} />
      </Routes>
      <ToastContainer
        aria-label="Notifications"
        position="top-right"
        autoClose={3500}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
      />
    </Router>
  );
}
