import { createClient } from "@supabase/supabase-js";

// Supabase project credentials
const SUPABASE_URL = "https://kkavlrxlkvwpmujwjzxl.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_4a_MLriGe5SLrsAK5mn9Gg_Q2xUWvDA";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export default supabase;
