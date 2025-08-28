// src/lib/authHeaders.js
import { supabase } from "./supabase";

export async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token || "";
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
  return {
    Authorization: `Bearer ${token}`,       // <-- user token (required for RLS + usage limits)
    apikey: anon,                           // <-- anon key (Supabase expects this too)
    "Content-Type": "application/json",
  };
}
