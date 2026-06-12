const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { supabase } = require('./supabase');

const app = express();
const PORT = 5000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Create a direct admin client for the backend to ensure RLS is ALWAYS bypassed
const adminSupabase = supabase;

// --- ROUTES ---

// Login Route
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        return res.status(401).json({ error: error.message });
    }

    // Fetch profile/role
    const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single();

    if (profileError) {
        return res.status(500).json({ error: profileError.message });
    }

    res.json({
        success: true,
        user: { ...data.user, ...profile },
        session: data.session
    });
});

// Profile Route
app.get('/api/auth/profile', async (req, res) => {
    const { id } = req.query;

    if (!id) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .maybeSingle();

    if (error) {
        return res.status(500).json({ error: error.message });
    }

    res.json({ success: true, profile: data });
});

// Get Requirements
app.get('/api/requirements', async (req, res) => {
    const { typeId } = req.query;

    try {
        let result;

        if (typeId) {
            result = await supabase
                .from('requirements')
                .select('*')
                .eq('documentTypeID', typeId)
                .order('created_at', { ascending: true });
        } else {
            result = await supabase
                .from('requirements')
                .select('*')
                .order('created_at', { ascending: true });
        }

        if (result.error) {
            throw result.error;
        }

        res.json(result.data);
    } catch (err) {
        console.error('Error fetching requirements:', err);
        res.status(500).json({
            error: 'Failed to fetch requirements',
            details: err.message
        });
    }
});

// Get Document Types
app.get('/api/document-types', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('documentType')
            .select('*')
            .order('name', { ascending: true });

        if (error) throw error;

        res.json(data);
    } catch (err) {
        console.error('Error fetching document types:', err);
        res.status(500).json({
            error: 'Failed to fetch document types',
            details: err.message
        });
    }
});

// Get Users
app.get('/api/users', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*');

        if (error) throw error;

        console.log(`Found ${data?.length || 0} users.`);
        res.json(data);
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).json({
            error: 'Failed to fetch users',
            details: err.message
        });
    }
});

// Create User
app.post('/api/users', async (req, res) => {
    const {
        full_name,
        role,
        status,
        profile_image,
        email,
        password,
        org_name,
        no_member,
        adviser_name,
        joined_date,
        contact_no,
        student_no
    } = req.body;

    if (!full_name || !role || !email || !password) {
        return res.status(400).json({
            error: 'Full name, role, email, and password are required'
        });
    }

    try {
        // Create auth account
        const { data: authData, error: authError } =
            await supabase.auth.admin.createUser({
                email,
                password,
                email_confirm: true
            });

        if (authError) {
            return res.status(500).json({
                error: authError.message
            });
        }

        // Create user profile
        const { data: profileData, error: profileError } =
            await supabase
                .from('users')
                .insert([
                    {
                        id: authData.user.id,
                        full_name,
                        role,
                        status: status || 'Active',
                        profile_image: profile_image || null,
                        org_name: org_name || null,
                        no_member: no_member || null,
                        adviser_name: adviser_name || null,
                        joined_date: joined_date || null,
                        contact_no: contact_no || null,
                        student_no: student_no || null
                    }
                ])
                .select();

        if (profileError) throw profileError;

        res.json({
            success: true,
            user: profileData[0]
        });
    } catch (err) {
        console.error('Error creating user:', err);
        res.status(500).json({
            error: 'Failed to create user',
            details: err.message
        });
    }
});

// Update User
app.put('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const {
        full_name,
        role,
        status,
        profile_image,
        org_name,
        no_member,
        adviser_name,
        joined_date,
        contact_no,
        student_no
    } = req.body;

    try {
        const { data, error } = await supabase
            .from('users')
            .update({
                full_name,
                role,
                status: status || 'Active',
                profile_image: profile_image || null,
                org_name: org_name || null,
                no_member: no_member || null,
                adviser_name: adviser_name || null,
                joined_date: joined_date || null,
                contact_no: contact_no || null,
                student_no: student_no || null
            })
            .eq('id', id)
            .select();

        if (error) throw error;

        res.json({
            success: true,
            user: data[0]
        });
    } catch (err) {
        console.error('Error updating user:', err);
        res.status(500).json({
            error: 'Failed to update user',
            details: err.message
        });
    }
});

// Delete User
app.delete('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { adminEmail, adminPassword } = req.body;

    try {
        if (adminEmail && adminPassword) {
            const { error: authError } = await supabase.auth.signInWithPassword({
                email: adminEmail,
                password: adminPassword
            });

            if (authError) {
                return res.status(401).json({ error: 'Invalid admin credentials' });
            }
        }

        // Delete from auth.users (this deletes the auth user)
        const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(id);
        if (deleteAuthError) throw deleteAuthError;

        // Delete from users profile table
        const { error: deleteProfileError } = await supabase
            .from('users')
            .delete()
            .eq('id', id);

        if (deleteProfileError) throw deleteProfileError;

        res.json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (err) {
        console.error('Error deleting user:', err);
        res.status(500).json({
            error: 'Failed to delete user',
            details: err.message
        });
    }
});


// --- REQUIREMENTS CRUD ---

