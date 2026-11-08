import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

// Secrets: GEMINI_API_KEY (required), GEMINI_MODEL / GEMINI_FALLBACK_MODEL (optional).
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
//
// Modes
//   { mode: "summary", patient_id?, refresh?: "auto" | "force" | "never" }
//       Patient (own record) or an authorised doctor reads / rebuilds the living clinical summary.
//   { mode: "hpi", consultation_id, live? }
//       Doctor-only AI HPI + decision support for a consultation. Stored in consultation_hpi.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_MODEL = "gemini-3.8-flash";
const MODEL_RE = /^[a-z0-9.\-]{3,60}$/;
const MAX_NEW_DOCS = 5;
const MAX_INLINE_BYTES = 12 * 1024 * 1024;
const RATE_LIMIT = 8; // generations per user per minute (per instance)
const DISCLAIMER =
  "AI-generated from the data on file. For clinician review only; it does not replace clinical judgement.";

const hits = new Map<string, number[]>();
function rateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(userId, recent);
  return recent.length > RATE_LIMIT;
}
const inFlight = new Set<string>();

const clip = (v: unknown, n: number): string => {
  const s = typeof v === "string" ? v : v == null ? "" : JSON.stringify(v);
  return s.length > n ? s.slice(0, n) + "…" : s;
};
const dateOf = (iso?: string | null) => (iso ? String(iso).slice(0, 10) : "undated");

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// ---------------------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------------------
async function callGemini(parts: unknown[], systemText: string, maxTokens = 8192): Promise<{ data: any; model: string }> {
  const key = Deno.env.get("GEMINI_API_KEY") ?? "";
  if (!key) throw new HttpError(503, "AI service is not configured");
  const envModel = (Deno.env.get("GEMINI_MODEL") ?? "").trim();
  const model = MODEL_RE.test(envModel) ? envModel : DEFAULT_MODEL;
  const fb = (Deno.env.get("GEMINI_FALLBACK_MODEL") ?? "").trim();
  const models = [model];
  if (MODEL_RE.test(fb) && fb !== model) models.push(fb);

  const payload = {
    contents: [{ role: "user", parts }],
    systemInstruction: { parts: [{ text: systemText }] },
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: maxTokens,
      responseMimeType: "application/json",
    },
  };

  let lastStatus = 0;
  for (const m of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json().catch(() => ({}));
      lastStatus = res.status;
      if (res.ok) {
        const text = (data?.candidates?.[0]?.content?.parts ?? [])
          .map((p: any) => (typeof p?.text === "string" ? p.text : ""))
          .join("");
        const parsed = parseJson(text);
        if (parsed) return { data: parsed, model: m };
        console.error("Gemini returned unparseable JSON", clip(text, 300));
        break; // try next model
      }
      console.error("Gemini error", m, res.status, clip(data, 300));
      if (!(res.status === 503 || res.status === 429 || res.status === 500)) break;
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
  throw new HttpError(502, lastStatus ? "The AI service is busy right now. Please try again in a moment." : "AI request failed");
}

function parseJson(text: string): any | null {
  if (!text) return null;
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    const a = cleaned.indexOf("{");
    const b = cleaned.lastIndexOf("}");
    if (a >= 0 && b > a) {
      try {
        return JSON.parse(cleaned.slice(a, b + 1));
      } catch { /* fall through */ }
    }
    return null;
  }
}

