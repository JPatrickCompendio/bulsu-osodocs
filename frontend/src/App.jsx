import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './components/DashboardLayout';
import Login from './pages/Login';
import { 
  Dashboard, 
  Inbox, 
  MyDocuments, 
  ListOfRequirements, 
  DocumentTypeSettings,
  SubmitNewDocuments,
  AnnouncementManagement,
  AcademicSettings,
} from './pages/Pages';
import Completed from './pages/Completed';
import UserManagement from './pages/UserManagement';
import MyProfile from './pages/MyProfile';

const App = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Route */}
          <Route path="/login" element={<Login />} />

          {/* Protected Routes */}
          <Route element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }>
            <Route path="/" element={<Dashboard />} />
            <Route path="/inbox" element={<Inbox />} />
            <Route path="/my-documents" element={<MyDocuments />} />
            <Route path="/requirements" element={<ListOfRequirements />} />
            <Route path="/requirements/settings/:typeId" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <DocumentTypeSettings />
              </ProtectedRoute>
            } />
            <Route path="/profile" element={<MyProfile />} />
            
            {/* Admin only */}
            <Route path="/users" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <UserManagement />
              </ProtectedRoute>
            } />
            <Route path="/admin/announcements" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AnnouncementManagement />
              </ProtectedRoute>
            } />
            <Route path="/admin/academic-settings" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AcademicSettings />
              </ProtectedRoute>
            } />

            {/* Role specific */}
            <Route path="/completed" element={
              <ProtectedRoute allowedRoles={['chairman', 'vice-chairman', 'org-president', 'admin']}>
                <Completed />
              </ProtectedRoute>
            } />
            
            <Route path="/submit" element={
              <ProtectedRoute allowedRoles={['org-president']}>
                <SubmitNewDocuments />
              </ProtectedRoute>
            } />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