// Create Requirement
app.post('/api/requirements', async (req, res) => {
    const {
        title,
        referenceCode,
        description,
        file_url,
        documentTypeID
    } = req.body;

    if (!title || !documentTypeID) {
        return res.status(400).json({
            error: 'Title and Document Type ID are required'
        });
    }

    try {
        const { data, error } = await supabase
            .from('requirements')
            .insert([
                {
                    title,
                    referenceCode,
                    description,
                    file_url,
                    documentTypeID,
                    updatedAt: new Date().toISOString()
                }
            ])
            .select();

        if (error) throw error;

        res.json({
            success: true,
            data: data[0]
        });
    } catch (err) {
        console.error('Error creating requirement:', err);
        res.status(500).json({
            error: 'Failed to create requirement',
            details: err.message
        });
    }
});

// Update Requirement
app.put('/api/requirements/:id', async (req, res) => {
    const { id } = req.params;

    const {
        title,
        referenceCode,
        description,
        file_url
    } = req.body;

    try {
        const { data, error } = await supabase
            .from('requirements')
            .update({
                title,
                referenceCode,
                description,
                file_url,
                updatedAt: new Date().toISOString()
            })
            .eq('id', id)
            .select();

        if (error) throw error;

        res.json({
            success: true,
            data: data[0]
        });
    } catch (err) {
        console.error('Error updating requirement:', err);
        res.status(500).json({
            error: 'Failed to update requirement',
            details: err.message
        });
    }
});

// Delete Requirement
app.delete('/api/requirements/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const { error } = await supabase
            .from('requirements')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({
            success: true,
            message: 'Requirement deleted successfully'
        });
    } catch (err) {
        console.error('Error deleting requirement:', err);
        res.status(500).json({
            error: 'Failed to delete requirement',
            details: err.message
        });
    }
});

// Audit Logging Route
app.post('/api/logs', async (req, res) => {
    const {
        submission_id,
        user_id,
        action_type,
        description,
        workflow_phase,
        submission_version_id
    } = req.body;

    try {
        const { data, error } = await supabase
            .from('submission_logs')
            .insert([
                {
                    submission_id,
                    user_id,
                    action_type: action_type || null,
                    description,
                    workflow_phase: workflow_phase || null,
                    submission_version_id: submission_version_id || null,
                    created_at: new Date().toISOString()
                }
            ])
            .select();

        if (error) throw error;

        res.json({
            success: true,
            data: data[0]
        });
    } catch (err) {
        console.error('Error creating audit log:', err);
        res.status(500).json({
            error: 'Failed to create audit log',
            details: err.message
        });
    }
});

// Start New Submission Route
app.post('/api/submissions/start', async (req, res) => {
    const { user_id, type_id } = req.body;

    try {
        // Find active school year
        const { data: activeSy, error: syErr } = await supabase
            .from('school_years')
            .select('*')
            .eq('is_active', true)
            .maybeSingle();

        if (syErr) throw syErr;
        
        // If no active school year, throw error
        if (!activeSy) {
            return res.status(400).json({ error: 'No active School Year is configured. Please contact an administrator.' });
        }

        const currentDate = new Date();
        
        // Check if current date is within school year bounds
        const syStart = activeSy.start_date ? new Date(activeSy.start_date) : null;
        const syEnd = activeSy.end_date ? new Date(activeSy.end_date) : null;
        
        let isWithinSy = true;
        if (syStart && syEnd) isWithinSy = currentDate >= syStart && currentDate <= syEnd;
        else if (syStart) isWithinSy = currentDate >= syStart;
        else if (syEnd) isWithinSy = currentDate <= syEnd;
        
        if (!isWithinSy) {
            return res.status(400).json({ error: 'The current date is outside the active School Year.' });
        }

        // Check document type submission mode and submission window
        const { data: docType } = await supabase
            .from('documentType')
            .select('availability_type, name')
            .eq('id', type_id)
            .single();
            
        if (!docType) {
            return res.status(404).json({ error: 'Document type not found.' });
        }

        if (docType.availability_type === 'scheduled') {
            const start = docType.active_from ? new Date(docType.active_from) : null;
            const end = docType.active_until ? new Date(docType.active_until) : null;
            
            let isWithin = true;
            if (start && end) isWithin = currentDate >= start && currentDate <= end;
            else if (start) isWithin = currentDate >= start;
            else if (end) isWithin = currentDate <= end;

            if (!isWithin) {
                return res.status(400).json({ error: 'Submissions are currently closed for this document type.' });
            }
        }

        const { data: sub, error: subErr } = await supabase
            .from('submissions')
            .insert([
                {
                    user_id,
                    document_type_id: type_id,
                    school_year_id: activeSy.id,
                    status: 'draft',
                    remarks: 'Initial draft created'
                }
            ])
            .select()
            .single();

        if (subErr) throw subErr;

        const { data: version, error: verErr } = await supabase
            .from('submission_versions')
            .insert([
                {
                    submission_id: sub.id,
                    version_number: 1,
                    status: 'draft',
                    submitted_by: user_id
                }
            ])
            .select()
            .single();

        if (verErr) throw verErr;

        // Update submission with current version ID
        const { error: updateErr } = await supabase
            .from('submissions')
            .update({ current_version_id: version.id })
            .eq('id', sub.id);

        if (updateErr) throw updateErr;

        res.json({
            success: true,
            submission: sub,
            version
        });
    } catch (err) {
        console.error('Error starting submission:', err);
        res.status(500).json({
            error: 'Failed to start submission',
            details: err.message
        });
    }
});

