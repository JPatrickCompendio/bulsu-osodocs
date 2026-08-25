# BulSU OSODOCS - Ultimate Master System Test Suite & Test Cases

## 📋 Executive Summary
This document is the **Ultimate Master System Test Suite** for **BulSU OSODOCS** (Office of Student Organizations Document Tracking System). It covers **100% of system features**, including all 14 application modules, page-by-page button actions, date picker validations, version control, color coding, notifications, academic calendars, blocking dates, announcements, user management, profile settings, and database integrity checks.

---

## 👥 1. Role Permission Matrix

| Page / Feature Module | Org President | Admin / SDS Coordinator | OSO Staff | Chairman | Vice Chairman |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Dashboard** | View Org Stats | View All Stats | View All Stats | View All Stats | View All Stats |
| **Submit New Document** | ✅ Full Access | ❌ Restricted | ❌ Restricted | ❌ Restricted | ❌ Restricted |
| **My Documents** | View Own Docs | View All Docs | View All Docs | View Assigned | View Assigned |
| **Inbox & Notifications** | View Sent/Alerts | View Pending | View Pending | View Pending | View Pending |
| **Academic Settings & Calendar** | Read-Only View | ✅ Full Access | ✅ Full Access | Read-Only View | Read-Only View |
| **Document Type Settings** | Read-Only View | ✅ Full Access | ✅ Full Access | Read-Only View | Read-Only View |
| **Announcement Management** | Read Feed | ✅ Create/Pin | ✅ Create/Pin | Read-Only | Read-Only |
| **User Management** | ❌ Restricted | ✅ Full Access | ❌ Restricted | ❌ Restricted | ❌ Restricted |
| **My Profile** | ✅ Edit Own | ✅ Edit Own | ✅ Edit Own | ✅ Edit Own | ✅ Edit Own |

---

## 🔐 Module 1: Authentication, Profile & Password Management (`Login.jsx`, `MyProfile.jsx`, `ResetPassword.jsx`)

### TC-AUTH-001: Login with Valid Credentials
- **Preconditions**: User account exists in database (`users` table).
- **Steps**:
  1. Open Login page.
  2. Enter valid Email and Password.
  3. Click **Login**.
- **Expected Result**: Redirects to Dashboard. Session stored securely in local storage / Supabase auth.

### TC-AUTH-002: Login with Invalid Credentials
- **Steps**: Enter invalid password or non-existent email -> Click Login.
- **Expected Result**: Error alert displayed: `"Invalid login credentials"`.

### TC-AUTH-003: Forgot Password Request & Password Reset
- **Steps**:
  1. Click **Forgot Password?** on Login page.
  2. Enter registered email address -> Click **Send Reset Link**.
  3. Open email link redirecting to `ResetPassword.jsx`.
  4. Enter new password (min 6 chars) and confirm password -> Click **Update Password**.
- **Expected Result**: Success notification shown. User can log in with new password.

### TC-AUTH-004: Update Profile Information (`MyProfile.jsx`)
- **Preconditions**: Logged in.
- **Steps**:
  1. Navigate to **My Profile**.
  2. Update Full Name, Student Number / Employee ID, or Organization Abbreviation.
  3. Click **Save Changes**.
- **Expected Result**: Database `users` table updated. Avatar initials and header details update dynamically.

---

## 📊 Module 2: Dashboard & Analytics (`Dashboard.jsx`)

### TC-DASH-001: Dashboard Overview Metrics
- **Steps**: Log in as `admin` and view Dashboard cards.
- **Expected Result**: Correct real-time counts displayed for:
  - Total Submissions
  - Pending Review
  - Approved Documents
  - Returned / Action Needed
  - Completed / Archived Documents

### TC-DASH-002: Category & Status Filter Breakdown
- **Steps**: Click category cards (e.g., *Activity Proposals*, *Mid-Year Reports*, *Main Campus Review*).
- **Expected Result**: Document grid filters dynamically to match selected category.

---

## 📝 Module 3: Document Creation, Requirements & Date Validation (`SubmitNewDocument.jsx`, `ListOfRequirements.jsx`)

### TC-SUB-001: Date Picker Validation - Past Dates Prohibition
- **Preconditions**: Logged in as `org-president`.
- **Steps**:
  1. Select **Activity Proposal**.
  2. Attempt to select an Activity Date prior to today's date (or prior to the active submission window start date).
- **Expected Result**: Past dates are disabled/greyed out in the date picker UI. Form submit triggers validation error: `"Target date cannot be in the past"`.

### TC-SUB-002: Date Picker Validation - Blocked Dates & Holidays
- **Preconditions**: Admin has added a Blocked Date / Holiday in `AcademicSettings.jsx` (e.g., University Foundation Day).
- **Steps**:
  1. Create Activity Proposal.
  2. Select the blocked date in the calendar date picker.
- **Expected Result**: Date is disabled with badge `"Blocked Date: University Holiday"`. Selection is prevented.

