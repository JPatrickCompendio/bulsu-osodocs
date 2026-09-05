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
  SchoolYearPage,
  AcademicEventsPage,
  SubmissionWindowsPage,
  OrganizationActivitiesPage,
} from './pages/Pages';
import Completed from './pages/Completed';
import UserManagement from './pages/UserManagement';
import MyProfile from './pages/MyProfile';
import ResetPassword from './pages/ResetPassword';
import SetupAccount from './pages/SetupAccount';

const App = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/setup-account" element={<SetupAccount />} />

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
              <ProtectedRoute allowedRoles={['admin', 'chairman', 'vice-chairman']}>
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
            {/* Academic Dates - Distinct Pages */}
            <Route path="/admin/academic-dates" element={
              <ProtectedRoute allowedRoles={['admin', 'chairman', 'vice-chairman']}>
                <Navigate to="/admin/academic-dates/school-year" replace />
              </ProtectedRoute>
            } />
            <Route path="/admin/academic-dates/school-year" element={
              <ProtectedRoute allowedRoles={['admin', 'chairman', 'vice-chairman']}>
                <SchoolYearPage />
              </ProtectedRoute>
            } />
            <Route path="/admin/academic-dates/events" element={
              <ProtectedRoute allowedRoles={['admin', 'chairman', 'vice-chairman']}>
                <AcademicEventsPage />
              </ProtectedRoute>
            } />
            <Route path="/admin/academic-dates/submission-windows" element={
              <ProtectedRoute allowedRoles={['admin', 'chairman', 'vice-chairman']}>
                <SubmissionWindowsPage />
              </ProtectedRoute>
            } />
            <Route path="/admin/academic-dates/organization-activities" element={
              <ProtectedRoute allowedRoles={['admin', 'chairman', 'vice-chairman']}>
                <OrganizationActivitiesPage />
              </ProtectedRoute>
            } />
            <Route path="/admin/academic-settings" element={
              <ProtectedRoute allowedRoles={['admin', 'chairman', 'vice-chairman']}>
                <AcademicSettings />
              </ProtectedRoute>
            } />
            <Route path="/admin/academic-settings/:tab" element={
              <ProtectedRoute allowedRoles={['admin', 'chairman', 'vice-chairman']}>
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
