import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";

const extra = Constants?.expoConfig?.extra || {};
const DEFAULT_SUPABASE_URL = "https://kkavlrxlkvwpmujwjzxl.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrYXZscnhsa3Z3cG11andqenhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5MzM1NDUsImV4cCI6MjA4MjUwOTU0NX0.FX6sk8LvYno6a-MYF-RgdcoGJjgm42XF3NoX9hC2L2s";

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  process.env.EXPO_PUBLIC_VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  extra.SUPABASE_URL ||
  DEFAULT_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  extra.SUPABASE_ANON_KEY ||
  DEFAULT_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    "Supabase configuration missing. Using fallback values; set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.",
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export default supabase;
