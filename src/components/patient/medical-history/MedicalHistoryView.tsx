import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, Loader2, Save, X, RefreshCw, AlertCircle, Trash2 } from 'lucide-react';
import ListItemManager from './ListItemManager';
import {
    ClinicalSummaryService,
    ClinicalSummaryRow,
    PatientDocument,
    ALLOWED_DOC_TYPES,
    MAX_DOC_BYTES,
} from '@/services/ClinicalSummaryService';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

// --- CONSTANTS ---

const COMMON_DISEASES = [
    "Hypertension", "Asthma", "Diabetes Type 1", "Diabetes Type 2", "Heart Disease"
];

const COMMON_ALLERGIES = [
    "Pollen", "Peanuts", "Penicillin", "Dust Mites", "Latex", "Shellfish"
];

const FAMILY_CONDITIONS = [
    "Hypertension", "Diabetes", "Cancer", "Heart Disease", "Stroke"
];

// Small render helpers for the structured AI clinical summary
const sourceTag = (source?: string) =>
    source ? <span className="ml-1 text-[10px] text-muted-foreground">[{source}]</span> : null;

const renderSection = (title: string, items?: React.ReactNode[]) =>
    items && items.length > 0 ? (
        <div key={title} className="space-y-1">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
            <ul className="list-disc space-y-0.5 pl-4">
                {items.map((node, i) => <li key={i}>{node}</li>)}
            </ul>
        </div>
    ) : null;

// Type for the patient_records data structure
interface PatientRecordData {
    allergies?: string[];
    chronic_conditions?: string[];
    family_history?: string[];
    current_medications?: Array<{ name: string; dosage: string }>;
    past_surgeries?: Array<{ condition: string; details: string }>;
    social_history?: {
        smoker?: boolean;
        smoker_details?: string;
        alcohol?: boolean;
        alcohol_details?: string;
    };
    clinical_summary?: string;
}

