import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import type { ReactNode } from 'react';
import Layout from './components/Layout';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { clearSession, hasValidSession } from './lib/session';
import { TOAST_AUTO_CLOSE_MS } from './lib/toastMessages';
import { useQueryClient } from '@tanstack/react-query';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Transactions = lazy(() => import('./pages/Transactions'));
const SmartUpload = lazy(() => import('./pages/SmartUpload'));
const StatementImport = lazy(() => import('./pages/StatementImport'));
const CalendarView = lazy(() => import('./pages/Calendar'));
const Insights = lazy(() => import('./pages/Insights'));
const Recurring = lazy(() => import('./pages/Recurring'));
const Investments = lazy(() => import('./pages/Investments'));
const AIWealthAdvisor = lazy(() => import('./pages/AIWealthAdvisor'));
const Profile = lazy(() => import('./pages/Profile'));
const Auth = lazy(() => import('./pages/Auth'));

const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4 text-sm font-semibold text-[#6B7280]">
    Loading...
  </div>
);

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  if (!hasValidSession()) {
    clearSession();
    return <Navigate to="/auth" replace />;
  }
  return <Layout>{children}</Layout>;
};

const PublicRoute = ({ children }: { children: ReactNode }) => {
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
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
          <Route path="/upload" element={<ProtectedRoute><SmartUpload /></ProtectedRoute>} />
          <Route path="/statement-import" element={<ProtectedRoute><StatementImport /></ProtectedRoute>} />
          <Route path="/calendar" element={<ProtectedRoute><CalendarView /></ProtectedRoute>} />
          <Route path="/recurring" element={<ProtectedRoute><Recurring /></ProtectedRoute>} />
          <Route path="/investments" element={<ProtectedRoute><Investments /></ProtectedRoute>} />
          <Route path="/wealth-advisor" element={<ProtectedRoute><AIWealthAdvisor /></ProtectedRoute>} />
          <Route path="/insights" element={<ProtectedRoute><Insights /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <ToastContainer
        aria-label="Notifications"
        position="top-right"
        autoClose={TOAST_AUTO_CLOSE_MS}
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
