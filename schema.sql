-- Esegui questo SQL nel Supabase SQL Editor:
-- https://pwnfrodwvlyefxjqjknf.supabase.co → SQL Editor → New Query

-- Tabella profili utente
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  bio TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabella progetti
CREATE TABLE IF NOT EXISTS projects (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user_email TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT,
  project_url TEXT,
  tags TEXT[] DEFAULT '{}',
  category TEXT DEFAULT 'other',
  likes_count INT DEFAULT 0,
  comments_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabella likes
CREATE TABLE IF NOT EXISTS likes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, project_id)
);

-- Tabella commenti
CREATE TABLE IF NOT EXISTS comments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user_email TEXT,
  project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger: quando si crea un utente, crea automaticamente il profilo
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username, avatar_url)
  VALUES (NEW.id, NEW.email, '');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Trigger: aggiorna likes_count su projects
CREATE OR REPLACE FUNCTION update_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE projects SET likes_count = likes_count + 1 WHERE id = NEW.project_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE projects SET likes_count = likes_count - 1 WHERE id = OLD.project_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_like_change ON likes;
CREATE TRIGGER on_like_change
  AFTER INSERT OR DELETE ON likes
  FOR EACH ROW EXECUTE FUNCTION update_likes_count();

-- Trigger: aggiorna comments_count su projects
CREATE OR REPLACE FUNCTION update_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE projects SET comments_count = comments_count + 1 WHERE id = NEW.project_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE projects SET comments_count = comments_count - 1 WHERE id = OLD.project_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_comment_change ON comments;
CREATE TRIGGER on_comment_change
  AFTER INSERT OR DELETE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_comments_count();

-- RLS Policies (Row Level Security)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Profiles: tutti possono leggere, solo il proprietario modifica
CREATE POLICY "Profili visibili a tutti" ON profiles FOR SELECT USING (true);
CREATE POLICY "Modifica solo proprio profilo" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Projects: tutti leggono, autenticati creano, proprietario modifica
CREATE POLICY "Progetti visibili a tutti" ON projects FOR SELECT USING (true);
CREATE POLICY "Utenti autenticati creano progetti" ON projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Proprietario modifica progetto" ON projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Proprietario elimina progetto" ON projects FOR DELETE USING (auth.uid() = user_id);

-- Likes: tutti leggono, autenticati creano/eliminano
CREATE POLICY "Likes visibili a tutti" ON likes FOR SELECT USING (true);
CREATE POLICY "Utenti autenticati mettono like" ON likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Utenti rimuovono proprio like" ON likes FOR DELETE USING (auth.uid() = user_id);

-- Comments: tutti leggono, autenticati creano
CREATE POLICY "Commenti visibili a tutti" ON comments FOR SELECT USING (true);
CREATE POLICY "Utenti autenticati commentano" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Proprietario elimina commento" ON comments FOR DELETE USING (auth.uid() = user_id);
