-- ====================================================================
-- Migration: Add Security PIN columns to users & organization_members
-- Run this in your Supabase SQL Editor to enable PIN storage in Database
-- ====================================================================

-- 1. Add security_pin and is_pin_changed to public.users (for Organization President & Personnel)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS security_pin TEXT DEFAULT '1234',
ADD COLUMN IF NOT EXISTS is_pin_changed BOOLEAN DEFAULT FALSE;

-- 2. Add security_pin and is_pin_changed to public.organization_members (for Executive Members)
ALTER TABLE public.organization_members 
ADD COLUMN IF NOT EXISTS security_pin TEXT DEFAULT '1234',
ADD COLUMN IF NOT EXISTS is_pin_changed BOOLEAN DEFAULT FALSE;
