DROP TABLE IF EXISTS public.chat_messages CASCADE;

CREATE OR REPLACE FUNCTION public.enforce_group_member_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  member_count integer;
BEGIN
  SELECT count(*) INTO member_count FROM public.group_members WHERE group_id = NEW.group_id;
  IF member_count >= 50 THEN
    RAISE EXCEPTION 'This group is full (50 members maximum).';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS group_members_limit ON public.group_members;
CREATE TRIGGER group_members_limit
BEFORE INSERT ON public.group_members
FOR EACH ROW EXECUTE FUNCTION public.enforce_group_member_limit();