// ---------------------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------------------
const SUMMARY_SYSTEM = `You are a clinical documentation assistant for a telemedicine platform serving patients in Nigeria. You maintain a living clinical summary for one patient so that a doctor can understand the patient quickly and safely.

RULES
- Use ONLY the data supplied. Never invent history, results, dates, doses or diagnoses. If something is not in the data, leave it out, and list it under "data_gaps" when a clinician would reasonably expect it.
- Every item must carry a short "source" label that says where it came from and who said it, e.g. "Patient-reported (profile)", "Dr consult 2026-11-03", "Uploaded lab 2026-11-01", "Patient AI chat 2026-11-05", "AI assessment 2026-11-05", "Vitals 2026-11-04". Keep patient-reported, doctor-documented, uploaded-document and AI-generated information distinguishable. AI assessments are NOT diagnoses.
- Lab and imaging values must be copied exactly as printed in the document, with units and the printed reference range. Set "flag" to "high", "low", "critical" or "normal" only when the document or its reference range supports it, otherwise "unflagged". Never guess unreadable values; mark the document unreadable instead.
- If a previous summary is supplied, update it: keep still-valid content, correct what changed, and describe the differences in "changes_since_last". Do not silently drop prior problems, allergies or medications unless the new data resolves them.
- Prefer concise clinical phrasing. No patient-facing advice.
- Output ONE JSON object only, matching exactly this shape (use empty arrays or empty strings when there is nothing):
{
  "headline": "one line: age/sex, key problems",
  "demographics": "",
  "problem_list": [{"problem":"","status":"active|resolved|suspected","detail":"","source":""}],
  "medications": [{"name":"","dose":"","source":""}],
  "allergies": [{"allergen":"","reaction":"","source":""}],
  "past_history": [{"item":"","detail":"","source":""}],
  "family_history": [{"item":"","source":""}],
  "social_history": [{"item":"","source":""}],
  "recent_encounters": [{"date":"","summary":"","source":""}],
  "ai_chat_highlights": [{"date":"","summary":"","source":""}],
  "results": [{"test":"","value":"","unit":"","reference":"","flag":"","date":"","source":""}],
  "imaging": [{"study":"","finding":"","date":"","source":""}],
  "vitals_trend": "",
  "data_gaps": [""],
  "changes_since_last": "",
  "narrative": "SOAP-style running summary in 1-3 short paragraphs",
  "document_extractions": [{"id":"<document id given in the prompt>","readable":true,"document_type":"","document_date":"YYYY-MM-DD or empty","impression":"","results":[{"test":"","value":"","unit":"","reference":"","flag":""}]}]
}
"document_extractions" must contain one entry for every file that was attached to this request (matched by the id in the text immediately before the file) and nothing else.`;

const HPI_SYSTEM = `You are a clinical decision-support assistant helping a licensed doctor during a live consultation. The doctor makes every decision; you only organise the information and offer considerations.

RULES
- Use ONLY the supplied patient summary and consultation data. Never invent findings. If key information is missing, say so under "missing_information" and lower your confidence.
- Reason like a careful clinician: weigh findings for and against each differential, consider local epidemiology (e.g. malaria, typhoid, sickle cell disease, hypertension, TB, HIV where relevant), and prioritise dangerous conditions that must not be missed.
- Flag red flags explicitly. Check proposed or likely treatments against documented allergies, current medications and comorbidities and report concerns under "safety_checks". Do not give weight-based doses unless the weight is in the data.
- Be concise and specific. Do not repeat the whole summary.
- Output ONE JSON object only:
{
  "hpi": "History of presenting illness in clinical prose, 3-8 sentences, covering onset, course, associated symptoms, relevant negatives, pertinent history",
  "working_diagnosis": {"name":"","confidence":"low|moderate|high","reasoning":""},
  "differentials": [{"name":"","likelihood":"low|moderate|high","for":"","against":""}],
  "red_flags": [""],
  "recommended_investigations": [{"test":"","rationale":"","urgency":"routine|urgent|stat"}],
  "treatment_considerations": [{"item":"","detail":""}],
  "safety_checks": {"allergy_conflicts":[""],"interaction_concerns":[""],"other":[""]},
  "missing_information": [""],
  "follow_up": ""
}`;

// ---------------------------------------------------------------------------------------
// Authorisation (mirrors public.open_patient_record)
// ---------------------------------------------------------------------------------------
async function authorizeDoctor(admin: any, doctorId: string, patientId: string) {
  const [{ data: isDoctor }, { data: isVerified }] = await Promise.all([
    admin.rpc("has_role", { _user_id: doctorId, _role: "doctor" }),
    admin.rpc("is_verified_doctor", { _uid: doctorId }),
  ]);
  if (!isDoctor || !isVerified) throw new HttpError(403, "Verified doctors only");

  const { data: rel } = await admin
    .from("consultations")
    .select("id, data_sharing_consent")
    .eq("doctor_id", doctorId)
    .eq("patient_id", patientId)
    .in("status", ["scheduled", "ongoing", "completed"]);
  if (!rel || rel.length === 0) throw new HttpError(403, "No consultation relationship with this patient");

  const { data: prof } = await admin.from("profiles").select("records_sharing_consent").eq("user_id", patientId).maybeSingle();
  const consent = Boolean(prof?.records_sharing_consent) || rel.some((r: any) => r.data_sharing_consent);
  return { consent };
}

