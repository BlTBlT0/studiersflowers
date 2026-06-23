CREATE TABLE public.parent_share_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Ouderoverzicht',
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.parent_share_tokens TO authenticated;
GRANT ALL ON public.parent_share_tokens TO service_role;

ALTER TABLE public.parent_share_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own parent share tokens"
ON public.parent_share_tokens
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own parent share tokens"
ON public.parent_share_tokens
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own parent share tokens"
ON public.parent_share_tokens
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own parent share tokens"
ON public.parent_share_tokens
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE TABLE public.classmate_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE DEFAULT upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 10)),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.classmate_invites TO authenticated;
GRANT ALL ON public.classmate_invites TO service_role;

ALTER TABLE public.classmate_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own classmate invites"
ON public.classmate_invites
FOR SELECT
TO authenticated
USING (auth.uid() = owner_id);

CREATE POLICY "Users can create own classmate invites"
ON public.classmate_invites
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own classmate invites"
ON public.classmate_invites
FOR UPDATE
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can delete own classmate invites"
ON public.classmate_invites
FOR DELETE
TO authenticated
USING (auth.uid() = owner_id);

CREATE TABLE public.classmate_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  classmate_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (student_id <> classmate_id),
  UNIQUE (student_id, classmate_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.classmate_connections TO authenticated;
GRANT ALL ON public.classmate_connections TO service_role;

ALTER TABLE public.classmate_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own classmate connections"
ON public.classmate_connections
FOR SELECT
TO authenticated
USING (auth.uid() = student_id OR auth.uid() = classmate_id);

CREATE POLICY "Students can create classmate requests"
ON public.classmate_connections
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can update involved classmate connections"
ON public.classmate_connections
FOR UPDATE
TO authenticated
USING (auth.uid() = student_id OR auth.uid() = classmate_id)
WITH CHECK (auth.uid() = student_id OR auth.uid() = classmate_id);

CREATE POLICY "Students can delete involved classmate connections"
ON public.classmate_connections
FOR DELETE
TO authenticated
USING (auth.uid() = student_id OR auth.uid() = classmate_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_parent_share_tokens_updated_at
BEFORE UPDATE ON public.parent_share_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_classmate_invites_updated_at
BEFORE UPDATE ON public.classmate_invites
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_classmate_connections_updated_at
BEFORE UPDATE ON public.classmate_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();