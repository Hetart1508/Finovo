import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import SmartUpload from './pages/SmartUpload';
import StatementImport from './pages/StatementImport';
import CalendarView from './pages/Calendar';
import Insights from './pages/Insights';
import Recurring from './pages/Recurring';
import Auth from './pages/Auth';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { clearSession, hasValidSession } from './lib/session';
import { useQueryClient } from '@tanstack/react-query';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  if (!hasValidSession()) {
    clearSession();
    return <Navigate to="/auth" replace />;
  }
  return <Layout>{children}</Layout>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  if (hasValidSession()) return <Navigate to="/" replace />;
  return children;
};

export default function App() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const clearServerState = () => queryClient.clear();
    window.addEventListener('session-expired', clearServerState);
    return () => window.removeEventListener('session-expired', clearServerState);
  }, [queryClient]);

  return (
    <Router>
      <Routes>
        <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
        <Route path="/upload" element={<ProtectedRoute><SmartUpload /></ProtectedRoute>} />
        <Route path="/statement-import" element={<ProtectedRoute><StatementImport /></ProtectedRoute>} />
        <Route path="/calendar" element={<ProtectedRoute><CalendarView /></ProtectedRoute>} />
        <Route path="/recurring" element={<ProtectedRoute><Recurring /></ProtectedRoute>} />
        <Route path="/insights" element={<ProtectedRoute><Insights /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
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