// Document Registration Route
app.post('/api/submissions/register', async (req, res) => {
    const {
        submission_id,
        version_id,
        user_id,
        proposal_details,
        is_proposal
    } = req.body;

    try {
        console.log(
            `[Backend] START Registration: SubID=${submission_id}, UserID=${user_id}`
        );

        // Fetch submission to get document_type_id and school_year_id
        const { data: submission } = await supabase
            .from('submissions')
            .select('document_type_id, school_year_id')
            .eq('id', submission_id)
            .single();

        if (!submission) {
            return res.status(404).json({ error: 'Submission not found' });
        }

        // Save proposal details
        if (is_proposal && proposal_details) {
            // Validate against ACTIVITY_BLOCK
            const targetDateStr = proposal_details.target_date || proposal_details.activity_dates;
            if (targetDateStr) {
                // Split multiple dates if comma separated (e.g., from activity_dates)
                const targetDates = targetDateStr.split(',').map(d => new Date(d.trim()));
                
                const { data: blocks } = await supabase
                    .from('academic_calendar_events')
                    .select('start_date, end_date')
                    .eq('document_type_id', submission.document_type_id)
                    .eq('school_year_id', submission.school_year_id)
                    .eq('event_type', 'ACTIVITY_BLOCK');

                if (blocks && blocks.length > 0) {
                    let hasOverlap = false;
                    for (const targetDate of targetDates) {
                        for (const block of blocks) {
                            const bStart = block.start_date ? new Date(block.start_date) : null;
                            const bEnd = block.end_date ? new Date(block.end_date) : null;
                            
                            // To compare properly, set time to midnight
                            targetDate.setHours(0,0,0,0);
                            if (bStart) bStart.setHours(0,0,0,0);
                            if (bEnd) bEnd.setHours(0,0,0,0);

                            if (bStart && bEnd && targetDate >= bStart && targetDate <= bEnd) hasOverlap = true;
                            else if (bStart && !bEnd && targetDate >= bStart) hasOverlap = true;
                            else if (!bStart && bEnd && targetDate <= bEnd) hasOverlap = true;
                            
                            if (hasOverlap) break;
                        }
                        if (hasOverlap) break;
                    }
                    if (hasOverlap) {
                        return res.status(400).json({ error: 'The selected activity date falls within a blocked period. Please choose another date.' });
                    }
                }
            }

            const safeProposalData = {
                submission_version_id: version_id,
                activity_number: proposal_details.activity_number || null,
                organization_name: proposal_details.organization_name || null,
                adviser_name: proposal_details.adviser_name || null,
                activity_title: proposal_details.activity_title || null,
                person_in_charge: proposal_details.person_in_charge || null,
                student_id_no: proposal_details.student_id_no || null,
                contact_number: proposal_details.contact_number || null,
                target_venue: proposal_details.target_venue || null,
                target_date: proposal_details.target_date || null,
                target_time: proposal_details.target_time || null,
                target_end_time: proposal_details.target_end_time || null,
                activity_dates: proposal_details.activity_dates || null,
                duration: proposal_details.duration || null,
                number_of_students:
                    parseInt(proposal_details.number_of_students) || 0,
                created_at: new Date().toISOString()
            };

            if (proposal_details.others_objective) {
                safeProposalData.others_objective =
                    proposal_details.others_objective;
            }

            const { error: propErr } = await supabase
                .from('activity_proposal_details')
                .upsert([safeProposalData]);

            if (propErr) {
                console.warn(
                    '[Backend] Warning saving proposal:',
                    propErr.message
                );
            }
        }

        // Update version
        const { error: verErr } = await supabase
            .from('submission_versions')
            .update({ status: 'submitted' })
            .eq('id', version_id);

        if (verErr) throw verErr;

        // Update submission
        const { error: subErr } = await supabase
            .from('submissions')
            .update({
                status: 'submitted',
                submitted_at: new Date().toISOString(),
                current_version_id: version_id
            })
            .eq('id', submission_id);

        if (subErr) throw subErr;

        // Create audit log
        await supabase
            .from('submission_logs')
            .insert([
                {
                    submission_id,
                    user_id,
                    action_type: 'submitted',
                    description: 'Document submitted for review.',
                    workflow_phase: 'submission',
                    created_at: new Date().toISOString()
                }
            ]);

        console.log('[Backend] SUCCESS: Registration complete.');

        res.json({
            success: true,
            message: 'Document registered successfully'
        });
    } catch (err) {
        console.error('Error registering document:', err);
        res.status(500).json({
            error: 'Failed to register document',
            details: err.message
        });
    }
});

// Approve Dean Route (creates explicit Dean approval log entry)
app.post('/api/submissions/approve-dean', async (req, res) => {
    const { submissionId, userId, comments, activeVersionId } = req.body;

    if (!submissionId || !userId) {
        return res.status(400).json({ error: 'Submission ID and User ID are required' });
    }

    try {
        // 1. Update submissions table status to 'dean approved'
        const { error: subErr } = await supabase
            .from('submissions')
            .update({
                status: 'dean approved',
                remarks: comments || 'Approved by the Dean'
            })
            .eq('id', submissionId);

        if (subErr) throw subErr;

        // 2. Insert a new Dean approval log entry for the lifecycle timeline
        const { error: deanLogErr } = await supabase
            .from('submission_logs')
            .insert([{
                submission_id: submissionId,
                submission_version_id: activeVersionId || null,
                user_id: userId,
                workflow_phase: 'dean-review',
                action_type: 'approved',
                review_action: null,
                description: comments || 'Approved by the Dean',
                comment: comments || null,
                created_at: new Date().toISOString()
            }]);

        if (deanLogErr) throw deanLogErr;

        res.json({ success: true });
    } catch (err) {
        console.error('[Backend] Error in approve-dean:', err);
        res.status(500).json({ error: 'Failed to approve via backend', details: err.message });
    }
});

