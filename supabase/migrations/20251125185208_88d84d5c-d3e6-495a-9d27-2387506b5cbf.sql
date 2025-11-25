-- First migration: Add new enum values to app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'advisor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'calculator';