// ---------------------------------------------------------------------------------------
// Summary generation
// ---------------------------------------------------------------------------------------
async function gatherPatientData(admin: any, patientId: string) {
  const { data: prof } = await admin
    .from("profiles")
    .select("id, first_name, last_name, date_of_birth, gender, blood_group, metadata")
    .eq("user_id", patientId)
    .maybeSingle();
  if (!prof) throw new HttpError(404, "Patient not found");

  const [vitals, chats, diags, consults, rxs, labs, docs, prev] = await Promise.all([
    admin.from("vitals").select("systolic,diastolic,heart_rate,weight,temperature,oxygen_saturation,recorded_at")
      .eq("user_id", patientId).order("recorded_at", { ascending: false }).limit(20),
    admin.from("ai_chats").select("message,response,created_at")
      .eq("user_id", patientId).order("created_at", { ascending: false }).limit(24),
    admin.from("ai_diagnoses").select("condition,severity,confidence_percentage,rationale,created_at")
      .eq("user_id", patientId).order("created_at", { ascending: false }).limit(10),
    admin.from("consultations")
      .select("id,status,started_at,ended_at,scheduled_at,chief_complaint,physical_exam,diagnosis,differential_diagnosis,notes,follow_up_plan,clinical_summary,finalized_at")
      .eq("patient_id", patientId).or("status.eq.completed,finalized_at.not.is.null")
      .order("created_at", { ascending: false }).limit(8),
    admin.from("prescriptions").select("prescription_data,notes,created_at")
      .eq("patient_id", patientId).order("created_at", { ascending: false }).limit(8),
    admin.from("lab_orders").select("test_name,urgency,reason,status,results,created_at")
      .eq("patient_id", prof.id).order("created_at", { ascending: false }).limit(15),
    admin.from("patient_documents")
      .select("id,doc_type,title,storage_path,file_name,mime_type,size_bytes,doc_date,extraction_status,extracted,created_at")
      .eq("patient_id", patientId).order("created_at", { ascending: false }).limit(15),
    admin.from("patient_clinical_summary").select("*").eq("patient_id", patientId).maybeSingle(),
  ]);

  return {
    prof,
    vitals: vitals.data ?? [],
    chats: chats.data ?? [],
    diags: diags.data ?? [],
    consults: consults.data ?? [],
    rxs: rxs.data ?? [],
    labs: labs.data ?? [],
    docs: docs.data ?? [],
    prev: prev.data ?? null,
  };
}

function ageOf(dob?: string | null, fallback?: unknown): string {
  if (dob) {
    const d = new Date(dob);
    if (!isNaN(d.getTime())) {
      const years = Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
      return `${years} years`;
    }
  }
  return fallback ? String(fallback) : "unknown";
}