// --- ANNOUNCEMENTS CRUD ---

// Get Announcements
app.get('/api/announcements', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('announcements')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        console.error('Error fetching announcements:', err);
        res.status(500).json({ error: 'Failed to fetch announcements', details: err.message });
    }
});

// Create Announcement
app.post('/api/announcements', async (req, res) => {
    const { title, content, target_audience, is_active, created_by } = req.body;
    
    if (!title || !content || !target_audience) {
        return res.status(400).json({ error: 'Title, content, and target_audience are required' });
    }

    try {
        const { data, error } = await supabase
            .from('announcements')
            .insert([{ title, content, target_audience, is_active: is_active ?? true, created_by, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }])
            .select();

        if (error) throw error;
        res.json({ success: true, data: data[0] });
    } catch (err) {
        console.error('Error creating announcement:', err);
        res.status(500).json({ error: 'Failed to create announcement', details: err.message });
    }
});

// Update Announcement
app.put('/api/announcements/:id', async (req, res) => {
    const { id } = req.params;
    const { title, content, target_audience, is_active } = req.body;

    try {
        const { data, error } = await supabase
            .from('announcements')
            .update({ title, content, target_audience, is_active, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select();

        if (error) throw error;
        res.json({ success: true, data: data[0] });
    } catch (err) {
        console.error('Error updating announcement:', err);
        res.status(500).json({ error: 'Failed to update announcement', details: err.message });
    }
});

// Delete Announcement
app.delete('/api/announcements/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Delete all files in the announcement's storage folder
        const folderPath = `announcements/${id}`;
        const { data: existingFiles } = await supabase.storage.from('documents').list(folderPath);
        if (existingFiles && existingFiles.length > 0) {
            const filesToRemove = existingFiles.map(x => `${folderPath}/${x.name}`);
            await supabase.storage.from('documents').remove(filesToRemove);
        }

        const { error } = await supabase.from('announcements').delete().eq('id', id);
        if (error) throw error;
        res.json({ success: true, message: 'Announcement deleted successfully' });
    } catch (err) {
        console.error('Error deleting announcement:', err);
        res.status(500).json({ error: 'Failed to delete announcement', details: err.message });
    }
});


// --- NOTIFICATIONS ---
app.get('/api/notifications', async (req, res) => {
    const { userId, role, orgName } = req.query;

    if (!userId || !role) {
        return res.status(400).json({ error: 'UserId and role are required' });
    }

    try {
        let notifications = [];

        // 1. Fetch Announcements
        let annQuery = supabase.from('announcements').select('*').eq('is_active', true);
        
        if (role !== 'admin') {
            const audiences = [];
            if (role === 'org-president') {
                audiences.push('all-orgs');
                if (orgName) audiences.push(`org:${orgName}`);
            } else if (role === 'chairman') {
                audiences.push('oso-staff', 'chairman');
            } else if (role === 'vice-chairman') {
                audiences.push('oso-staff', 'vice-chairman');
            } else if (role === 'oso-staff') {
                audiences.push('oso-staff');
            }
            annQuery = annQuery.in('target_audience', audiences);
        }

        const { data: announcementsData, error: annError } = await annQuery;
        if (!annError && announcementsData) {
            const mappedAnns = announcementsData.map(a => ({
                id: `ann_${a.id}`,
                type: 'announcement',
                title: a.title,
                message: a.content,
                timestamp: a.created_at,
                source: a
            }));
            notifications = [...notifications, ...mappedAnns];
        }

        // 2. Fetch Workflow Updates
        // Supabase inner join to filter by submission user_id
        // We will fetch necessary logs and map them.
        
        let logsData = [];
        if (role === 'admin') {
            const adminActions = ['oso approved', 'document_retrieved', 'accomplishment_report_submitted'];
            const { data } = await supabase.from('submission_logs')
                .select('*, submissions(document_type_id, user_id, id)')
                .in('action_type', adminActions)
                .order('created_at', { ascending: false })
                .limit(50);
            logsData = data || [];
        } else if (role === 'org-president') {
            const { data } = await supabase.from('submission_logs')
                .select('*, submissions!inner(id, user_id)')
                .eq('submissions.user_id', userId)
                .neq('action_type', 'created')
                .neq('action_type', 'submitted')
                .neq('action_type', 'attachment_review')
                .neq('action_type', 'viewed')
                .order('created_at', { ascending: false })
                .limit(50);
            logsData = data || [];
        } else {
            // Staff roles: map role to action types that trigger their review
            let triggerActions = [];
            if (role === 'oso-staff') triggerActions = ['submitted'];
            else if (role === 'sds-coordinator') triggerActions = ['oso approved'];
            else if (role === 'chairman') triggerActions = ['sds approved'];
            else if (role === 'vice-chairman') triggerActions = ['chairman approved'];
            else if (role === 'external') triggerActions = ['vice chairman approved'];
            else if (role === 'dean') triggerActions = ['external approved'];

            if (triggerActions.length > 0) {
                const { data } = await supabase.from('submission_logs')
                    .select('*, submissions(id)')
                    .in('action_type', triggerActions)
                    .order('created_at', { ascending: false })
                    .limit(50);
                logsData = data || [];
            }
        }

        if (logsData.length > 0) {
            const mappedLogs = logsData.map(l => ({
                id: `log_${l.id}`,
                type: 'workflow',
                title: l.action_type ? l.action_type.replace(/_/g, ' ').toUpperCase() : 'Workflow Update',
                message: l.description || 'Status changed',
                timestamp: l.created_at,
                source: l
            }));
            notifications = [...notifications, ...mappedLogs];
        }

        // Sort descending by timestamp
        notifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        res.json({ success: true, data: notifications });
    } catch (err) {
        console.error('Error fetching notifications:', err);
        res.status(500).json({ error: 'Failed to fetch notifications', details: err.message });
    }
});