export default function MedicalHistoryView() {
    const { toast } = useToast();
    const { user, profile } = useAuth();
    const [loadingAI, setLoadingAI] = useState(false);
    const [loadingData, setLoadingData] = useState(true);
    const [aiSummary, setAiSummary] = useState<string | null>(null);

    // Form States
    const [medications, setMedications] = useState<any[]>([]);
    const [pastConditions, setPastConditions] = useState<string[]>([]);
    const [customPastConditions, setCustomPastConditions] = useState<any[]>([]);
    const [allergies, setAllergies] = useState<string[]>([]);
    const [familyHistory, setFamilyHistory] = useState<string[]>([]);

    // Social History
    const [isSmoker, setIsSmoker] = useState(false);
    const [smokingDetails, setSmokingDetails] = useState('');
    const [drinksAlcohol, setDrinksAlcohol] = useState(false);
    const [alcoholDetails, setAlcoholDetails] = useState('');

    // Symptoms, uploaded documents and the AI clinical summary
    const [currentSymptoms, setCurrentSymptoms] = useState('');
    const [documents, setDocuments] = useState<PatientDocument[]>([]);
    const [uploading, setUploading] = useState(false);
    const [summaryRow, setSummaryRow] = useState<ClinicalSummaryRow | null>(null);

    // Initial Data Fetch
    useEffect(() => {
        const fetchRecords = async () => {
            if (!user) return;
            setLoadingData(true);
            try {
                // Use profiles.metadata to store patient medical records instead of non-existent table
                const { data: profileData, error } = await supabase
                    .from('profiles')
                    .select('metadata')
                    .eq('user_id', user.id)
                    .single();

                if (error) throw error;

                const data = (profileData?.metadata as PatientRecordData) || {};

                if (data) {
                    setAllergies(data.allergies || []);
                    setPastConditions(data.chronic_conditions || []);
                    setFamilyHistory(data.family_history || []);

                    // Complex JSON Parsing
                    if (data.current_medications) setMedications(data.current_medications);
                    if (data.past_surgeries) setCustomPastConditions(data.past_surgeries);
                    if (data.social_history) {
                        const sh = data.social_history;
                        setIsSmoker(sh.smoker || false);
                        setSmokingDetails(sh.smoker_details || '');
                        setDrinksAlcohol(sh.alcohol || false);
                        setAlcoholDetails(sh.alcohol_details || '');
                    }
                    // Legacy single-paragraph summary, shown only until a structured one exists
                    if (data.clinical_summary) setAiSummary(data.clinical_summary);
                }

                // Structured AI clinical summary + uploaded documents
                const [row, docs] = await Promise.all([
                    ClinicalSummaryService.getMine(user.id).catch(() => null),
                    ClinicalSummaryService.listDocuments(user.id).catch(() => [] as PatientDocument[]),
                ]);
                setSummaryRow(row);
                setDocuments(docs);
            } catch (err) {
                console.error("Error fetching medical records:", err);
                // Silent fail or toast
            } finally {
                setLoadingData(false);
            }
        };

        fetchRecords();
    }, [user]);

    const handleFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []);
        e.target.value = '';
        if (!files.length || !user) return;

        setUploading(true);
        let uploaded = 0;
        for (const file of files) {
            if (!ALLOWED_DOC_TYPES.includes(file.type)) {
                toast({ title: "Unsupported file", description: `${file.name}: please upload a PDF, JPG, PNG or WebP.`, variant: "destructive" });
                continue;
            }
            if (file.size > MAX_DOC_BYTES) {
                toast({ title: "File too large", description: `${file.name} is over 10MB.`, variant: "destructive" });
                continue;
            }
            try {
                await ClinicalSummaryService.uploadDocument(user.id, file, file.type === 'application/pdf' ? 'lab_report' : 'scan');
                uploaded++;
            } catch (err: any) {
                console.error("Upload error:", err);
                toast({ title: "Upload failed", description: err?.message || `Could not upload ${file.name}.`, variant: "destructive" });
            }
        }
        if (uploaded > 0) {
            setDocuments(await ClinicalSummaryService.listDocuments(user.id).catch(() => documents));
            setSummaryRow(await ClinicalSummaryService.getMine(user.id).catch(() => summaryRow));
            toast({ title: "Uploaded", description: "Generate or update your clinical summary to include the new document." });
        }
        setUploading(false);
    };

    const handleDeleteDocument = async (doc: PatientDocument) => {
        if (!user) return;
        try {
            await ClinicalSummaryService.deleteDocument(doc, user.id);
            setDocuments(prev => prev.filter(d => d.id !== doc.id));
        } catch (err: any) {
            toast({ title: "Could not delete", description: err?.message || "Please try again.", variant: "destructive" });
        }
    };

    const handleCheckboxChange = (
        list: string[],
        setList: (l: string[]) => void,
        value: string,
        checked: boolean
    ) => {
        if (checked) {
            setList([...list, value]);
        } else {
            setList(list.filter(item => item !== value));
        }
    };

    const saveDataToBackend = async (summaryOverride?: string) => {
        if (!user) return;

        const socialHistory = {
            smoker: isSmoker,
            smoker_details: smokingDetails,
            alcohol: drinksAlcohol,
            alcohol_details: alcoholDetails
        };

        const medicalData: PatientRecordData = {
            allergies,
            chronic_conditions: pastConditions,
            family_history: familyHistory,
            current_medications: medications,
            past_surgeries: customPastConditions,
            social_history: socialHistory,
            ...(summaryOverride !== undefined && { clinical_summary: summaryOverride })
        };

        // Get existing metadata and merge with medical data
        const { data: existingProfile } = await supabase
            .from('profiles')
            .select('metadata')
            .eq('user_id', user.id)
            .single();

        const existingMetadata = (existingProfile?.metadata as Record<string, unknown>) || {};
        const updatedMetadata = { ...existingMetadata, ...medicalData };

        const { error } = await supabase
            .from('profiles')
            .update({ metadata: updatedMetadata })
            .eq('user_id', user.id);

        if (error) throw error;
    };

    const handleGenerateSummary = async () => {
        if (!user) return;
        setLoadingAI(true);

        try {
            // Make sure the latest edits to the medical history are saved before summarising
            await saveDataToBackend();

            const row = await ClinicalSummaryService.generateMine(currentSymptoms.trim() || undefined);
            setSummaryRow(row);
            setAiSummary(null);
            setCurrentSymptoms('');
            setDocuments(await ClinicalSummaryService.listDocuments(user.id).catch(() => documents));

            toast({
                title: row.version > 1 ? "Clinical summary updated" : "Clinical summary generated",
                description: "Your clinical summary is saved to your profile.",
            });
        } catch (error: any) {
            console.error(error);
            toast({
                title: "Summary generation failed",
                description: error?.message || "There was an error generating the clinical summary. Please try again.",
                variant: "destructive"
            });
        } finally {
            setLoadingAI(false);
        }
    };

    const handleSave = async () => {
        try {
            await saveDataToBackend();
            toast({
                title: "Changes Saved",
                description: "Your medical history has been updated.",
            });
        } catch (error: any) {
            console.error("Save error:", error);
            toast({
                title: "Error Saving",
                description: error.message || "Could not save changes. Please try again.",
                variant: "destructive"
            });
        }
    };

    if (loadingData) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in">
            {/* --- Primary Column (Left) --- */}
            <div className="lg:col-span-2 space-y-6">
                {/* Personal Info Card */}
                <Card>
                    <CardHeader>
                        <CardTitle>Personal Information</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <Label className="text-muted-foreground">Full Name</Label>
                            <p className="font-medium">{profile?.first_name} {profile?.last_name}</p>
                        </div>
                        <div>
                            <Label className="text-muted-foreground">Phone</Label>
                            <p className="font-medium">{profile?.phone || 'N/A'}</p>
                        </div>
                        <div>
                            <Label className="text-muted-foreground">Age / Sex</Label>
                            <p className="font-medium">{(profile?.metadata as any)?.age || 'N/A'} / {(profile?.metadata as any)?.sex || 'N/A'}</p>
                        </div>
                        <div>
                            <Label className="text-muted-foreground">Address</Label>
                            <p className="font-medium">{(profile?.metadata as any)?.address || 'N/A'}</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Medical Data Entry */}
                <Card>
                    <CardHeader>
                        <CardTitle>Medical History & Records</CardTitle>
                        <CardDescription>Please update your medical records to ensure accurate diagnosis.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Accordion type="single" collapsible className="w-full" defaultValue="medications">

                            {/* Current Medications */}
                            <AccordionItem value="medications">
                                <AccordionTrigger>Current Medications</AccordionTrigger>
                                <AccordionContent>
                                    <ListItemManager
                                        items={medications}
                                        setItems={setMedications}
                                        fields={[
                                            { name: 'name', label: 'Medication Name', placeholder: 'e.g., Lisinopril' },
                                            { name: 'dosage', label: 'Dosage', placeholder: 'e.g., 10mg daily' }
                                        ]}
                                    />
                                </AccordionContent>
                            </AccordionItem>

                            {/* Past Medical History */}
                            <AccordionItem value="history">
                                <AccordionTrigger>Past Medical History</AccordionTrigger>
                                <AccordionContent className="space-y-6">
                                    <div className="space-y-3">
                                        <Label>Chronic Diseases</Label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {COMMON_DISEASES.map((disease) => (
                                                <div key={disease} className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id={`pmh-${disease}`}
                                                        checked={pastConditions.includes(disease)}
                                                        onCheckedChange={(checked) => handleCheckboxChange(pastConditions, setPastConditions, disease, checked as boolean)}
                                                    />
                                                    <Label htmlFor={`pmh-${disease}`}>{disease}</Label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <Label>Other Conditions / Surgeries</Label>
                                        <ListItemManager
                                            items={customPastConditions}
                                            setItems={setCustomPastConditions}
                                            fields={[
                                                { name: 'condition', label: 'Condition/Surgery', placeholder: 'e.g., Appendectomy' },
                                                { name: 'details', label: 'Details', placeholder: 'e.g., 2015, no complications' }
                                            ]}
                                        />
                                    </div>
                                </AccordionContent>
                            </AccordionItem>

                            {/* Allergies */}
                            <AccordionItem value="allergies">
                                <AccordionTrigger>Allergies</AccordionTrigger>
                                <AccordionContent>
                                    <div className="grid grid-cols-2 gap-2">
                                        {COMMON_ALLERGIES.map((allergy) => (
                                            <div key={allergy} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={`alg-${allergy}`}
                                                    checked={allergies.includes(allergy)}
                                                    onCheckedChange={(checked) => handleCheckboxChange(allergies, setAllergies, allergy, checked as boolean)}
                                                />
                                                <Label htmlFor={`alg-${allergy}`}>{allergy}</Label>
                                            </div>
                                        ))}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>

                            {/* Family History */}
                            <AccordionItem value="family">
                                <AccordionTrigger>Family History</AccordionTrigger>
                                <AccordionContent>
                                    <div className="space-y-2">
                                        <Label>Conditions in immediate family:</Label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {FAMILY_CONDITIONS.map((condition) => (
                                                <div key={condition} className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id={`fam-${condition}`}
                                                        checked={familyHistory.includes(condition)}
                                                        onCheckedChange={(checked) => handleCheckboxChange(familyHistory, setFamilyHistory, condition, checked as boolean)}
                                                    />
                                                    <Label htmlFor={`fam-${condition}`}>{condition}</Label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>

                            {/* Social History */}
                            <AccordionItem value="social">
                                <AccordionTrigger>Social History</AccordionTrigger>
                                <AccordionContent className="space-y-6">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="smoker"
                                                    checked={isSmoker}
                                                    onCheckedChange={(checked) => setIsSmoker(checked as boolean)}
                                                />
                                                <Label htmlFor="smoker">Do you smoke?</Label>
                                            </div>
                                        </div>
                                        {isSmoker && (
                                            <div className="pl-6">
                                                <Input
                                                    placeholder="Details (e.g., 10 cigarettes/day for 5 years)"
                                                    value={smokingDetails}
                                                    onChange={(e) => setSmokingDetails(e.target.value)}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="alcohol"
                                                    checked={drinksAlcohol}
                                                    onCheckedChange={(checked) => setDrinksAlcohol(checked as boolean)}
                                                />
                                                <Label htmlFor="alcohol">Do you drink alcohol?</Label>
                                            </div>
                                        </div>
                                        {drinksAlcohol && (
                                            <div className="pl-6">
                                                <Input
                                                    placeholder="Details (e.g., 2 beers/week)"
                                                    value={alcoholDetails}
                                                    onChange={(e) => setAlcoholDetails(e.target.value)}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>

                        </Accordion>
                    </CardContent>
                    <CardFooter className="border-t pt-6">
                        <Button onClick={handleSave} className="w-full sm:w-auto">
                            <Save className="w-4 h-4 mr-2" />
                            Save Changes
                        </Button>
                    </CardFooter>
                </Card>
            </div>

            {/* --- Secondary Column (Right) --- */}
            <div className="lg:col-span-1 space-y-6">
                {/* Symptoms & Lab Upload */}
                <Card>
                    <CardHeader>
                        <CardTitle>Generate AI Summary</CardTitle>
                        <CardDescription>Add current symptoms and lab results to generate a clinical summary.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="symptoms">Current Symptoms</Label>
                            <Textarea
                                id="symptoms"
                                placeholder="Describe any current symptoms (e.g., headache for 3 days, fever, cough)"
                                value={currentSymptoms}
                                onChange={(e) => setCurrentSymptoms(e.target.value)}
                                rows={4}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Lab Results & Scans (Optional)</Label>
                            <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary/50 transition-colors">
                                <label htmlFor="lab-file" className="cursor-pointer block">
                                    {uploading ? (
                                        <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin text-muted-foreground" />
                                    ) : (
                                        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                                    )}
                                    <span className="text-sm text-muted-foreground">
                                        {uploading ? 'Uploading...' : 'Click to upload images or PDFs (max 10MB each)'}
                                    </span>
                                    <input
                                        id="lab-file"
                                        type="file"
                                        multiple
                                        accept="application/pdf,image/jpeg,image/png,image/webp"
                                        className="hidden"
                                        onChange={handleFilesChange}
                                        disabled={uploading}
                                    />
                                </label>
                            </div>
                            {documents.length > 0 && (
                                <ul className="space-y-1.5">
                                    {documents.map((doc) => (
                                        <li key={doc.id} className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-xs">
                                            <span className="flex items-center gap-2 min-w-0">
                                                <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                                <span className="truncate">{doc.file_name || doc.title || 'Document'}</span>
                                            </span>
                                            <span className="flex items-center gap-1.5 shrink-0">
                                                <Badge variant={doc.extraction_status === 'failed' ? 'destructive' : 'secondary'} className="text-[10px] h-4 px-1.5">
                                                    {doc.extraction_status === 'processed' ? 'In summary' : doc.extraction_status === 'failed' ? 'Unreadable' : 'Not yet included'}
                                                </Badge>
                                                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleDeleteDocument(doc)} aria-label="Remove document">
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        {summaryRow?.generated_at && summaryRow.is_stale && (
                            <div className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                <span>New information has been added since your last summary. Update it to include the changes.</span>
                            </div>
                        )}
                    </CardContent>
                    <CardFooter>
                        <Button onClick={handleGenerateSummary} disabled={loadingAI || uploading} className="w-full">
                            {loadingAI ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    {summaryRow?.generated_at ? 'Updating...' : 'Generating...'}
                                </>
                            ) : summaryRow?.generated_at ? (
                                <>
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    Update Clinical Summary
                                </>
                            ) : (
                                <>
                                    <FileText className="w-4 h-4 mr-2" />
                                    Generate Clinical Summary
                                </>
                            )}
                        </Button>
                    </CardFooter>
                </Card>

                {/* AI Clinical Summary Display */}
                {(summaryRow?.generated_at || aiSummary) && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileText className="w-5 h-5 text-primary" />
                                Clinical Summary
                            </CardTitle>
                            {summaryRow?.generated_at && (
                                <CardDescription>
                                    Version {summaryRow.version} · updated {new Date(summaryRow.generated_at).toLocaleString()}
                                </CardDescription>
                            )}
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[480px] pr-4">
                                {summaryRow?.generated_at ? (
                                    <div className="space-y-4 text-sm">
                                        {summaryRow.summary.headline && <p className="font-semibold">{summaryRow.summary.headline}</p>}
                                        {summaryRow.summary.narrative && <p className="whitespace-pre-wrap leading-relaxed">{summaryRow.summary.narrative}</p>}
                                        {renderSection('Problem list', summaryRow.summary.problem_list?.map(x => <>{x.problem}{x.status ? ` (${x.status})` : ''}{x.detail ? ` — ${x.detail}` : ''}{sourceTag(x.source)}</>))}
                                        {renderSection('Medications', summaryRow.summary.medications?.map(x => <>{x.name}{x.dose ? ` — ${x.dose}` : ''}{sourceTag(x.source)}</>))}
                                        {renderSection('Allergies', summaryRow.summary.allergies?.map(x => <>{x.allergen}{x.reaction ? ` — ${x.reaction}` : ''}{sourceTag(x.source)}</>))}
                                        {renderSection('Past history', summaryRow.summary.past_history?.map(x => <>{x.item}{x.detail ? ` — ${x.detail}` : ''}{sourceTag(x.source)}</>))}
                                        {renderSection('Family history', summaryRow.summary.family_history?.map(x => <>{x.item}{sourceTag(x.source)}</>))}
                                        {renderSection('Social history', summaryRow.summary.social_history?.map(x => <>{x.item}{sourceTag(x.source)}</>))}
                                        {renderSection('Results', summaryRow.summary.results?.map(x => (
                                            <>
                                                {x.test}: <span className={['high', 'low', 'critical'].includes((x.flag || '').toLowerCase()) ? 'font-semibold text-red-600' : ''}>{x.value} {x.unit}</span>
                                                {x.reference ? ` (ref ${x.reference})` : ''}{x.flag && x.flag !== 'unflagged' ? ` · ${x.flag}` : ''}{x.date ? ` · ${x.date}` : ''}{sourceTag(x.source)}
                                            </>
                                        )))}
                                        {renderSection('Imaging', summaryRow.summary.imaging?.map(x => <>{x.study}: {x.finding}{x.date ? ` · ${x.date}` : ''}{sourceTag(x.source)}</>))}
                                        {renderSection('Recent consultations', summaryRow.summary.recent_encounters?.map(x => <>{x.date ? `${x.date}: ` : ''}{x.summary}{sourceTag(x.source)}</>))}
                                        {summaryRow.summary.vitals_trend && <p><span className="font-medium">Vitals: </span>{summaryRow.summary.vitals_trend}</p>}
                                        {renderSection('Information that would help', summaryRow.summary.data_gaps?.map(x => <>{x}</>))}
                                        <p className="text-[11px] text-muted-foreground border-t pt-3">
                                            {summaryRow.summary.disclaimer || 'AI-generated from the data on file. For clinician review only; it does not replace clinical judgement.'}
                                        </p>
                                    </div>
                                ) : (
                                    <pre className="whitespace-pre-wrap text-sm font-mono bg-muted p-4 rounded-lg">
                                        {aiSummary}
                                    </pre>
                                )}
                            </ScrollArea>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
