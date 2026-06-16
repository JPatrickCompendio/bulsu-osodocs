import React from 'react';
import { Inbox as InboxComponent } from './Inbox';
import { MyDocuments as MyDocumentsComponent } from './MyDocument';

export { default as Dashboard, AdminDashboard, OrgDashboard } from './Dashboard';

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

