"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isDateOnly, isEmail, isUuid, readFormText, SAFE_ACTION_ERROR } from "@/lib/form-data";

const value = readFormText;

export async function createPracticeMatter(form: FormData) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");

  const title = value(form, "title");
  const clientName = value(form, "client_name");
  const email = value(form, "client_email");
  const practiceArea = value(form, "practice_area") || "General";
  const description = value(form, "description");
  const priority = value(form, "priority") || "normal";
  const dueOn = value(form, "due_on") || null;
  const firm = value(form, "firm_id") || null;
  const responsible = value(form, "responsible_user_id") || null;

  if (title.length < 8 || title.length > 180 || clientName.length < 2 || clientName.length > 160 ||
      (email !== "" && !isEmail(email)) || practiceArea.length < 2 || practiceArea.length > 120 ||
      description.length > 30000 || !["low", "normal", "high", "urgent"].includes(priority) ||
      (dueOn !== null && !isDateOnly(dueOn)) || (firm !== null && !isUuid(firm)) || (responsible !== null && !isUuid(responsible))) {
    redirect("/jcstudio/matters/new?error=Check%20the%20matter%20details%20and%20try%20again");
  }

  const { data, error } = await db.rpc("create_practice_matter", {
    target_title: title,
    target_client_name: clientName,
    target_client_email: email || null,
    target_practice_area: practiceArea,
    target_description: description || null,
    target_firm_id: firm,
    target_due_on: dueOn,
    target_priority: priority,
    target_source_mandate_id: null,
    target_responsible_user_id: responsible,
  });
  const record = Array.isArray(data) ? data[0] : data;
  const matterId = record && typeof record === "object" && "practice_matter_id" in record
    ? String(record.practice_matter_id) : "";
  if (error || !isUuid(matterId)) {
    redirect("/jcstudio/matters/new?error=" + encodeURIComponent("Matter creation was not authorised. Confirm your current practitioner or firm verification status."));
  }
  redirect(`/jcstudio/matters/${matterId}?created=1`);
}

export async function convertAcceptedMandate(form: FormData) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");
  const mandateId = value(form, "mandate_id");
  const firmId = value(form, "firm_id") || null;
  if (!isUuid(mandateId) || (firmId !== null && !isUuid(firmId))) {
    redirect("/jcstudio/intake?error=Invalid%20mandate%20reference");
  }
  const { data, error } = await db.rpc("create_practice_matter", {
    target_title: "Accepted marketplace mandate",
    target_client_name: "Client",
    target_client_email: null,
    target_practice_area: "General",
    target_description: null,
    target_firm_id: firmId,
    target_due_on: null,
    target_priority: "normal",
    target_source_mandate_id: mandateId,
    target_responsible_user_id: null,
  });
  const record = Array.isArray(data) ? data[0] : data;
  const matterId = record && typeof record === "object" && "practice_matter_id" in record
    ? String(record.practice_matter_id) : "";
  if (error || !isUuid(matterId)) {
    redirect("/jcstudio/intake?error=" + encodeURIComponent("Conversion requires an active accepted mandate and matching authorised firm or practitioner."));
  }
  redirect(`/jcstudio/matters/${matterId}?converted=1`);
}

export async function createPracticeNote(form: FormData) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");
  const matterId = value(form, "matter_id");
  const body = value(form, "body");
  const noteType = value(form, "note_type") || "attendance";
  if (!isUuid(matterId) || body.length < 1 || body.length > 30000 ||
      !["attendance", "research", "strategy", "client_instruction", "internal"].includes(noteType)) {
    redirect("/jcstudio?error=Invalid%20note%20details");
  }
  const { error } = await db.from("practice_matter_notes").insert({
    matter_id: matterId, author_user_id: user.id, body, note_type: noteType, visibility: "internal",
  });
  if (error) redirect(`/jcstudio/matters/${matterId}?error=${encodeURIComponent(SAFE_ACTION_ERROR)}`);
  redirect(`/jcstudio/matters/${matterId}?note=added`);
}

export async function createPracticeTask(form: FormData) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");
  const matterId = value(form, "matter_id");
  const title = value(form, "title");
  const description = value(form, "description");
  const taskType = value(form, "task_type") || "general";
  const priority = value(form, "priority") || "normal";
  const dueDate = value(form, "due_date");
  if (!isUuid(matterId) || title.length < 2 || title.length > 200 || description.length > 5000 ||
      !["general", "document", "research", "client_follow_up", "court_filing", "billing", "review"].includes(taskType) ||
      !["low", "normal", "high", "urgent"].includes(priority) || (dueDate && !isDateOnly(dueDate))) {
    redirect(`/jcstudio/matters/${matterId}?error=Check%20the%20task%20details`);
  }
  const dueAt = dueDate ? new Date(`${dueDate}T15:00:00+02:00`).toISOString() : null;
  const { error } = await db.from("practice_tasks").insert({
    matter_id: matterId, title, description: description || null, task_type: taskType, priority,
    due_at: dueAt, created_by: user.id, assigned_to: user.id,
  });
  if (error) redirect(`/jcstudio/matters/${matterId}?error=${encodeURIComponent(SAFE_ACTION_ERROR)}`);
  redirect(`/jcstudio/matters/${matterId}?task=added`);
}

export async function updatePracticeTask(form: FormData) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");
  const taskId = value(form, "task_id");
  const matterId = value(form, "matter_id");
  const status = value(form, "status");
  if (!isUuid(taskId) || !isUuid(matterId) || !["todo", "in_progress", "blocked", "done", "cancelled"].includes(status)) {
    redirect("/jcstudio/tasks?error=Invalid%20task%20update");
  }
  const { error } = await db.from("practice_tasks").update({
    status, completed_at: status === "done" ? new Date().toISOString() : null,
  }).eq("id", taskId).eq("matter_id", matterId);
  if (error) redirect("/jcstudio/tasks?error=" + encodeURIComponent(SAFE_ACTION_ERROR));
  redirect("/jcstudio/tasks?updated=1");
}