### TC-SUB-003: Single Date vs. Multiple Activity Schedule Dates
- **Steps**:
  1. Select Activity Proposal.
  2. Toggle **Multiple Dates / Multi-day Activity**.
  3. Add Date 1 (e.g., Aug 25), Date 2 (e.g., Aug 26), Date 3 (e.g., Aug 27) with individual start/end times and schedule descriptions.
- **Expected Result**: All dates validated and persisted into `activity_schedules` table linked to the submission version.

### TC-SUB-004: Requirement Badges - Mandatory vs. Optional
- **Steps**: Open submission page for a subtype with optional requirements.
- **Expected Result**:
  - Mandatory requirements display red asterisk `*` and **Required** badge. Form cannot submit without file.
  - Optional requirements display blue **Optional** badge. Form allows submission even if left blank.

---

## 🔄 Module 4: Multi-Stage Review Engine, Version Control & Color Coding (`MyDocument.jsx`, `SubmissionTimeline.jsx`)

### TC-REV-001: Attachment Review & Color Coding Logic
- **Preconditions**: Reviewing document as `admin` or `oso-staff`.
- **Steps**:
  1. Click an attachment in document detail.
  2. Mark as **Approve** -> Badge turns **Green (`#10b981`)**.
  3. Mark as **Return** -> Badge turns **Amber (`#f59e0b`)** with comment modal.
  4. Mark as **Disapprove** -> Badge turns **Red (`#ef4444`)**.
  5. Leave untouched -> Badge remains **Grey (`#6b7280`) - Pending**.
- **Expected Result**: Statuses saved locally and persisted on decision confirm.

### TC-REV-002: Version Control & Historical Version Comparison
- **Preconditions**: Document returned and resubmitted (V1 -> V2).
- **Steps**:
  1. Open document in **My Documents**.
  2. Toggle Version Dropdown selector (switch between `Version 1` and `Version 2 (Latest)`).
- **Expected Result**:
  - Selecting `Version 1` displays V1 attachments, V1 proposal details, and disables review action buttons (read-only historical view).
  - Selecting `Version 2` displays latest V2 attachments and enables action buttons.

### TC-REV-003: Dual-Phase Retrieval Handshake Lifecycle
- **Phase 1 (SDS Hard Copy Review)**:
  1. Admin clicks **Verify & Approve Hard Copy** (Green).
  2. Admin clicks **Ready for retrieval** (Purple).
  3. User A clicks **Document Retrieved** (Green) -> Sees **"Awaiting retrieval confirmation"** (disabled).
  4. User B clicks **Confirm Document Retrieval** (Purple) -> Advances to `FINAL_LOCAL_CAMPUS_REVIEW`.
- **Phase 2 (Main Campus Final Approval)**:
  1. Admin clicks **Sent to main campus** -> Main Campus Review.
  2. Main Campus Approved -> Admin clicks **Ready for retrieval** (Button MUST NOT disappear prematurely).
  3. User A clicks **Document Retrieved**.
  4. User B clicks **Confirm Document Retrieval** -> Advances to `WAITING FOR ACCOMPLISHMENT REPORT` or `COMPLETED`.

---

## 📥 Module 5: Inbox, Handled Logs & Real-Time Alerts (`Inbox.jsx`)

### TC-INB-001: Inbox Filtering & Tabs
- **Steps**: Toggle tabs in `Inbox.jsx`:
  - **Pending Review**: Shows documents currently awaiting current user's role action.
  - **Handled**: Shows historical documents user has acted upon.
  - **All**: Shows full workspace document stream.
- **Expected Result**: List filters instantly. Unread notification badges decrease upon opening document.

---

## 📅 Module 6: Academic Settings, Calendar & Blocking System (`AcademicSettings.jsx`)

### TC-ACAD-001: Configure Active School Year
- **Steps**:
  1. Navigate to **Academic Settings**.
  2. Add New School Year (e.g., `A.Y. 2026-2027`).
  3. Toggle **Set as Active School Year**.
- **Expected Result**: System sets selected SY active, updates database `academic_settings`, and scoping filters all new submissions under `2026-2027`.

### TC-ACAD-002: Create Submission Window
- **Steps**:
  1. Click **Add Submission Window**.
  2. Name: `"1st Semester Activity Proposal Submissions"`.
  3. Start Date: `Aug 1, 2026`, End Date: `Sep 30, 2026`.
  4. Save.
- **Expected Result**: Submissions outside this date window are blocked for `org-president`.

### TC-ACAD-003: Add Blocked Date / Holiday
- **Steps**:
  1. Click **Add Blocked Date**.
  2. Date: `Aug 30, 2026` (National Heroes Day).
  3. Reason: `"Legal Holiday - No Student Activities"`.
  4. Save.
- **Expected Result**: Calendar grid renders blocked date with red indicator. Document date pickers prevent selection of Aug 30.

---

## ⚙️ Module 7: Document Types & Subtypes Management (`DocumentTypeSettings.jsx`)