function renderText(s: any): string {
  const lines: string[] = [];
  const list = (title: string, arr: any[], fmt: (x: any) => string) => {
    if (Array.isArray(arr) && arr.length) {
      lines.push(`${title}:`);
      for (const x of arr) lines.push(`- ${fmt(x)}`);
      lines.push("");
    }
  };
  if (s.headline) lines.push(s.headline, "");
  if (s.narrative) lines.push(s.narrative, "");
  list("Problem list", s.problem_list, (x) => `${x.problem} (${x.status})${x.detail ? ` — ${x.detail}` : ""} [${x.source}]`);
  list("Medications", s.medications, (x) => `${x.name} ${x.dose ?? ""} [${x.source}]`);
  list("Allergies", s.allergies, (x) => `${x.allergen}${x.reaction ? ` — ${x.reaction}` : ""} [${x.source}]`);
  list("Past history", s.past_history, (x) => `${x.item}${x.detail ? ` — ${x.detail}` : ""} [${x.source}]`);
  list("Family history", s.family_history, (x) => `${x.item} [${x.source}]`);
  list("Social history", s.social_history, (x) => `${x.item} [${x.source}]`);
  list("Results", s.results, (x) => `${x.test}: ${x.value} ${x.unit ?? ""} (ref ${x.reference || "n/a"}) ${x.flag || ""} ${x.date || ""} [${x.source}]`);
  list("Imaging", s.imaging, (x) => `${x.study}: ${x.finding} ${x.date || ""} [${x.source}]`);
  if (s.vitals_trend) lines.push(`Vitals: ${s.vitals_trend}`, "");
  list("Data gaps", s.data_gaps, (x) => String(x));
  return lines.join("\n").trim();
}

