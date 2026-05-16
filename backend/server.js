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
const adminSupabase = supabase; // Already using service_role in supabase.js

// --- ROUTES ---

// (File upload route removed per user request)

// Login Route
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) return res.status(401).json({ error: error.message });

    const { data: profile } = await supabase.from('users').select('*').eq('id', data.user.id).single();
    res.json({ success: true, user: { ...data.user, ...profile }, session: data.session });
});

// Profile Route
app.get('/api/auth/profile', async (req, res) => {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'User ID is required' });

    const { data, error } = await supabase.from('users').select('*').eq('id', id).maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, profile: data });
});

// Get Requirements (Filtered by Type ID if provided)
app.get('/api/requirements', async (req, res) => {
    const { typeId } = req.query;
    let query = supabase.from('requirements').select('*');
    
    if (typeId) {
        query = query.eq('documentTypeID', typeId);
    }
    
    const { data, error } = await supabase.from('requirements').select('*').order('created_at', { ascending: true });
    // Wait, the previous line was slightly wrong in my thought. Let's fix it.
    
    let result;
    if (typeId) {
        result = await supabase.from('requirements').select('*').eq('documentTypeID', typeId).order('created_at', { ascending: true });
    } else {
        result = await supabase.from('requirements').select('*').order('created_at', { ascending: true });
    }
    
    if (result.error) return res.status(500).json({ error: result.error.message });
    res.json(result.data);
});

// Get Document Types
app.get('/api/document-types', async (req, res) => {
    const { data, error } = await supabase
        .from('documentType')
        .select('*')
        .order('name', { ascending: true });
    
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Get Users
app.get('/api/users', async (req, res) => {
    const { data, error } = await supabase.from('users').select('*');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Create User (Admin Only ideally)
app.post('/api/users', async (req, res) => {
    const { full_name, role, email, password } = req.body;
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email, password, email_confirm: true
    });

    if (authError) return res.status(500).json({ error: authError.message });

    const { data: profileData, error: profileError } = await supabase.from('users').insert([
        { id: authData.user.id, full_name, role, status: 'Active' }
    ]).select();

    if (profileError) return res.status(500).json({ error: profileError.message });
    res.json({ success: true, user: profileData[0] });
});

// --- REQUIREMENTS CRUD ---

// Create Requirement
app.post('/api/requirements', async (req, res) => {
    const { title, referenceCode, description, file_url, documentTypeID } = req.body;
    
    if (!title || !documentTypeID) {
        return res.status(400).json({ error: 'Title and Document Type ID are required' });
    }

    try {
        const { data, error } = await supabase
            .from('requirements')
            .insert([{ 
                title, 
                referenceCode, 
                description, 
                file_url, 
                documentTypeID,
                updatedAt: new Date().toISOString()
            }])
            .select();

        if (error) throw error;
        res.json({ success: true, data: data[0] });
    } catch (err) {
        console.error('Error creating requirement:', err);
        res.status(500).json({ error: 'Failed to create requirement', details: err.message });
    }
});

// Update Requirement
app.put('/api/requirements/:id', async (req, res) => {
    const { id } = req.params;
    const { title, referenceCode, description, file_url } = req.body;

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
        res.json({ success: true, data: data[0] });
    } catch (err) {
        console.error('Error updating requirement:', err);
        res.status(500).json({ error: 'Failed to update requirement', details: err.message });
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
        res.json({ success: true, message: 'Requirement deleted successfully' });
    } catch (err) {
        console.error('Error deleting requirement:', err);
        res.status(500).json({ error: 'Failed to delete requirement', details: err.message });
    }
});

// Audit Logging Route
app.post('/api/logs', async (req, res) => {
    const { submission_id, user_id, action, description } = req.body;
    
    try {
        const { data, error } = await supabase
            .from('submission_logs')
            .insert([{
                submission_id,
                user_id,
                action,
                description,
                created_at: new Date().toISOString()
            }])
            .select();

        if (error) throw error;
        res.json({ success: true, data: data[0] });
    } catch (err) {
        console.error('Error creating audit log:', err);
        res.status(500).json({ error: 'Failed to create audit log', details: err.message });
    }
});

// Document Registration Route
app.post('/api/submissions/register', async (req, res) => {
    const { submission_id, version_id, user_id, proposal_details, is_proposal } = req.body;
    
    try {
        console.log(`[Backend] START Registration: SubID=${submission_id}, UserID=${user_id}`);

        // 1. Save Proposal Details if applicable
        if (is_proposal && proposal_details) {
            console.log(`[Backend] Saving proposal details...`);
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
                duration: proposal_details.duration || null,
                number_of_students: parseInt(proposal_details.number_of_students) || 0,
                created_at: new Date().toISOString()
            };

            if (proposal_details.others_objective) safeProposalData.others_objective = proposal_details.others_objective;

            const { error: propErr } = await supabase
                .from('activity_proposal_details')
                .upsert([safeProposalData]);
            
            if (propErr) {
                console.warn('[Backend] Warning: Failed to save some proposal details:', propErr.message);
            }
        }

        // 2. Update Version Status
        console.log(`[Backend] Updating version status...`);
        const { error: verErr } = await supabase
            .from('submission_versions')
            .update({ status: 'submitted' })
            .eq('id', version_id);
        if (verErr) throw verErr;

        // 3. Update Submission Status
        console.log(`[Backend] Updating submission status...`);
        const { error: subErr } = await supabase
            .from('submissions')
            .update({ 
                status: 'submitted', 
                submitted_at: new Date().toISOString()
            })
            .eq('id', submission_id);
        
        if (subErr) {
            console.error('[Backend] Submission Update Error:', subErr);
            throw subErr;
        }

        // 4. Create Log
        console.log(`[Backend] Creating audit log...`);
        const { error: logErr } = await supabase
            .from('submission_logs')
            .insert([{
                submission_id,
                user_id,
                action: 'SUBMITTED',
                description: 'Document submitted for review.',
                created_at: new Date().toISOString()
            }]);
        
        if (logErr) console.error('[Backend] Log Error:', logErr);

        console.log(`[Backend] SUCCESS: Registration complete.`);
        res.json({ success: true, message: 'Document registered successfully' });
    } catch (err) {
        console.error('[Backend] FATAL Error registering document:', err);
        res.status(500).json({ error: 'Failed to register document', details: err.message });
    }
});

// Start New Submission Route
app.post('/api/submissions/start', async (req, res) => {
    const { user_id, type_id } = req.body;
    
    try {
        // 1. Create Submission Record
        const { data: sub, error: subErr } = await supabase
            .from('submissions')
            .insert([{
                user_id,
                document_type_id: type_id,
                status: 'draft',
                remarks: 'Initial draft created'
            }])
            .select()
            .single();

        if (subErr) throw subErr;

        // 2. Create Initial Version
        const { data: version, error: verErr } = await supabase
            .from('submission_versions')
            .insert([{
                submission_id: sub.id,
                version_number: 1,
                status: 'draft',
                submitted_by: user_id
            }])
            .select()
            .single();

        if (verErr) throw verErr;

        res.json({ success: true, submission: sub, version });
    } catch (err) {
        console.error('Error starting submission:', err);
        res.status(500).json({ error: 'Failed to start submission', details: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});
