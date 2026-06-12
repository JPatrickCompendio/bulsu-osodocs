import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Inbox as InboxComponent } from './Inbox';
import { MyDocuments as MyDocumentsComponent } from './MyDocument';
import { 
  Search, 
  Filter, 
  MoreVertical, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  FileText, 
  User, 
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  ArrowUpRight,
  RefreshCcw,
  Eye,
  Check,
  RotateCcw,
  Archive,
  Trash2,
  Mail,
  MoreHorizontal,
  ChevronDown,
  List,
  Calendar,
  Paperclip,
  X
} from 'lucide-react';

const PageHeader = ({ title }) => (
  <div className="mb-8">
    <h1 className="text-3xl font-bold text-gray-800">{title}</h1>
    <p className="text-gray-500 mt-1">Manage your {title.toLowerCase()} and activities here.</p>
  </div>
);

const Card = ({ title, children }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
    {title && <h2 className="text-xl font-semibold mb-4 text-gray-700">{title}</h2>}
    {children}
  </div>
);

export const Dashboard = () => {
  const { user } = useAuth();
  if (user?.role === 'admin' || user?.role === 'chairman' || user?.role === 'vice-chairman') {
    return <AdminDashboardComponent />;
  }
  if (user?.role === 'org-president') {
    return <OrgDashboardComponent />;
  }
  return (
    <div>
      <PageHeader title="Dashboard" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card title="Total Documents">
          <p className="text-4xl font-bold text-primary-green">12</p>
        </Card>
        <Card title="Pending Actions">
          <p className="text-4xl font-bold text-secondary-gold">5</p>
        </Card>
        <Card title="Completed">
          <p className="text-4xl font-bold text-blue-500">28</p>
        </Card>
      </div>
      <Card title="Recent Activity">
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-4 py-2 border-b border-gray-50 last:border-0">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-primary-green font-bold">
                {i}
              </div>
              <div>
                <p className="font-medium text-gray-800">Document #{i * 123} was updated</p>
                <p className="text-xs text-gray-400">2 hours ago</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export const Inbox = InboxComponent;

export const MyDocuments = MyDocumentsComponent;

// Moved to separate file: UserManagement.jsx

import ListOfRequirementsComponent from './ListOfRequirements';

import SubmitNewDocumentComponent from './SubmitNewDocument';

import AnnouncementManagementComponent from './AnnouncementManagement';

export const ListOfRequirements = ListOfRequirementsComponent;

export const SubmitNewDocuments = SubmitNewDocumentComponent;

export const AnnouncementManagement = AnnouncementManagementComponent;

import AcademicSettingsComponent from './AcademicSettings';
export const AcademicSettings = AcademicSettingsComponent;

import AdminDashboardComponent from './AdminDashboard';
export const AdminDashboard = AdminDashboardComponent;

import OrgDashboardComponent from './OrgDashboard';
export const OrgDashboard = OrgDashboardComponent;

