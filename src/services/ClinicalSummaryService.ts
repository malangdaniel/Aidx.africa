import { supabase } from '@/integrations/supabase/client';

// The new tables are not in the generated Supabase types yet, so use an untyped handle here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as { from: (table: string) => any };

export interface SummarySourced { source?: string }
export interface ClinicalSummaryContent {
    headline?: string;
    demographics?: string;
    narrative?: string;
    problem_list?: Array<SummarySourced & { problem: string; status?: string; detail?: string }>;
    medications?: Array<SummarySourced & { name: string; dose?: string }>;
    allergies?: Array<SummarySourced & { allergen: string; reaction?: string }>;
    past_history?: Array<SummarySourced & { item: string; detail?: string }>;
    family_history?: Array<SummarySourced & { item: string }>;
    social_history?: Array<SummarySourced & { item: string }>;
    recent_encounters?: Array<SummarySourced & { date?: string; summary: string }>;
    ai_chat_highlights?: Array<SummarySourced & { date?: string; summary: string }>;
    results?: Array<SummarySourced & { test: string; value?: string; unit?: string; reference?: string; flag?: string; date?: string }>;
    imaging?: Array<SummarySourced & { study: string; finding?: string; date?: string }>;
    vitals_trend?: string;
    data_gaps?: string[];
    changes_since_last?: string;
    disclaimer?: string;
}

export interface ClinicalSummaryRow {
    patient_id: string;
    summary: ClinicalSummaryContent;
    summary_text: string | null;
    version: number;
    is_stale: boolean;
    stale_reason: string | null;
    generated_at: string | null;
    sources: Record<string, unknown>;
}

export interface PatientDocument {
    id: string;
    doc_type: 'lab_report' | 'imaging' | 'scan' | 'other';
    title: string | null;
    file_name: string | null;
    mime_type: string;
    size_bytes: number | null;
    doc_date: string | null;
    extraction_status: 'pending' | 'processed' | 'failed';
    created_at: string;
}

export interface HpiContent {
    hpi?: string;
    working_diagnosis?: { name: string; confidence?: string; reasoning?: string };
    differentials?: Array<{ name: string; likelihood?: string; for?: string; against?: string }>;
    red_flags?: string[];
    recommended_investigations?: Array<{ test: string; rationale?: string; urgency?: string }>;
    treatment_considerations?: Array<{ item: string; detail?: string }>;
    safety_checks?: { allergy_conflicts?: string[]; interaction_concerns?: string[]; other?: string[] };
    missing_information?: string[];
    follow_up?: string;
    disclaimer?: string;
    based_on?: { summary_version?: number | null; limited?: string };
}

export interface HpiRow {
    hpi: HpiContent;
    hpi_text: string | null;
    generated_at: string;
    summary_version: number | null;
}

export const ALLOWED_DOC_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
export const MAX_DOC_BYTES = 10 * 1024 * 1024;

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
    const { data, error } = await supabase.functions.invoke('clinical-summary', { body });
    if (error) {
        let details = error.message;
        const ctx = (error as { context?: Response }).context;
        if (ctx) {
            try {
                const parsed = await ctx.clone().json();
                if (parsed?.error) details = typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error);
            } catch { /* keep default */ }
        }
        throw new Error(details);
    }
    if (data?.error) throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
    return data as T;
}

export const ClinicalSummaryService = {
    /** Patient: read own stored summary (no AI call). */
    getMine: async (userId: string): Promise<ClinicalSummaryRow | null> => {
        const { data, error } = await db.from('patient_clinical_summary').select('*').eq('patient_id', userId).maybeSingle();
        if (error) throw error;
        return (data as ClinicalSummaryRow) ?? null;
    },

    /** Patient: build or refresh own summary. */
    generateMine: async (symptoms?: string): Promise<ClinicalSummaryRow> => {
        const res = await invoke<{ summary: ClinicalSummaryRow }>({ mode: 'summary', refresh: 'force', symptoms: symptoms || undefined });
        return res.summary;
    },

    /** Doctor: read (and refresh if stale) a patient's summary. Server enforces consent + relationship. */
    getForDoctor: async (patientId: string, refresh: 'auto' | 'never' | 'force' = 'auto'): Promise<ClinicalSummaryRow | null> => {
        const res = await invoke<{ summary: ClinicalSummaryRow | null }>({ mode: 'summary', patient_id: patientId, refresh });
        return res.summary;
    },

    /** Doctor: generate HPI + decision support for a consultation. */
    generateHpi: async (consultationId: string, live?: Record<string, unknown>): Promise<HpiRow> => {
        const res = await invoke<{ hpi: HpiContent; hpi_text: string; generated_at: string; summary_version: number | null }>({
            mode: 'hpi', consultation_id: consultationId, live,
        });
        return { hpi: res.hpi, hpi_text: res.hpi_text, generated_at: res.generated_at, summary_version: res.summary_version };
    },

    /** Doctor: previously generated HPI for this consultation (RLS: own consultations only). */
    getHpi: async (consultationId: string): Promise<HpiRow | null> => {
        const { data, error } = await db.from('consultation_hpi').select('hpi,hpi_text,generated_at,summary_version').eq('consultation_id', consultationId).maybeSingle();
        if (error) throw error;
        return (data as HpiRow) ?? null;
    },

    listDocuments: async (userId: string): Promise<PatientDocument[]> => {
        const { data, error } = await db.from('patient_documents')
            .select('id,doc_type,title,file_name,mime_type,size_bytes,doc_date,extraction_status,created_at')
            .eq('patient_id', userId).order('created_at', { ascending: false });
        if (error) throw error;
        return (data ?? []) as PatientDocument[];
    },

    uploadDocument: async (userId: string, file: File, docType: PatientDocument['doc_type'] = 'lab_report'): Promise<void> => {
        if (!ALLOWED_DOC_TYPES.includes(file.type)) throw new Error('Only PDF, JPG, PNG or WebP files are supported.');
        if (file.size > MAX_DOC_BYTES) throw new Error('Please upload a file smaller than 10MB.');
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
        const path = `${userId}/clinical/${crypto.randomUUID()}-${safeName}`;
        const { error: upErr } = await supabase.storage.from('reports').upload(path, file, { contentType: file.type });
        if (upErr) throw upErr;
        const { error: insErr } = await db.from('patient_documents').insert({
            patient_id: userId,
            doc_type: docType,
            title: file.name.replace(/\.[^.]+$/, '').slice(0, 120),
            storage_path: path,
            file_name: file.name,
            mime_type: file.type,
            size_bytes: file.size,
        });
        if (insErr) {
            await supabase.storage.from('reports').remove([path]);
            throw insErr;
        }
    },

    deleteDocument: async (doc: { id: string }, userId: string): Promise<void> => {
        const { data } = await db.from('patient_documents').select('storage_path').eq('id', doc.id).eq('patient_id', userId).maybeSingle();
        const { error } = await db.from('patient_documents').delete().eq('id', doc.id).eq('patient_id', userId);
        if (error) throw error;
        if (data?.storage_path) await supabase.storage.from('reports').remove([data.storage_path]);
    },
};
