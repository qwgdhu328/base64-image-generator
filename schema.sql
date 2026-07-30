-- ============================================
-- DevHub Social - Schema per Supabase
-- Progetti + Video + Like + Commenti
-- ============================================

-- PROFILI (auto-creato al signup)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PROGETTI
CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user_email TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  project_url TEXT,
  image_url TEXT,
  category TEXT DEFAULT 'other',
  tags TEXT[] DEFAULT '{}',
  likes_count INT DEFAULT 0,
  comments_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- VIDEO
CREATE TABLE IF NOT EXISTS videos (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user_email TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  platform TEXT DEFAULT 'youtube',
  tags TEXT[] DEFAULT '{}',
  likes_count INT DEFAULT 0,
  comments_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- LIKE (polimorfico: vale per progetti e video)
CREATE TABLE IF NOT EXISTS likes (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id INT REFERENCES projects(id) ON DELETE CASCADE,
  video_id INT REFERENCES videos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_like UNIQUE (user_id, project_id, video_id),
  CHECK (
    (project_id IS NOT NULL AND video_id IS NULL) OR
    (project_id IS NULL AND video_id IS NOT NULL)
  )
);

-- COMMENTI (polimorfico)
CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user_email TEXT,
  project_id INT REFERENCES projects(id) ON DELETE CASCADE,
  video_id INT REFERENCES videos(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (
    (project_id IS NOT NULL AND video_id IS NULL) OR
    (project_id IS NULL AND video_id IS NOT NULL)
  )
);

-- ============================================
-- TRIGGER: aggiorna likes_count e comments_count
-- ============================================

CREATE OR REPLACE FUNCTION update_project_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.project_id IS NOT NULL THEN
    UPDATE projects SET likes_count = (SELECT COUNT(*) FROM likes WHERE project_id = NEW.project_id) WHERE id = NEW.project_id;
  ELSIF TG_OP = 'DELETE' AND OLD.project_id IS NOT NULL THEN
    UPDATE projects SET likes_count = (SELECT COUNT(*) FROM likes WHERE project_id = OLD.project_id) WHERE id = OLD.project_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_video_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.video_id IS NOT NULL THEN
    UPDATE videos SET likes_count = (SELECT COUNT(*) FROM likes WHERE video_id = NEW.video_id) WHERE id = NEW.video_id;
  ELSIF TG_OP = 'DELETE' AND OLD.video_id IS NOT NULL THEN
    UPDATE videos SET likes_count = (SELECT COUNT(*) FROM likes WHERE video_id = OLD.video_id) WHERE id = OLD.video_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_comment_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.project_id IS NOT NULL THEN
      UPDATE projects SET comments_count = (SELECT COUNT(*) FROM comments WHERE project_id = NEW.project_id) WHERE id = NEW.project_id;
    ELSIF NEW.video_id IS NOT NULL THEN
      UPDATE videos SET comments_count = (SELECT COUNT(*) FROM comments WHERE video_id = NEW.video_id) WHERE id = NEW.video_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.project_id IS NOT NULL THEN
      UPDATE projects SET comments_count = (SELECT COUNT(*) FROM comments WHERE project_id = OLD.project_id) WHERE id = OLD.project_id;
    ELSIF OLD.video_id IS NOT NULL THEN
      UPDATE videos SET comments_count = (SELECT COUNT(*) FROM comments WHERE video_id = OLD.video_id) WHERE id = OLD.video_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_likes_project ON likes;
CREATE TRIGGER trg_likes_project AFTER INSERT OR DELETE ON likes
FOR EACH ROW EXECUTE FUNCTION update_project_counts();

DROP TRIGGER IF EXISTS trg_likes_video ON likes;
CREATE TRIGGER trg_likes_video AFTER INSERT OR DELETE ON likes
FOR EACH ROW EXECUTE FUNCTION update_video_counts();

DROP TRIGGER IF EXISTS trg_comments_count ON comments;
CREATE TRIGGER trg_comments_count AFTER INSERT OR DELETE ON comments
FOR EACH ROW EXECUTE FUNCTION update_comment_counts();

-- Auto-create profile
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username) VALUES (NEW.id, NEW.raw_user_meta_data->>'username');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- RLS (Row Level Security)
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Profili: visibili a tutti
DROP POLICY IF EXISTS "Profili visibili" ON profiles;
CREATE POLICY "Profili visibili" ON profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Modifica profilo proprio" ON profiles;
CREATE POLICY "Modifica profilo proprio" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Progetti: lettura pubblica, scrittura solo proprietario
DROP POLICY IF EXISTS "Progetti visibili" ON projects;
CREATE POLICY "Progetti visibili" ON projects FOR SELECT USING (true);
DROP POLICY IF EXISTS "Crea progetto" ON projects;
CREATE POLICY "Crea progetto" ON projects FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Modifica progetto" ON projects;
CREATE POLICY "Modifica progetto" ON projects FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Elimina progetto" ON projects;
CREATE POLICY "Elimina progetto" ON projects FOR DELETE USING (auth.uid() = user_id);

-- Video: lettura pubblica, scrittura solo proprietario
DROP POLICY IF EXISTS "Video visibili" ON videos;
CREATE POLICY "Video visibili" ON videos FOR SELECT USING (true);
DROP POLICY IF EXISTS "Crea video" ON videos;
CREATE POLICY "Crea video" ON videos FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Modifica video" ON videos;
CREATE POLICY "Modifica video" ON videos FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Elimina video" ON videos;
CREATE POLICY "Elimina video" ON videos FOR DELETE USING (auth.uid() = user_id);

-- Like: lettura pubblica, gestione solo utente loggato
DROP POLICY IF EXISTS "Like visibili" ON likes;
CREATE POLICY "Like visibili" ON likes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Inserisci like" ON likes;
CREATE POLICY "Inserisci like" ON likes FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Rimuovi like" ON likes;
CREATE POLICY "Rimuovi like" ON likes FOR DELETE USING (auth.uid() = user_id);

-- Commenti: lettura pubblica, scrittura solo utente loggato
DROP POLICY IF EXISTS "Commenti visibili" ON comments;
CREATE POLICY "Commenti visibili" ON comments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Inserisci commento" ON comments;
CREATE POLICY "Inserisci commento" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Elimina commento" ON comments;
CREATE POLICY "Elimina commento" ON comments FOR DELETE USING (auth.uid() = user_id);