async function generateSummary(admin: any, patientId: string, reason: string, symptoms = "") {
  if (inFlight.has(patientId)) throw new HttpError(409, "A summary is already being generated for this patient");
  inFlight.add(patientId);
  const startedAt = new Date().toISOString();
  try {
    const d = await gatherPatientData(admin, patientId);
    const meta = (d.prof.metadata ?? {}) as Record<string, any>;

    const sections: string[] = [];
    sections.push(
      `PATIENT\nName: ${d.prof.first_name ?? ""} ${d.prof.last_name ?? ""}\nAge: ${ageOf(d.prof.date_of_birth, meta.age)}\nSex: ${d.prof.gender ?? meta.sex ?? "unknown"}\nBlood group: ${d.prof.blood_group ?? "unknown"}\nGenotype: ${meta.genotype ?? "unknown"}\nToday: ${startedAt.slice(0, 10)}`,
    );
    sections.push(
      `PATIENT-REPORTED MEDICAL RECORD (profile)\nChronic conditions: ${JSON.stringify(meta.chronic_conditions ?? [])}\nCurrent medications: ${JSON.stringify(meta.current_medications ?? [])}\nPast surgeries / other conditions: ${JSON.stringify(meta.past_surgeries ?? [])}\nAllergies: ${JSON.stringify(meta.allergies ?? [])}\nFamily history: ${JSON.stringify(meta.family_history ?? [])}\nSocial history: ${JSON.stringify(meta.social_history ?? {})}`,
    );
    sections.push(
      "VITALS (newest first)\n" +
        (d.vitals.length
          ? d.vitals.map((v: any) => `${dateOf(v.recorded_at)}: BP ${v.systolic ?? "?"}/${v.diastolic ?? "?"}, HR ${v.heart_rate ?? "?"}, Temp ${v.temperature ?? "?"}, SpO2 ${v.oxygen_saturation ?? "?"}, Wt ${v.weight ?? "?"}`).join("\n")
          : "none recorded"),
    );
    sections.push(
      "DOCTOR CONSULTATIONS (finalised, newest first)\n" +
        (d.consults.length
          ? d.consults.map((c: any) =>
              `[Consult ${dateOf(c.ended_at ?? c.started_at ?? c.scheduled_at)}] CC: ${clip(c.chief_complaint, 300)} | Exam: ${clip(c.physical_exam, 500)} | Dx: ${clip(c.diagnosis, 300)} | DDx: ${clip(c.differential_diagnosis, 300)} | Notes: ${clip(c.notes, 1200)} | Plan: ${clip(c.follow_up_plan, 400)}`
            ).join("\n")
          : "none"),
    );
    sections.push(
      "PRESCRIPTIONS (newest first)\n" +
        (d.rxs.length ? d.rxs.map((r: any) => `[${dateOf(r.created_at)}] ${clip(r.prescription_data, 600)} ${clip(r.notes, 200)}`).join("\n") : "none"),
    );
    sections.push(
      "LAB ORDERS (newest first)\n" +
        (d.labs.length
          ? d.labs.map((l: any) => `[${dateOf(l.created_at)}] ${l.test_name} (${l.status}) reason: ${clip(l.reason, 150)} results: ${clip(l.results, 800)}`).join("\n")
          : "none"),
    );
    sections.push(
      "PATIENT AI CONVERSATIONS (newest first; self-reported, not clinician-verified)\n" +
        (d.chats.length
          ? d.chats.map((c: any) => `[AI chat ${dateOf(c.created_at)}] Patient: ${clip(c.message, 400)} | AI: ${clip(c.response, 500)}`).join("\n")
          : "none"),
    );
    sections.push(
      "AI SYMPTOM ASSESSMENTS (not diagnoses)\n" +
        (d.diags.length
          ? d.diags.map((x: any) => `[AI assessment ${dateOf(x.created_at)}] ${x.condition} (${x.severity ?? "?"}, ${x.confidence_percentage ?? "?"}%): ${clip(x.rationale, 400)}`).join("\n")
          : "none"),
    );

    // Uploaded documents: reuse stored extractions, send only new files to the model.
    const processed = d.docs.filter((x: any) => x.extraction_status === "processed" && x.extracted);
    sections.push(
      "PREVIOUSLY EXTRACTED UPLOADED DOCUMENTS\n" +
        (processed.length
          ? processed.map((x: any) => `[Uploaded ${x.doc_type} ${x.doc_date ?? dateOf(x.created_at)} "${x.title ?? x.file_name ?? ""}"] ${clip(x.extracted, 2500)}`).join("\n")
          : "none"),
    );

    if (d.prev?.summary && Object.keys(d.prev.summary).length) {
      sections.push(`PREVIOUS SUMMARY (version ${d.prev.version}, generated ${dateOf(d.prev.generated_at)})\n${clip(d.prev.summary, 9000)}`);
    }
    if (symptoms) {
      sections.push(`CURRENT SYMPTOMS THE PATIENT TYPED JUST NOW (patient-reported, unverified)\n${symptoms}`);
    }
    sections.push(`REASON FOR THIS UPDATE: ${reason}`);

    const parts: any[] = [{ text: sections.join("\n\n") }];

    // Attach new documents
    const pending = d.docs.filter((x: any) => x.extraction_status !== "processed").slice(0, MAX_NEW_DOCS);
    const sentIds = new Set<string>();
    let bytes = 0;
    for (const doc of pending) {
      if (bytes + (doc.size_bytes ?? 0) > MAX_INLINE_BYTES) continue;
      const { data: blob, error } = await admin.storage.from("reports").download(doc.storage_path);
      if (error || !blob) {
        console.error("Could not download document", doc.id, error?.message);
        continue;
      }
      const buf = new Uint8Array(await blob.arrayBuffer());
      bytes += buf.length;
      if (bytes > MAX_INLINE_BYTES) break;
      parts.push({ text: `ATTACHED FILE — document id: ${doc.id} | type: ${doc.doc_type} | title: ${doc.title ?? doc.file_name ?? ""} | patient-stated date: ${doc.doc_date ?? "unknown"} | uploaded: ${dateOf(doc.created_at)}` });
      parts.push({ inlineData: { mimeType: doc.mime_type, data: encodeBase64(buf) } });
      sentIds.add(doc.id);
    }

    const { data: out, model } = await callGemini(parts, SUMMARY_SYSTEM);
    const extractions: any[] = Array.isArray(out.document_extractions) ? out.document_extractions : [];
    delete out.document_extractions;
    out.generated_for = { patient_id: patientId, generated_at: new Date().toISOString() };
    out.disclaimer = DISCLAIMER;

    // Persist document extractions
    for (const ex of extractions) {
      if (!ex?.id || !sentIds.has(ex.id)) continue;
      await admin.from("patient_documents").update({
        extracted: ex,
        extraction_status: ex.readable === false ? "failed" : "processed",
        doc_date: /^\d{4}-\d{2}-\d{2}$/.test(ex.document_date ?? "") ? ex.document_date : undefined,
      }).eq("id", ex.id);
    }

    const prevVersion = d.prev?.version ?? 0;
    const version = prevVersion + 1;
    const summaryText = renderText(out);
    const generatedAt = new Date().toISOString();
    const sources = {
      consultations: d.consults.length,
      ai_chats: d.chats.length,
      ai_assessments: d.diags.length,
      vitals: d.vitals.length,
      lab_orders: d.labs.length,
      documents_total: d.docs.length,
      documents_read_now: sentIds.size,
      reason,
    };

    const { error: upErr } = await admin.from("patient_clinical_summary").upsert({
      patient_id: patientId,
      summary: out,
      summary_text: summaryText,
      version,
      generated_at: generatedAt,
      model,
      sources,
      updated_at: generatedAt,
    }, { onConflict: "patient_id" });
    if (upErr) throw new HttpError(500, "Could not save summary");

    // Clear the stale flag unless something changed while we were generating
    await admin.from("patient_clinical_summary")
      .update({ is_stale: false, stale_reason: null, stale_since: null })
      .eq("patient_id", patientId)
      .or(`stale_since.is.null,stale_since.lte.${startedAt}`);

    await admin.from("patient_summary_versions").insert({
      patient_id: patientId,
      version,
      summary: out,
      summary_text: summaryText,
      changelog: typeof out.changes_since_last === "string" ? out.changes_since_last : null,
      trigger_reason: reason,
    });

    const { data: row } = await admin.from("patient_clinical_summary").select("*").eq("patient_id", patientId).single();
    return row;
  } finally {
    inFlight.delete(patientId);
  }
}

