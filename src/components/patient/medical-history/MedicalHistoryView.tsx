import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, FileText, Loader2, Save, X } from 'lucide-react';
import ListItemManager from './ListItemManager';
import { generatePatientHealthSummary, GeneratePatientHealthSummaryInput } from '@/services/patientHistoryAi';
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

    // Symptoms & Files
    const [currentSymptoms, setCurrentSymptoms] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

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
                    if (data.clinical_summary) setAiSummary(data.clinical_summary);
                }
            } catch (err) {
                console.error("Error fetching medical records:", err);
                // Silent fail or toast
            } finally {
                setLoadingData(false);
            }
        };

        fetchRecords();
    }, [user]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 10 * 1024 * 1024) {
                toast({
                    title: "File too large",
                    description: "Please upload a file smaller than 10MB.",
                    variant: "destructive"
                });
                return;
            }
            setSelectedFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewUrl(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const clearFile = () => {
        setSelectedFile(null);
        setPreviewUrl(null);
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
        setLoadingAI(true);
        setAiSummary(null);

        try {
            // Construct Input Object
            const socialHistoryParts = [];
            if (isSmoker) socialHistoryParts.push(`Smoker: ${smokingDetails}`);
            if (drinksAlcohol) socialHistoryParts.push(`Alcohol: ${alcoholDetails}`);
            if (!isSmoker && !drinksAlcohol) socialHistoryParts.push("No smoking or alcohol reported.");

            const input: GeneratePatientHealthSummaryInput = {
                personalDetails: {
                    fullName: profile ? `${profile.first_name || ''} ${profile.last_name || ''}` : "Patient",
                    age: (profile?.metadata as any)?.age || 0,
                    sex: (profile?.metadata as any)?.sex || "Not specified",
                    address: (profile?.metadata as any)?.address || "Not specified",
                    ethnicity: "Not specified",
                    occupation: "Not specified",
                    maritalStatus: "Not specified"
                },
                medicalHistory: {
                    currentMedications: medications.map(m => ({ name: m.name, dosage: m.dosage })),
                    pastChronicDiseases: pastConditions,
                    otherPastConditifons: customPastConditions.map(c => ({ name: c.condition, details: c.details })),
                    familyHistory: familyHistory,
                    allergies: allergies,
                    socialHistory: socialHistoryParts.join("; ")
                },
                symptoms: currentSymptoms || "No acute symptoms reported at this time.",
                labResultsDataUri: previewUrl || undefined
            };

            const result = await generatePatientHealthSummary(input);
            setAiSummary(result.summary);

            // Save to DB immediately
            await saveDataToBackend(result.summary);

            toast({
                title: "Summary Generated & Saved",
                description: "The clinical summary has been updated in your records.",
            });

        } catch (error) {
            console.error(error);
            toast({
                title: "Summary Generation Failed",
                description: "There was an error generating the clinical summary. Please try again.",
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
                            <Label>Lab Results (Optional)</Label>
                            <div className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary/50 transition-colors">
                                {previewUrl ? (
                                    <div className="relative">
                                        <img src={previewUrl} alt="Lab result preview" className="max-h-40 mx-auto rounded" />
                                        <Button
                                            variant="destructive"
                                            size="icon"
                                            className="absolute top-0 right-0 h-6 w-6"
                                            onClick={clearFile}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <label htmlFor="lab-file" className="cursor-pointer block">
                                        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                                        <span className="text-sm text-muted-foreground">Click to upload an image</span>
                                        <input
                                            id="lab-file"
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handleFileChange}
                                        />
                                    </label>
                                )}
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button onClick={handleGenerateSummary} disabled={loadingAI} className="w-full">
                            {loadingAI ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <FileText className="w-4 h-4 mr-2" />
                                    Generate Summary
                                </>
                            )}
                        </Button>
                    </CardFooter>
                </Card>

                {/* AI Summary Display */}
                {aiSummary && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileText className="w-5 h-5 text-primary" />
                                Clinical Summary
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[400px] pr-4">
                                <pre className="whitespace-pre-wrap text-sm font-mono bg-muted p-4 rounded-lg">
                                    {aiSummary}
                                </pre>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
