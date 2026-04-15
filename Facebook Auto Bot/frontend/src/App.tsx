import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ConfigProvider, Spin } from 'antd';
import zhCN from 'antd/locale/zh_CN';

import { AuthProvider } from './store/authStore';
import ProtectedRoute from './components/ProtectedRoute';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const AccountsPage = lazy(() => import('./pages/AccountsPage'));
const TasksPage = lazy(() => import('./pages/TasksPage'));
const VPNPage = lazy(() => import('./pages/VPNPage'));
const LoginStatusPage = lazy(() => import('./pages/LoginStatusPage'));
const AntiDetectionPage = lazy(() => import('./pages/AntiDetectionPage'));
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage'));

const Loading = () => (
  <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh' }}>
    <Spin size="large" />
  </div>
);

const App: React.FC = () => {
  return (
    <ConfigProvider locale={zhCN}>
      <AuthProvider>
        <Router>
          <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/accounts"
              element={
                <ProtectedRoute>
                  <AccountsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tasks"
              element={
                <ProtectedRoute>
                  <TasksPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/vpn"
              element={
                <ProtectedRoute>
                  <VPNPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/login-status"
              element={
                <ProtectedRoute>
                  <LoginStatusPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/anti-detection"
              element={
                <ProtectedRoute>
                  <AntiDetectionPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute>
                  <AdminUsersPage />
                </ProtectedRoute>
              }
            />
          </Routes>
          </Suspense>
        </Router>
      </AuthProvider>
    </ConfigProvider>
  );
};

export default App;
