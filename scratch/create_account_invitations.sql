-- ====================================================================
-- Migration: Create account_invitations table for Organization Invitations
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.account_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    used_at TIMESTAMPTZ,
    is_invalidated BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_account_invitations_token ON public.account_invitations(token);
CREATE INDEX IF NOT EXISTS idx_account_invitations_email ON public.account_invitations(email);
CREATE INDEX IF NOT EXISTS idx_account_invitations_user_id ON public.account_invitations(user_id);

-- Enable RLS
ALTER TABLE public.account_invitations ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS automatically. Add restrictive policies for anon/authenticated users.
DROP POLICY IF EXISTS "No direct public access to invitations" ON public.account_invitations;
CREATE POLICY "No direct public access to invitations" ON public.account_invitations
    FOR ALL
    USING (false);