// --- ACADEMIC SETTINGS: SCHOOL YEARS ---

// Get all School Years
app.get('/api/school-years', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('school_years')
            .select('*')
            .order('start_date', { ascending: false });

        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        console.error('Error fetching school years:', err);
        res.status(500).json({ error: 'Failed to fetch school years', details: err.message });
    }
});

// Create School Year
app.post('/api/school-years', async (req, res) => {
    const { name, start_date, end_date, is_active } = req.body;
    
    if (!name || !start_date || !end_date) {
        return res.status(400).json({ error: 'Name, start_date, and end_date are required' });
    }

    try {
        // If this one is being set as active, we must deactivate others first
        if (is_active) {
            await supabase.from('school_years').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000'); // dummy condition to update all
        }

        const { data, error } = await supabase
            .from('school_years')
            .insert([{ name, start_date, end_date, is_active: is_active || false }])
            .select();

        if (error) throw error;
        res.json({ success: true, data: data[0] });
    } catch (err) {
        console.error('Error creating school year:', err);
        res.status(500).json({ error: 'Failed to create school year', details: err.message });
    }
});

// Update School Year
app.put('/api/school-years/:id', async (req, res) => {
    const { id } = req.params;
    const { name, start_date, end_date } = req.body;
    
    try {
        const { data, error } = await supabase
            .from('school_years')
            .update({ name, start_date, end_date })
            .eq('id', id)
            .select();

        if (error) throw error;
        res.json({ success: true, data: data[0] });
    } catch (err) {
        console.error('Error updating school year:', err);
        res.status(500).json({ error: 'Failed to update school year', details: err.message });
    }
});

// Activate School Year
app.put('/api/school-years/:id/activate', async (req, res) => {
    const { id } = req.params;
    
    try {
        // Deactivate all
        await supabase.from('school_years').update({ is_active: false }).neq('id', '00000000-0000-0000-0000-000000000000');
        
        // Activate the target
        const { data, error } = await supabase
            .from('school_years')
            .update({ is_active: true })
            .eq('id', id)
            .select();

        if (error) throw error;
        res.json({ success: true, data: data[0] });
    } catch (err) {
        console.error('Error activating school year:', err);
        res.status(500).json({ error: 'Failed to activate school year', details: err.message });
    }
});

// Delete School Year
app.delete('/api/school-years/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        // Check if there are any submissions for this school year
        const { data: submissions, error: subErr } = await supabase
            .from('submissions')
            .select('id')
            .eq('school_year_id', id)
            .limit(1);

        if (subErr) throw subErr;

        if (submissions && submissions.length > 0) {
            return res.status(400).json({ error: 'Cannot delete School Year because there are submissions tied to it.' });
        }

        // Also delete associated academic calendar events, or let cascade handle it?
        // Cascade usually handles it if configured, otherwise we delete them manually.
        await supabase.from('academic_calendar_events').delete().eq('school_year_id', id);

        const { error } = await supabase
            .from('school_years')
            .delete()
            .eq('id', id);

        if (error) throw error;
        
        res.json({ success: true, message: 'School Year deleted successfully.' });
    } catch (err) {
        console.error('Error deleting school year:', err);
        res.status(500).json({ error: 'Failed to delete school year', details: err.message });
    }
});

// --- ACADEMIC SETTINGS: ACADEMIC CALENDAR EVENTS ---

app.get('/api/academic-events', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('academic_calendar_events')
            .select('*')
            .order('start_date', { ascending: true });

        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        console.error('Error fetching academic events:', err);
        res.status(500).json({ error: 'Failed to fetch academic events', details: err.message });
    }
});

app.post('/api/academic-events', async (req, res) => {
    const { school_year_id, title, description, event_type, document_type_id, start_date, end_date, created_by } = req.body;
    
    if (!school_year_id || !title || !event_type) {
        return res.status(400).json({ error: 'school_year_id, title, and event_type are required' });
    }

    try {
        const { data, error } = await supabase
            .from('academic_calendar_events')
            .insert([{ school_year_id, title, description, event_type, document_type_id, start_date, end_date, created_by }])
            .select();

        if (error) throw error;
        res.json({ success: true, data: data[0] });
    } catch (err) {
        console.error('Error creating academic event:', err);
        res.status(500).json({ error: 'Failed to create academic event', details: err.message });
    }
});

app.put('/api/academic-events/:id', async (req, res) => {
    const { id } = req.params;
    const { title, description, event_type, document_type_id, start_date, end_date } = req.body;
    
    try {
        const { data, error } = await supabase
            .from('academic_calendar_events')
            .update({ title, description, event_type, document_type_id, start_date, end_date })
            .eq('id', id)
            .select();

        if (error) throw error;
        res.json({ success: true, data: data[0] });
    } catch (err) {
        console.error('Error updating academic event:', err);
        res.status(500).json({ error: 'Failed to update academic event', details: err.message });
    }
});

