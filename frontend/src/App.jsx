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
  Completed, 
  SubmitNewDocuments 
} from './pages/Pages';
import UserManagement from './pages/UserManagement';

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
            
            {/* Admin only */}
            <Route path="/users" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <UserManagement />
              </ProtectedRoute>
            } />

            {/* Role specific */}
            <Route path="/completed" element={
              <ProtectedRoute allowedRoles={['chairman', 'vice-chairman', 'org-president']}>
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
