import React from 'react';
import { useAuth } from '../context/AuthContext';

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

export const Inbox = () => (
  <div>
    <PageHeader title="Inbox" />
    <Card>
      <p className="text-gray-600">No new messages in your inbox.</p>
    </Card>
  </div>
);

export const MyDocuments = () => (
  <div>
    <PageHeader title="My Documents" />
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="py-4 font-semibold text-gray-600">Document Title</th>
              <th className="py-4 font-semibold text-gray-600">Status</th>
              <th className="py-4 font-semibold text-gray-600">Date Modified</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-50">
              <td className="py-4">Organization Bylaws</td>
              <td className="py-4"><span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">Approved</span></td>
              <td className="py-4 text-gray-400 text-sm">Oct 24, 2023</td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  </div>
);

// Moved to separate file: UserManagement.jsx

export const ListOfRequirements = () => (
  <div>
    <PageHeader title="List of Requirements" />
    <Card>
      <div className="space-y-4">
        {['Accreditation Form', 'List of Officers', 'Activity Proposal', 'Financial Plan'].map(req => (
          <div key={req} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:border-secondary-gold transition-colors">
            <span className="font-medium text-gray-700">{req}</span>
            <span className="text-xs text-gray-400 font-mono uppercase">Required</span>
          </div>
        ))}
      </div>
    </Card>
  </div>
);

export const Completed = () => (
  <div>
    <PageHeader title="Completed" />
    <Card>
      <p className="text-gray-600">List of all completed document processes.</p>
    </Card>
  </div>
);

export const SubmitNewDocuments = () => (
  <div>
    <PageHeader title="Submit New Documents" />
    <Card>
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Document Title</label>
          <input className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-green outline-none" placeholder="e.g. Activity Report" />
        </div>
        <div className="border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center hover:border-primary-green transition-colors">
          <p className="text-gray-400">Drag and drop files here or click to browse</p>
        </div>
        <button className="bg-primary-green text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:shadow-primary-green/20 transition-all">
          Upload Document
        </button>
      </div>
    </Card>
  </div>
);
