import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import LoginPage from './pages/LoginPage';
import TLDashboard from './pages/TLDashboard';
import TLLogActivation from './pages/TLLogActivation';
import ASEDashboard from './pages/ASEDashboard';
import ZBMDashboard from './pages/ZBMDashboard';
import HSDDashboard from './pages/HSDDashboard';
import AdminPanel from './pages/AdminPanel';
import LeaderboardPage from './pages/LeaderboardPage';
import TLLogNumbers from './pages/TLLogNumbers';
import type { ReactNode } from 'react';

function ProtectedRoute({ children, allowedRoles }: { children: ReactNode; allowedRoles: string[] }) {
  const { user, isAuthenticated } = useAuthStore();
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(user.role)) {
    // Redirect to appropriate dashboard
    const roleMap: Record<string, string> = {
      TL: '/tl', ASE: '/ase', ZBM: '/zbm', HSD: '/hsd', ADMIN: '/admin',
    };
    return <Navigate to={roleMap[user.role] || '/login'} replace />;
  }
  return <>{children}</>;
}

function RoleRedirect() {
  const { user, isAuthenticated } = useAuthStore();
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  const roleMap: Record<string, string> = {
    TL: '/tl', ASE: '/ase', ZBM: '/zbm', HSD: '/hsd', ADMIN: '/admin',
  };
  return <Navigate to={roleMap[user.role] || '/login'} replace />;
}

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<RoleRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/tl"
          element={
            <ProtectedRoute allowedRoles={['TL']}>
              <TLDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tl/log"
          element={
            <ProtectedRoute allowedRoles={['TL']}>
              <TLLogActivation />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ase"
          element={
            <ProtectedRoute allowedRoles={['ASE', 'ADMIN']}>
              <ASEDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/zbm"
          element={
            <ProtectedRoute allowedRoles={['ZBM', 'ADMIN']}>
              <ZBMDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hsd"
          element={
            <ProtectedRoute allowedRoles={['HSD', 'ADMIN']}>
              <HSDDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AdminPanel />
            </ProtectedRoute>
          }
        />
        <Route
          path="/leaderboard"
          element={
            <ProtectedRoute allowedRoles={['HSD', 'ZBM', 'ASE', 'ADMIN']}>
              <LeaderboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tl/log-numbers"
          element={
            <ProtectedRoute allowedRoles={['TL']}>
              <TLLogNumbers />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
