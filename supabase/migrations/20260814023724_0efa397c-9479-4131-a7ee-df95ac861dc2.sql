CREATE TABLE public.study_decks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  subject text,
  ai_generated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_decks TO authenticated;
GRANT ALL ON public.study_decks TO service_role;
ALTER TABLE public.study_decks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own decks" ON public.study_decks FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.study_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id uuid NOT NULL REFERENCES public.study_decks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  front text NOT NULL,
  back text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_cards TO authenticated;
GRANT ALL ON public.study_cards TO service_role;
ALTER TABLE public.study_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cards" ON public.study_cards FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX study_cards_deck_idx ON public.study_cards(deck_id, position);

CREATE TABLE public.study_quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  subject text,
  ai_generated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_quizzes TO authenticated;
GRANT ALL ON public.study_quizzes TO service_role;
ALTER TABLE public.study_quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own quizzes" ON public.study_quizzes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.study_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.study_quizzes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_index integer NOT NULL DEFAULT 0,
  explanation text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_questions TO authenticated;
GRANT ALL ON public.study_questions TO service_role;
ALTER TABLE public.study_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own questions" ON public.study_questions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX study_questions_quiz_idx ON public.study_questions(quiz_id, position);

CREATE TABLE public.study_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.study_quizzes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_attempts TO authenticated;
GRANT ALL ON public.study_attempts TO service_role;
ALTER TABLE public.study_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own attempts" ON public.study_attempts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.study_ai_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  topic text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.study_ai_generations TO authenticated;
GRANT ALL ON public.study_ai_generations TO service_role;
ALTER TABLE public.study_ai_generations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own generations select" ON public.study_ai_generations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own generations insert" ON public.study_ai_generations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX study_ai_generations_user_idx ON public.study_ai_generations(user_id, created_at DESC);

CREATE TRIGGER study_decks_updated BEFORE UPDATE ON public.study_decks FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER study_cards_updated BEFORE UPDATE ON public.study_cards FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER study_quizzes_updated BEFORE UPDATE ON public.study_quizzes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER study_questions_updated BEFORE UPDATE ON public.study_questions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();