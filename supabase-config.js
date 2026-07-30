// ⚠️ QUESTO FILE È IN .gitignore - RESTA SOLO SUL TUO DESKTOP
// NON VERRA' MAI PUSHATO SU GITHUB

const SUPABASE_CONFIG = {
  // URL del progetto Supabase (pubblico, va bene esporlo)
  // Esempio: "https://abcdefghijklm.supabase.co"
  url: "https://pwnfrodwvlyefxjqjknf.supabase.co",

  // Anon Key (pubblica, sicura da usare nel frontend)
  // La trovi in: Dashboard Supabase → Settings → API → Project API Keys → anon/public
  anonKey: "sb_publishable_m95hApmt7P0NLXjFiYq_kw_-k3X96Td",

  // Password database Postgres (PRIVATA - già aggiunta)
  // Usata solo per accesso admin/backend, NON esposta nel frontend
  dbPassword: "m0Ap0mnkeSXO9vSp"
};

// Non modificare sotto questa linea
if (typeof window !== 'undefined') {
  window.SUPABASE_CONFIG = SUPABASE_CONFIG;
}
