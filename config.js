// Supabase project shared with the coaching app, so the same accounts and
// logins work in both. The anon key is safe to publish: row-level security
// limits each signed-in user to their own rows.
export const SUPABASE_URL = 'https://dstitvnkgefekmkcwndm.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzdGl0dm5rZ2VmZWtta2N3bmRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1ODkzNzgsImV4cCI6MjA4NjE2NTM3OH0.znndZ6B0bSWFWky2IVMYhsv_pcgXcd3t3lWM4AAxF9c';

// Accounts that can edit course outlines, as the SHA-256 of the lower-case
// email address (so the address itself isn't published). Everyone else sees
// the courses as shipped, with no edit tools.
export const ADMIN_EMAIL_SHA256 = ['7b4a354fc71d34601df2c289f4affbfd648ba23108f4d6e5f9e7b246c5706bd5'];
