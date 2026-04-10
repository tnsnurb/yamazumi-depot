-- SQL Migration: Link auth.users with public.users (STRICT ACCESS VERSION)
-- Run this in the Supabase SQL Editor

-- 1. Add uuid column to public.users to link with auth.users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS uuid UUID UNIQUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;

-- 2. Create or update the handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_user_exists BOOLEAN;
  v_username TEXT;
BEGIN
  -- STRICT CHECK: Only allow sign-in if the email is already in public.users
  -- (e.g. manually added via Admin Panel by an administrator)
  SELECT EXISTS (SELECT 1 FROM public.users WHERE email = new.email) INTO v_user_exists;

  IF NOT v_user_exists THEN
     -- If the email is not pre-registered, we block the creation in auth.users
     -- This prevents "random" people from signing in with Google.
     RAISE EXCEPTION 'Access Denied: Email % is not registered in the system.', new.email;
  END IF;

  -- Extract username from metadata or use email prefix
  v_username := COALESCE(
    new.raw_user_meta_data->>'username',
    SPLIT_PART(new.email, '@', 1)
  );

  -- Link the Supabase Auth ID (uuid) to the existing record found by email
  UPDATE public.users 
  SET 
    uuid = new.id,
    avatar_url = COALESCE(avatar_url, new.raw_user_meta_data->>'avatar_url')
  WHERE email = new.email;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  BEFORE INSERT ON auth.users -- Changed to BEFORE to allow blocking the insert
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