app.delete('/api/academic-events/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { error } = await supabase.from('academic_calendar_events').delete().eq('id', id);
        if (error) throw error;
        res.json({ success: true, message: 'Event deleted successfully' });
    } catch (err) {
        console.error('Error deleting academic event:', err);
        res.status(500).json({ error: 'Failed to delete academic event', details: err.message });
    }
});

// --- SYSTEM: DOCUMENT AVAILABILITY & ELIGIBILITY ---

app.get('/api/system/document-availability', async (req, res) => {
    const { userId } = req.query;

    try {
        // 1. Get active school year
        const { data: activeSy } = await supabase
            .from('school_years')
            .select('*')
            .eq('is_active', true)
            .single();

        if (!activeSy) {
            return res.json({
                success: true,
                activeSchoolYear: null,
                availability: {},
                message: 'No active school year.'
            });
        }

        const currentDate = new Date();
        
        // 1.5 Check if current date falls within active school year
        const syStart = activeSy.start_date ? new Date(activeSy.start_date) : null;
        const syEnd = activeSy.end_date ? new Date(activeSy.end_date) : null;
        
        let isWithinSy = true;
        if (syStart && syEnd) isWithinSy = currentDate >= syStart && currentDate <= syEnd;
        else if (syStart) isWithinSy = currentDate >= syStart;
        else if (syEnd) isWithinSy = currentDate <= syEnd;
        
        if (!isWithinSy) {
            return res.json({
                success: true,
                activeSchoolYear: activeSy,
                availability: {},
                message: 'The current date is outside the active School Year.'
            });
        }

        // 2. Get all document types
        const { data: docTypes } = await supabase.from('documentType').select('*');
        
        // 3. Get all events for the current school year
        const { data: events } = await supabase
            .from('academic_calendar_events')
            .select('*')
            .eq('school_year_id', activeSy.id);

        const blockedEvents = events?.filter(e => e.event_type === 'ACTIVITY_BLOCK') || [];

        const availability = {};

        // Helper to check if current date is within bounds
        const isWithinBounds = (start_date, end_date) => {
            if (!start_date && !end_date) return true; // Always Available
            
            const start = start_date ? new Date(start_date) : null;
            const end = end_date ? new Date(end_date) : null;
            
            if (start && end) return currentDate >= start && currentDate <= end;
            if (start) return currentDate >= start;
            if (end) return currentDate <= end;
            return false;
        };

        // 4. Renewal Eligibility Check (if userId provided)
        let isRenewalEligible = false;
        let missingRenewalRequirements = [];
        if (userId) {
            // Find approved mid-year and year-end for this user & active school year
            const { data: userSubs } = await supabase
                .from('submissions')
                .select('status, documentType:document_type_id(name)')
                .eq('user_id', userId)
                .eq('school_year_id', activeSy.id)
                .eq('status', 'completed'); // Assuming 'completed' means approved in final stage

            const hasApprovedMidYear = userSubs?.some(s => s.documentType?.name?.toLowerCase().includes('mid-year'));
            const hasApprovedYearEnd = userSubs?.some(s => s.documentType?.name?.toLowerCase().includes('year-end'));
            
            if (!hasApprovedMidYear) missingRenewalRequirements.push('Approved Mid-Year Report');
            if (!hasApprovedYearEnd) missingRenewalRequirements.push('Approved Year-End Report');
            
            isRenewalEligible = hasApprovedMidYear && hasApprovedYearEnd;
        }

        // 5. Evaluate each document type
        for (const dt of docTypes || []) {
            let isAvailable = false;
            let lockedReason = null;

            if (dt.status !== 'active') {
                lockedReason = 'Document type is inactive';
            } else if (dt.availability_type === 'scheduled') {
                if (!dt.active_from && !dt.active_until) {
                    lockedReason = 'No active submission period configured';
                } else if (!isWithinBounds(dt.active_from, dt.active_until)) {
                    lockedReason = 'Submission Period Closed';
                } else {
                    isAvailable = true;
                }
            } else {
                // indefinite mode
                isAvailable = true;
            }

            // Additional check for Requires Eligibility
            if (isAvailable && dt.requires_eligibility && dt.name.toLowerCase().includes('renewal')) {
                if (!isRenewalEligible) {
                    isAvailable = false;
                    lockedReason = 'Missing Requirements: ' + missingRenewalRequirements.join(', ');
                }
            }

            availability[dt.id] = {
                isAvailable,
                lockedReason,
                requiresEligibility: dt.requires_eligibility
            };
        }

        res.json({
            success: true,
            activeSchoolYear: activeSy,
            availability,
            blockedEvents
        });

    } catch (err) {
        console.error('Error checking availability:', err);
        res.status(500).json({ error: 'Failed to check document availability', details: err.message });
    }
});
// --- ADMIN DASHBOARD ---
app.get('/api/admin/dashboard', async (req, res) => {
    try {
        const currentDate = new Date();
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString();
        
        // Active School Year
        const { data: activeSy } = await supabase
            .from('school_years')
            .select('*')
            .eq('is_active', true)
            .single();

        const activeSyId = activeSy ? activeSy.id : null;

        // Section 1: Statistics
        let eligibleForRenewalCount = 0;
        if (activeSyId) {
            const { data: orgPresidents } = await supabase
                .from('users')
                .select('id, role')
                .eq('role', 'org-president');

            const { data: approvedReports } = await supabase
                .from('submissions')
                .select('user_id, documentType:document_type_id(name)')
                .eq('school_year_id', activeSyId)
                .eq('status', 'completed');
            
            if (orgPresidents && approvedReports) {
                let eligibleCount = 0;
                for (const user of orgPresidents) {
                    const userReports = approvedReports.filter(r => r.user_id === user.id);
                    const hasMid = userReports.some(r => r.documentType?.name?.toLowerCase().includes('mid-year'));
                    const hasEnd = userReports.some(r => r.documentType?.name?.toLowerCase().includes('year-end'));
                    if (hasMid && hasEnd) {
                        eligibleCount++;
                    }
                }
                eligibleForRenewalCount = eligibleCount;
            }
        }

        const { data: allSubmissions } = await supabase
            .from('submissions')
            .select('id, status, school_year_id, user_id, current_version_id, documentType:document_type_id(name, id), users:user_id(org_name, full_name), submission_versions!submission_versions_submission_id_fkey(version_number, activity_proposal_details(activity_title))')
            .order('created_at', { ascending: false });
            
        let allTimeCount = allSubmissions ? allSubmissions.filter(s => s.status !== 'draft').length : 0;
        let currentSyCount = activeSyId && allSubmissions ? allSubmissions.filter(s => s.school_year_id === activeSyId && s.status !== 'draft').length : 0;
        
        const normalizeStatus = (value) => String(value || '').toLowerCase().trim();
        const activeReviewStatuses = new Set([
            'oso approved',
            'sds approved',
            'chairman approved',
            'vice chairman approved',
            'external approved',
            'dean approved',
            'approved'
        ]);
        const actualActiveReviewCount = allSubmissions
            ? allSubmissions.filter((s) => activeReviewStatuses.has(normalizeStatus(s.status))).length
            : 0;

        // Section 2: Active Documents Overview
        let activeDocumentsOverview = allSubmissions ? allSubmissions.filter(s => 
            !['draft', 'completed', 'disapproved'].includes(s.status)
        ) : [];

        // Section 3: Status Breakdown
        const statusBreakdown = {
            'to forward and hardcopy submission for org president': 0,
            'chairman and vice chairman review': 0,
            'sds coordinator review': 0,
            'dean review': 0,
            'external review': 0,
            'approved': 0,
            'disapproved': 0,
            'returned': 0,
            'completed': 0
        };

        if (allSubmissions) {
            allSubmissions.forEach(s => {
                if (s.status === 'draft') return; // Skip drafts

                let displayStatus = s.status;
                if (s.status === 'submitted') displayStatus = 'to forward and hardcopy submission for org president';
                else if (s.status === 'oso approved') displayStatus = 'sds coordinator review';
                else if (s.status === 'sds approved' || s.status === 'chairman approved') displayStatus = 'chairman and vice chairman review';
                else if (s.status === 'vice chairman approved') displayStatus = 'external review';
                else if (s.status === 'external approved') displayStatus = 'dean review';
                else if (s.status === 'dean approved') displayStatus = 'approved';
                else if (s.status === 'returned') displayStatus = 'returned';
                else if (s.status === 'completed') displayStatus = 'completed';
                else if (s.status === 'disapproved') displayStatus = 'disapproved';
                
                const key = displayStatus ? displayStatus.toLowerCase() : 'unknown';
                if (statusBreakdown[key] !== undefined) {
                    statusBreakdown[key]++;
                } else {
                    statusBreakdown[key] = (statusBreakdown[key] || 0) + 1;
                }
            });
        }

        // Section 4: Common Submission Errors
        const { data: returnLogs } = await supabase
            .from('submission_logs')
            .select('review_action')
            .eq('action_type', 'attachment_review')
            .neq('review_action', 'approved');
            
        const errorCounts = {};
        if (returnLogs) {
            returnLogs.forEach(log => {
                if (log.review_action && log.review_action.trim() !== '') {
                    const reason = log.review_action.trim().replace(/-/g, ' ');
                    const displayReason = reason.charAt(0).toUpperCase() + reason.slice(1);
                    errorCounts[displayReason] = (errorCounts[displayReason] || 0) + 1;
                }
            });
        }
        
        const commonErrors = Object.entries(errorCounts)
            .map(([reason, count]) => ({ reason, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        // Section 5: Revision Analysis
        const { data: recentVersions } = await supabase
            .from('submission_versions')
            .select('submission_id, version_number')
            .gte('created_at', startOfMonth);
            
        let revisionsThisMonth = 0;
        if (recentVersions) {
            revisionsThisMonth = recentVersions.filter(v => v.version_number > 1).length;
        }

        const { data: allVersions } = await supabase
            .from('submission_versions')
            .select('submission_id, version_number');
            
        let avgRevisionsPerType = {};
        if (allVersions && allSubmissions) {
            const docTypeStats = {};
            allSubmissions.forEach(sub => {
                if (sub.documentType && sub.documentType.name) {
                    if (!docTypeStats[sub.documentType.name]) {
                        docTypeStats[sub.documentType.name] = { totalRevisions: 0, docCount: 0 };
                    }
                    docTypeStats[sub.documentType.name].docCount++;
                }
            });
            
            allVersions.forEach(v => {
                if (v.version_number > 1) {
                    const sub = allSubmissions.find(s => s.id === v.submission_id);
                    if (sub && sub.documentType && sub.documentType.name) {
                        docTypeStats[sub.documentType.name].totalRevisions++;
                    }
                }
            });
            
            for (const [type, stats] of Object.entries(docTypeStats)) {
                avgRevisionsPerType[type] = stats.docCount > 0 ? (stats.totalRevisions / stats.docCount).toFixed(2) : 0;
            }
        }

        res.json({
            success: true,
            data: {
                statistics: {
                    eligibleForRenewalCount,
                    activeReviewCount: actualActiveReviewCount,
                    currentSyCount,
                    allTimeCount
                },
                activeDocuments: activeDocumentsOverview,
                statusBreakdown,
                commonErrors,
                revisionAnalysis: {
                    revisionsThisMonth,
                    avgRevisionsPerType
                }
            }
        });

    } catch (err) {
        console.error('Error fetching admin dashboard stats:', err);
        res.status(500).json({ error: 'Failed to fetch dashboard stats', details: err.message });
    }
});

// --- ORG DASHBOARD ---
app.get('/api/org/dashboard', async (req, res) => {
    try {
        const userId = req.user ? req.user.id : req.query.userId;
        if (!userId) return res.status(400).json({ error: 'User ID is required' });

        const { data: user } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        const { data: activeSy } = await supabase
            .from('school_years')
            .select('*')
            .eq('is_active', true)
            .single();

        const { data: announcements } = await supabase
            .from('announcements')
            .select('*')
            .in('target_audience', ['all', 'org-president'])
            .order('created_at', { ascending: false })
            .limit(3);

        const { data: userSubmissions } = await supabase
            .from('submissions')
            .select('id, status, school_year_id, created_at, documentType:document_type_id(name, id), submission_versions!submission_versions_submission_id_fkey(version_number, activity_proposal_details(activity_title))')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        let underReviewDocs = [];
        let completedCount = 0;
        let disapprovedCount = 0;
        let pendingCount = 0;
        let approvedCount = 0;
        let returnedCount = 0;

        let isRenewalEligible = false;
        let hasMidYear = false;
        let hasYearEnd = false;

        if (userSubmissions) {
            userSubmissions.forEach(sub => {
                const s = sub.status ? sub.status.toLowerCase() : '';
                
                if (s === 'completed') {
                    completedCount++;
                    if (activeSy && sub.school_year_id === activeSy.id) {
                        const docName = sub.documentType?.name?.toLowerCase() || '';
                        if (docName.includes('mid-year') || docName.includes('mid year')) hasMidYear = true;
                        if (docName.includes('year-end') || docName.includes('year end')) hasYearEnd = true;
                    }
                } else if (s === 'disapproved') {
                    disapprovedCount++;
                } else if (s === 'returned') {
                    returnedCount++;
                } else if (s === 'dean approved') {
                    approvedCount++;
                    underReviewDocs.push(sub);
                } else if (s !== 'draft') {
                    pendingCount++;
                    underReviewDocs.push(sub);
                }
            });
            isRenewalEligible = hasMidYear && hasYearEnd;
        }

        const activeSubIds = underReviewDocs.map(d => d.id);
        let logsBySubId = {};
        if (activeSubIds.length > 0) {
            const { data: logs } = await supabase
                .from('submission_logs')
                .select('*')
                .in('submission_id', activeSubIds)
                .order('created_at', { ascending: false });
            
            if (logs) {
                logs.forEach(log => {
                    if (!logsBySubId[log.submission_id]) {
                        logsBySubId[log.submission_id] = log;
                    }
                });
            }
        }

        const formattedActiveDocs = underReviewDocs.map(doc => {
            let docTitle = `Submission #${doc.id.substring(0,6).toUpperCase()}`;
            if (doc.submission_versions && doc.submission_versions.length > 0) {
              const latest = doc.submission_versions.reduce((max, v) => (v.version_number > max.version_number ? v : max), doc.submission_versions[0]);
              const details = Array.isArray(latest.activity_proposal_details) ? latest.activity_proposal_details[0] : latest.activity_proposal_details;
              if (details?.activity_title) docTitle = details.activity_title;
              else docTitle = `${doc.documentType?.name || 'Document'} #${doc.id.substring(0,6).toUpperCase()}`;
            } else {
              docTitle = `${doc.documentType?.name || 'Document'} #${doc.id.substring(0,6).toUpperCase()}`;
            }

            return {
                id: doc.id,
                title: docTitle,
                type: doc.documentType?.name || 'Unknown',
                status: doc.status,
                latestLog: logsBySubId[doc.id] || null
            };
        });

        let totalFinished = completedCount + disapprovedCount;
        let successRate = totalFinished > 0 ? Math.round((completedCount / totalFinished) * 100) : 100;

        res.json({
            success: true,
            data: {
                hero: {
                    user: user || {},
                    activeSy: activeSy || null
                },
                statistics: {
                    pendingCount,
                    approvedCount,
                    returnedCount,
                    completedCount,
                    successRate
                },
                activeDocuments: formattedActiveDocs,
                announcements: announcements || [],
                renewal: {
                    isEligible: isRenewalEligible,
                    hasMidYear,
                    hasYearEnd
                }
            }
        });

    } catch (err) {
        console.error('Error fetching org dashboard stats:', err);
        res.status(500).json({ error: 'Failed to fetch org dashboard stats', details: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});