import { createClient } from "@supabase/supabase-js";
import { expect, it } from "vitest";
const url = process.env["SUPABASE_URL"], key = process.env["SUPABASE_SERVICE_ROLE_KEY"], publicKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
it.skipIf(!url || !key || !publicKey)("club access stays private per account and validates athlete registrations", async () => {
 if (!url || !key || !publicKey) return;
 const admin = createClient(url, key, { auth: { persistSession: false } }); const users: string[] = [];
 const clients = [];
 try {
  for (let i = 0; i < 2; i++) {
   const email = `club-management-${crypto.randomUUID()}@example.com`, password = `${crypto.randomUUID()}Aa1!`;
   const u = await admin.auth.admin.createUser({ email, password, email_confirm: true }); if (u.error || !u.data.user) throw u.error ?? new Error("User missing");
   users.push(u.data.user.id); const role = await admin.from("user_roles").insert({ user_id: u.data.user.id, role: "admin" }); if (role.error) throw role.error;
   const client = createClient(url, publicKey, { auth: { persistSession: false } }); const login = await client.auth.signInWithPassword({ email, password }); if (login.error) throw login.error; clients.push(client);
  }
  const [a, b] = clients; if (!a || !b) throw new Error("Missing clients");
  const club = await a.from("clubs").insert({ name: "Club privado A" }).select().single(); if (club.error) throw club.error;
  const other = await b.from("clubs").insert({ name: "Club privado B" }).select().single(); if (other.error) throw other.error;
  expect((await b.from("clubs").select("id").eq("id", club.data.id)).data).toEqual([]);
  expect((await a.from("athletes").insert({ first_name: "Ajeno", last_name: "Test", club_id: other.data.id })).error).not.toBeNull();
  const athlete = await a.from("athletes").insert({ first_name: "Ana", last_name: "Test", birth_date:'2012-01-01',gender:'F',club_id: club.data.id }).select().single(); if (athlete.error) throw athlete.error;
  const meet = await a.from("meets").insert({ name: "Copa club", course: "LCM" }).select().single(); if (meet.error) throw meet.error;
  const event = await a.from("events").insert({ meet_id: meet.data.id, distance: 100, stroke: 1 }).select().single(); if (event.error) throw event.error;
  const row = { athlete_id: athlete.data.id, meet_id: meet.data.id, event_id: event.data.id };
  expect((await a.from("meet_entries").insert(row)).error).not.toBeNull();
  expect((await a.from("club_meets").insert({ club_id: club.data.id, meet_id: meet.data.id })).error).toBeNull();
  expect((await b.from("club_meets").select("id").eq("club_id", club.data.id)).data).toEqual([]);
  expect((await b.from("club_meets").insert({ club_id: other.data.id, meet_id: meet.data.id })).error).not.toBeNull();
  expect((await a.from("meet_entries").insert(row)).error).toBeNull();
  expect((await a.from("club_meets").delete().eq("club_id", club.data.id)).error).not.toBeNull();
  expect((await b.from("meet_entries").select("id").eq("athlete_id", athlete.data.id)).data).toEqual([]);
  const destination = await a.from("clubs").insert({ name: "Club destino A" }).select().single(); if (destination.error) throw destination.error;
  const result = await a.from("results").insert({ athlete_id: athlete.data.id, meet_id: meet.data.id, event_id: event.data.id, final_time_ms: 62340, course: "LCM" }).select().single(); if (result.error) throw result.error;
  const split = await a.from("splits").insert({ result_id: result.data.id, split_distance: 50, cumulative_time_ms: 30000 }).select().single(); if (split.error) throw split.error;
  expect((await b.rpc("transfer_athlete_club", { p_athlete: athlete.data.id, p_club: other.data.id, p_expected_club: club.data.id })).error).not.toBeNull();
  expect((await a.rpc("transfer_athlete_club", { p_athlete: athlete.data.id, p_club: other.data.id, p_expected_club: club.data.id })).error).not.toBeNull();
  const transfer = await a.rpc("transfer_athlete_club", { p_athlete: athlete.data.id, p_club: destination.data.id, p_expected_club: club.data.id }); expect(transfer.error).toBeNull();
  const moved = await a.from("athletes").select("*").eq("id", athlete.data.id).single();
  expect(moved.data).toMatchObject({ id: athlete.data.id, first_name: "Ana", last_name: "Test", club_id: destination.data.id, registration_expires_on: `${new Date().getUTCFullYear()}-12-31` });
  expect((await a.from("results").select("id,final_time_ms").eq("athlete_id", athlete.data.id)).data).toEqual([{ id: result.data.id, final_time_ms: 62340 }]);
  expect((await a.from("splits").select("id,cumulative_time_ms").eq("result_id", result.data.id)).data).toEqual([{ id: split.data.id, cumulative_time_ms: 30000 }]);
  expect((await a.from("meet_entries").select("id").eq("athlete_id", athlete.data.id)).data).toHaveLength(1);
  expect((await a.from("club_meets").select("id").eq("club_id", destination.data.id).eq("meet_id", meet.data.id)).data).toHaveLength(1);
  expect((await a.rpc("transfer_athlete_club", { p_athlete: athlete.data.id, p_club: club.data.id, p_expected_club: club.data.id })).error).not.toBeNull();
  expect((await a.rpc("transfer_athlete_club", { p_athlete: athlete.data.id, p_club: destination.data.id, p_expected_club: destination.data.id })).error).toBeNull();
  expect((await a.from("athletes").update({ registration_expires_on: "2026-12-30" }).eq("id", athlete.data.id)).error).not.toBeNull();
  expect((await a.from("clubs").update({ team_code:"jswim" }).eq("id",club.data.id)).error).toBeNull();
  expect((await a.from("clubs").select("team_code").eq("id",club.data.id).single()).data?.team_code).toBe("JSWIM");
  expect((await a.from("clubs").update({ team_code:"JSWIM" }).eq("id",destination.data.id)).error).not.toBeNull();
  expect((await b.from("clubs").update({ team_code:"JSWIM" }).eq("id",other.data.id)).error).toBeNull();
  expect((await a.from("athletes").update({ federation_id:"ATE010112",is_active:false }).eq("id",athlete.data.id)).error).toBeNull();
  expect((await a.from("athletes").select("is_active,active_status").eq("id",athlete.data.id).single()).data).toEqual({is_active:false,active_status:false});
  expect((await a.from("athletes").insert({first_name:"Ana",last_name:"Duplicate",federation_id:"ATE010112"})).error).not.toBeNull();
 } finally {
  for (const id of users) {
   for (const table of ["splits", "results", "meet_entries", "club_meets", "events", "athletes", "meets", "clubs"]) { const r = await admin.from(table).delete().eq("owner_id", id); if (r.error) throw r.error; }
   await admin.auth.admin.deleteUser(id);
  }
 }
}, 120000);