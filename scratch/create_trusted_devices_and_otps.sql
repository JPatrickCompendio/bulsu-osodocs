-- ====================================================================
-- Migration: Create user_login_otps and user_trusted_devices tables
-- ====================================================================

-- 1. Table for email login OTP verification codes
CREATE TABLE IF NOT EXISTS public.user_login_otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    otp_code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_login_otps_email ON public.user_login_otps(email);
CREATE INDEX IF NOT EXISTS idx_user_login_otps_expires ON public.user_login_otps(expires_at);

-- 2. Table for trusted device tokens (30 days expiration)
CREATE TABLE IF NOT EXISTS public.user_trusted_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    device_token TEXT NOT NULL UNIQUE,
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_trusted_devices_email ON public.user_trusted_devices(email);
CREATE INDEX IF NOT EXISTS idx_user_trusted_devices_token ON public.user_trusted_devices(device_token);

-- Enable RLS
ALTER TABLE public.user_login_otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_trusted_devices ENABLE ROW LEVEL SECURITY;

-- Security policies for brand new tables (Service role bypasses RLS automatically)
CREATE POLICY "No direct public access to user_login_otps" ON public.user_login_otps FOR ALL USING (false);
CREATE POLICY "No direct public access to user_trusted_devices" ON public.user_trusted_devices FOR ALL USING (false);
