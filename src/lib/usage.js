// src/lib/usage.js
import { supabase } from "./supabase";

export const LIMITS = { summarize: 50, ask: 100 };

export async function fetchUsageCounts() {
  const { data: u } = await supabase.auth.getUser();
  const user = u?.user;
  if (!user) return { summarize: 0, ask: 0 };

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [sumRes, askRes] = await Promise.all([
    supabase
      .from("usage_events")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("kind", "summarize")
      .gte("created_at", since),
    supabase
      .from("usage_events")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("kind", "ask")
      .gte("created_at", since),
  ]);

  return {
    summarize: sumRes.count ?? 0,
    ask: askRes.count ?? 0,
  };
}
