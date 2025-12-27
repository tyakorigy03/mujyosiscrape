const { createClient } = require('@supabase/supabase-js');
require('dotenv').config(); 

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://byelcaamxxvfltnegxby.supabase.co',
  process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5ZWxjYWFteHh2Zmx0bmVneGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0MDE1MzgsImV4cCI6MjA2Njk3NzUzOH0.nYHGf_uFjw4oSAA04-ZeN1zA3SjlOkfzWgTg5sKYeGg'
);

module.exports = supabase;
