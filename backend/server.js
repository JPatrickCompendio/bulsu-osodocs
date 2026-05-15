const http = require('http');
const { supabase } = require('./supabase');

const PORT = 5000;

const server = http.createServer(async (req, res) => {
    // Manual CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Helper to parse JSON body
    const getJSONBody = (req) => {
        return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                try {
                    resolve(body ? JSON.parse(body) : {});
                } catch (err) {
                    reject(err);
                }
            });
        });
    };

    // Helper to send JSON response
    const sendJSON = (res, data, status = 200) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    };

    const { method, url } = req;

    try {
        // --- ROUTES ---

        // POST /api/auth/login
        if (method === 'POST' && url === '/api/auth/login') {
            const body = await getJSONBody(req);
            const { email, password } = body;

            if (!email || !password) {
                return sendJSON(res, { error: 'Email and password are required' }, 400);
            }

            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                return sendJSON(res, { error: error.message }, 401);
            }

            // Also fetch the profile to get the role
            const { data: profile, error: profileError } = await supabase
                .from('users')
                .select('*')
                .eq('id', data.user.id)
                .single();

            return sendJSON(res, { 
                success: true, 
                user: { ...data.user, ...profile },
                session: data.session
            });
        }

        // GET /api/users
        if (method === 'GET' && url === '/api/users') {
            const { supabaseKey } = require('./supabase');
            const urlToCheck = 'https://ngvnkvzpaynlwvajlxis.supabase.co';
            console.log('--- CONNECTION CHECK ---');
            console.log('Connecting to URL:', urlToCheck);
            
            const payload = JSON.parse(Buffer.from(supabaseKey.split('.')[1], 'base64').toString());
            console.log('Using Key Role:', payload.role);
            console.log('Project Ref in Key:', payload.ref);

            const { data, error } = await supabase.from('users').select('*');
            
            if (error) {
                console.error('DB ERROR:', error.message);
                return sendJSON(res, { error: error.message }, 500);
            }

            console.log(`Found ${data?.length || 0} users in this specific database.`);
            return sendJSON(res, data);
        }

        // POST /api/users
        if (method === 'POST' && url === '/api/users') {
            const body = await getJSONBody(req);
            const { 
                full_name, role, status, profile_image, email, password,
                adviser_name, no_member, org_name 
            } = body;

            if (!full_name || !role || !email || !password) {
                return sendJSON(res, { error: 'Full name, role, email, and password are required' }, 400);
            }

            // 1. Create the Auth account in Supabase
            const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                email: email,
                password: password,
                email_confirm: true
            });

            if (authError) {
                return sendJSON(res, { error: 'Auth Error: ' + authError.message }, 500);
            }

            // 2. Insert profile into users table with the SAME ID
            const { data: profileData, error: profileError } = await supabase
                .from('users')
                .insert([
                    { 
                        id: authData.user.id, // Link to Auth ID
                        full_name, 
                        role, 
                        status: status || 'Active', 
                        profile_image: profile_image || null,
                        adviser_name: adviser_name || null,
                        no_member: no_member || null,
                        org_name: org_name || null,
                        joined_date: body.joined_date || null,
                        created_at: new Date().toISOString()
                    }
                ])
                .select();

            if (profileError) {
                // Cleanup: Delete auth user if profile creation fails
                await supabase.auth.admin.deleteUser(authData.user.id);
                return sendJSON(res, { error: 'Profile Error: ' + profileError.message }, 500);
            }

            return sendJSON(res, { success: true, user: profileData[0] });
        }

        // GET /api/documents
        if (method === 'GET' && url === '/api/documents') {
            const { data, error } = await supabase
                .from('documents')
                .select('*');
            
            if (error) {
                return sendJSON(res, [
                    { id: 1, title: 'Annual Budget Report', status: 'Pending', owner: 'Org 1' },
                    { id: 2, title: 'Project Proposal', status: 'Approved', owner: 'Org 2' }
                ]);
            }
            return sendJSON(res, data);
        }

        // GET /api/requirements
        if (method === 'GET' && url === '/api/requirements') {
            const { data, error } = await supabase
                .from('requirements')
                .select('*');
            
            if (error) {
                return sendJSON(res, [
                    { id: 1, name: 'Registration Form', required: true },
                    { id: 2, name: 'Financial Statement', required: true }
                ]);
            }
            return sendJSON(res, data);
        }

        // PUT /api/users/:id
        if (method === 'PUT' && url.startsWith('/api/users/')) {
            const id = url.split('/').pop();
            const body = await getJSONBody(req);
            
            const { data, error } = await supabase
                .from('users')
                .update({
                    full_name: body.full_name,
                    role: body.role,
                    status: body.status,
                    org_name: body.org_name,
                    no_member: body.no_member,
                    adviser_name: body.adviser_name,
                    joined_date: body.joined_date
                })
                .eq('id', id)
                .select();

            if (error) return sendJSON(res, { error: error.message }, 500);
            return sendJSON(res, { success: true, user: data[0] });
        }

        // DELETE /api/users/:id
        if (method === 'DELETE' && url.startsWith('/api/users/')) {
            const id = url.split('/').pop();
            const body = await getJSONBody(req);
            const { adminEmail, adminPassword } = body;

            if (!adminEmail || !adminPassword) {
                return sendJSON(res, { error: 'Admin credentials required' }, 400);
            }

            // 1. Verify admin password
            const { error: authError } = await supabase.auth.signInWithPassword({
                email: adminEmail,
                password: adminPassword,
            });

            if (authError) {
                return sendJSON(res, { error: 'Invalid password. Access denied.' }, 401);
            }

            // 2. Delete the user (This also deletes from users table if there is a cascade or if we manually handle it)
            // In your setup, Supabase Auth delete doesn't automatically delete from public.users unless you have a trigger.
            // But usually we delete from public.users first if there's no cascade.
            
            const { error: profileDeleteError } = await supabase
                .from('users')
                .delete()
                .eq('id', id);

            if (profileDeleteError) {
                return sendJSON(res, { error: 'Profile Delete Error: ' + profileDeleteError.message }, 500);
            }

            const { error: deleteError } = await supabase.auth.admin.deleteUser(id);
            if (deleteError) {
                return sendJSON(res, { error: 'Auth Delete Error: ' + deleteError.message }, 500);
            }

            return sendJSON(res, { success: true });
        }

        // GET /api/auth/profile
        if (method === 'GET' && url.startsWith('/api/auth/profile')) {
            const urlObj = new URL(url, `http://${req.headers.host}`);
            const id = urlObj.searchParams.get('id');

            if (!id) {
                return sendJSON(res, { error: 'User ID is required' }, 400);
            }

            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', id)
                .maybeSingle();

            if (error) {
                return sendJSON(res, { error: error.message }, 500);
            }

            return sendJSON(res, { success: true, profile: data });
        }

        // 404
        sendJSON(res, { error: 'Not Found' }, 404);

    } catch (err) {
        console.error(err);
        sendJSON(res, { error: 'Internal Server Error', message: err.message }, 500);
    }
});

server.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});