// ---------------------------------------------------------------------------------------
// HPI / decision support
// ---------------------------------------------------------------------------------------
async function generateHpi(admin: any, doctorId: string, consultationId: string, live: any) {
  const { data: c } = await admin.from("consultations").select("*").eq("id", consultationId).maybeSingle();
  if (!c || c.doctor_id !== doctorId) throw new HttpError(403, "Not your consultation");
  const patientId: string = c.patient_id;
  const { consent } = await authorizeDoctor(admin, doctorId, patientId);

  let summaryRow: any = null;
  let ownHistory: any[] = [];
  if (consent) {
    const { data: existing } = await admin.from("patient_clinical_summary").select("*").eq("patient_id", patientId).maybeSingle();
    summaryRow = existing;
    if (!existing || existing.is_stale || !existing.generated_at) {
      try {
        summaryRow = await generateSummary(admin, patientId, "refreshed for consultation");
      } catch (e) {
        if (!existing?.summary || !Object.keys(existing.summary).length) throw e;
        console.error("Summary refresh failed, using last version", (e as Error).message);
      }
    }
  } else {
    const { data: mine } = await admin.from("consultations")
      .select("started_at,ended_at,chief_complaint,physical_exam,diagnosis,differential_diagnosis,notes,follow_up_plan")
      .eq("doctor_id", doctorId).eq("patient_id", patientId).neq("id", consultationId)
      .or("status.eq.completed,finalized_at.not.is.null").order("created_at", { ascending: false }).limit(5);
    ownHistory = mine ?? [];
  }

  const { data: prof } = await admin.from("profiles").select("date_of_birth,gender,blood_group,metadata").eq("user_id", patientId).maybeSingle();
  const l = live && typeof live === "object" ? live : {};
  const txt = (v: unknown, n: number) => clip(typeof v === "string" ? v : "", n);

  const text = [
    `PATIENT: ${ageOf(prof?.date_of_birth, prof?.metadata?.age)}, ${prof?.gender ?? prof?.metadata?.sex ?? "sex unknown"}, genotype ${prof?.metadata?.genotype ?? "unknown"}`,
    consent
      ? `CLINICAL SUMMARY (version ${summaryRow?.version}, ${dateOf(summaryRow?.generated_at)}):\n${clip(summaryRow?.summary ?? {}, 14000)}`
      : `PATIENT HAS NOT SHARED THEIR FULL RECORD. Only this doctor's own earlier notes are available:\n${clip(ownHistory, 4000) || "none"}`,
    `CURRENT CONSULTATION (live, doctor-entered)`,
    `Chief complaint: ${txt(l.chiefComplaint, 600) || clip(c.chief_complaint, 600)}`,
    `Symptom checklist: ${clip(Array.isArray(l.symptomChecklist) ? l.symptomChecklist : c.symptom_checklist, 600)}`,
    `Physical exam: ${txt(l.physicalExam, 1200) || clip(c.physical_exam, 1200)}`,
    `Doctor notes (SOAP so far): ${txt(l.notes, 3000) || clip(c.notes, 3000)}`,
    `Doctor's working diagnosis so far: ${txt(l.diagnosis, 400) || clip(c.diagnosis, 400)}`,
    `Doctor's differentials so far: ${txt(l.differentialDiagnosis, 600) || clip(c.differential_diagnosis, 600)}`,
    `Medications being prescribed in this consult: ${clip(l.prescriptions, 800) || "none yet"}`,
    `Labs being ordered in this consult: ${clip(l.labOrders, 600) || "none yet"}`,
    `Transcript excerpt: ${clip(c.transcript, 5000) || "none"}`,
  ].join("\n");

  const { data: out, model } = await callGemini([{ text }], HPI_SYSTEM, 4096);
  out.disclaimer = DISCLAIMER;
  out.based_on = consent ? { summary_version: summaryRow?.version ?? null } : { limited: "patient has not shared full record" };

  const hpiText = typeof out.hpi === "string" ? out.hpi : "";
  const generatedAt = new Date().toISOString();
  const { error } = await admin.from("consultation_hpi").upsert({
    consultation_id: consultationId,
    doctor_id: doctorId,
    patient_id: patientId,
    hpi: out,
    hpi_text: hpiText,
    summary_version: summaryRow?.version ?? null,
    model,
    generated_at: generatedAt,
  }, { onConflict: "consultation_id" });
  if (error) throw new HttpError(500, "Could not save HPI");

  return { hpi: out, hpi_text: hpiText, generated_at: generatedAt, summary_version: summaryRow?.version ?? null, consent };
}