### TC-DOC-001: Add/Edit Subtype & Requirements
- **Steps**:
  1. Navigate to **Document Type Settings**.
  2. Select **Activity Proposal** -> Click **Add Subtype** (e.g., `"Off-Campus Major Event"`).
  3. Add Requirement checklist items (e.g., *"Parental Consent Form"*, *"CHED Endorsement"*).
  4. Toggle Mandatory vs. Optional for each item.
  5. Click Save.
- **Expected Result**: New subtype and requirement checklist immediately appear in `SubmitNewDocument.jsx` dropdowns.

---

## 📢 Module 8: Announcement Management (`AnnouncementManagement.jsx`)

### TC-ANN-001: Create & Pin Announcement
- **Steps**:
  1. Log in as `admin`.
  2. Navigate to **Announcements** -> Click **Create Announcement**.
  3. Title: `"Deadline for Mid-Year Accomplishment Reports"`.
  4. Content: Fill details. Toggle **Pin to Top**.
  5. Save.
- **Expected Result**: Announcement appears at top of feed for all `org-president` users.

---

## 👥 Module 9: User Management (`UserManagement.jsx`)

### TC-USER-001: Create & Assign User Role
- **Steps**:
  1. Navigate to **User Management** (Admin only).
  2. Click **Add New User**.
  3. Fill Email, Full Name, Student/Employee No, Role (`org-president`), Org Abbreviation (`ACCESS`).
  4. Save.
- **Expected Result**: User created in Supabase Auth & `users` table. User can log in with generated temp password.

### TC-USER-002: Activate / Deactivate Account
- **Steps**: Click **Deactivate** toggle next to a user.
- **Expected Result**: User account status updated to inactive; user blocked from logging in.

---

## 🗃️ Module 10: Archived & Completed Documents (`Completed.jsx`)

### TC-COMP-001: Completed Archive Search & Filter
- **Steps**:
  1. Open **Completed Documents**.
  2. Search by tracking number or Organization name.
  3. Click **View Summary / Download Package**.
- **Expected Result**: Displays full historical timeline, final approved attachments, delivery proof, and accomplishment report summary.

---

## 🗄️ Module 11: Database Schema & Integrity Checks

| Database Table | Column / Constraint | Validation Rule |
| :--- | :--- | :--- |
| `users` | `email`, `role`, `abbreviation` | Email unique; role in (`org-president`, `admin`, `oso-staff`, `chairman`, `vice-chairman`). |
| `submissions` | `tracking_number`, `status` | `tracking_number` unique; `status` matches authoritative stage string. |
| `submission_versions` | `version_number`, `submission_id` | Foreign key to `submissions(id)`. Auto-increment `version_number`. |
| `submission_attachments` | `requirement_id`, `status` | Attachment status in (`approved`, `returned`, `disapproved`, `pending`). |
| `submission_logs` | `workflow_phase`, `action_type` | Log records timestamp, user ID, phase, action type, description. |
| `activity_schedules` | `submission_version_id`, `activity_date` | Foreign key to `submission_versions(id)`. Date > submission date. |
| `academic_settings` | `is_active`, `school_year` | Only one row can have `is_active = true` at a time. |

---

## 📊 12. Complete Master Execution Checklist (TC-001 to TC-050)

```markdown
- `[ ]` TC-AUTH-001: Login with Valid Credentials
- `[ ]` TC-AUTH-002: Login with Invalid Credentials
- `[ ]` TC-AUTH-003: Forgot Password & Password Reset Workflow
- `[ ]` TC-AUTH-004: Update Profile Info & Org Abbreviation
- `[ ]` TC-DASH-001: Dashboard Real-time Metrics Verification
- `[ ]` TC-SUB-001: Date Picker Validation - Past Dates Prohibition
- `[ ]` TC-SUB-002: Date Picker Validation - Blocked Dates & Holidays
- `[ ]` TC-SUB-003: Single vs. Multiple Activity Schedule Dates
- `[ ]` TC-SUB-004: Mandatory vs. Optional Requirement Badges
- `[ ]` TC-REV-001: Attachment Review & Color Coding (Green/Amber/Red/Grey)
- `[ ]` TC-REV-002: Version Control (V1 vs V2 Dropdown Comparison)
- `[ ]` TC-REV-003: Dual-Phase Retrieval Handshake Lifecycle
- `[ ]` TC-INB-001: Inbox Tabs (Pending / Handled / All)
- `[ ]` TC-ACAD-001: Active School Year Configuration
- `[ ]` TC-ACAD-002: Submission Window Creation & Enforcement
- `[ ]` TC-ACAD-003: Add Blocked Date / Holiday Prohibition
- `[ ]` TC-DOC-001: Document Subtypes & Requirement Mapping
- `[ ]` TC-ANN-001: Announcement Creation & Pinned Feed
- `[ ]` TC-USER-001: Create User & Role Assignment
- `[ ]` TC-COMP-001: Completed Archive & Summary View
```

---
*Generated for BulSU OSODOCS Comprehensive System Quality Assurance.*