// ---------------------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const user = userData.user;
    const admin = createClient(url, service, { auth: { persistSession: false } });

    const body = await req.json().catch(() => null);
    if (!body || typeof body.mode !== "string") return json({ error: "mode is required" }, 400);

    if (body.mode === "summary") {
      const patientId: string = typeof body.patient_id === "string" ? body.patient_id : user.id;
      const refresh: string = ["auto", "force", "never"].includes(body.refresh) ? body.refresh : "auto";

      if (patientId !== user.id) {
        const { consent } = await authorizeDoctor(admin, user.id, patientId);
        if (!consent) throw new HttpError(403, "The patient has not shared their record");
      } else {
        const { data: isPatient } = await admin.rpc("has_role", { _user_id: user.id, _role: "patient" });
        if (!isPatient) throw new HttpError(403, "Only patients can build their own clinical summary");
      }

      const { data: existing } = await admin.from("patient_clinical_summary").select("*").eq("patient_id", patientId).maybeSingle();
      const hasContent = Boolean(existing?.generated_at);
      const needs = refresh === "force" || (refresh === "auto" && (!hasContent || existing?.is_stale));

      if (!needs) {
        return json({ summary: existing ?? null });
      }
      if (rateLimited(user.id)) return json({ error: "Too many requests. Please wait a moment." }, 429);
      const reason = refresh === "force"
        ? (patientId === user.id ? "patient requested update" : "doctor requested update")
        : (existing?.stale_reason ?? "first summary");
      const symptoms = patientId === user.id && typeof body.symptoms === "string" ? clip(body.symptoms.trim(), 1500) : "";
      const row = await generateSummary(admin, patientId, reason, symptoms);
      return json({ summary: row });
    }

    if (body.mode === "hpi") {
      if (typeof body.consultation_id !== "string") return json({ error: "consultation_id is required" }, 400);
      if (rateLimited(user.id)) return json({ error: "Too many requests. Please wait a moment." }, 429);
      const result = await generateHpi(admin, user.id, body.consultation_id, body.live);
      return json(result);
    }

    return json({ error: "Unknown mode" }, 400);
  } catch (err: any) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status);
    console.error("clinical-summary error:", err);
    return json({ error: "Internal server error" }, 500);
  }
});
