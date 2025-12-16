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
                const { data, error } = await supabase
                    .from('patient_records')
                    .select('*')
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (error) throw error;

                if (data) {
                    setAllergies(data.allergies || []);
                    setPastConditions(data.chronic_conditions || []);
                    setFamilyHistory(data.family_history || []);

                    // Complex JSON Parsing
                    if (data.current_medications) setMedications(data.current_medications);
                    if (data.past_surgeries) setCustomPastConditions(data.past_surgeries);
                    if (data.social_history) {
                        const sh = data.social_history as any;
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

        const payload = {
            user_id: user.id,
            allergies,
            chronic_conditions: pastConditions,
            family_history: familyHistory,
            current_medications: medications,
            past_surgeries: customPastConditions,
            social_history: socialHistory,
            ...(summaryOverride !== undefined && { clinical_summary: summaryOverride })
        };

        const { error } = await supabase
            .from('patient_records')
            .upsert(payload, { onConflict: 'user_id' });

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
                    age: profile?.metadata?.age || 0,
                    sex: profile?.metadata?.sex || "Not specified",
                    address: profile?.metadata?.address || "Not specified",
                    ethnicity: "Not specified",
                    occupation: "Not specified",
                    maritalStatus: "Not specified"
                },
                medicalHistory: {
                    currentMedications: medications.map(m => ({ name: m.name, dosage: m.dosage })),
                    pastChronicDiseases: pastConditions,
                    otherPastConditions: customPastConditions.map(c => ({ name: c.condition, details: c.details })),
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
                            <p className="font-medium">{profile?.metadata?.age || 'N/A'} / {profile?.metadata?.sex || 'N/A'}</p>
                        </div>
                        <div>
                            <Label className="text-muted-foreground">Address</Label>
                            <p className="font-medium">{profile?.metadata?.address || 'N/A'}</p>
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
                                                    onCheckedChange={(c) => setIsSmoker(c as boolean)}
                                                />
                                                <Label htmlFor="smoker">Are you a smoker?</Label>
                                            </div>
                                        </div>
                                        {isSmoker && (
                                            <div className="ml-6 space-y-2 animate-in slide-in-from-top-2">
                                                <Label htmlFor="smokingDetails">Details (Packs per day, years)</Label>
                                                <Input
                                                    id="smokingDetails"
                                                    value={smokingDetails}
                                                    onChange={(e) => setSmokingDetails(e.target.value)}
                                                    placeholder="e.g. 1 pack/day for 10 years"
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
                                                    onCheckedChange={(c) => setDrinksAlcohol(c as boolean)}
                                                />
                                                <Label htmlFor="alcohol">Do you drink alcohol?</Label>
                                            </div>
                                        </div>
                                        {drinksAlcohol && (
                                            <div className="ml-6 space-y-2 animate-in slide-in-from-top-2">
                                                <Label htmlFor="alcoholDetails">Frequency / Amount</Label>
                                                <Input
                                                    id="alcoholDetails"
                                                    value={alcoholDetails}
                                                    onChange={(e) => setAlcoholDetails(e.target.value)}
                                                    placeholder="e.g. Socially, 1-2 drinks per weekend"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>

                        </Accordion>
                    </CardContent>
                    <CardFooter className="flex justify-end bg-muted/20 p-4 rounded-b-lg">
                        <Button onClick={handleSave} className="w-full sm:w-auto">
                            <Save className="w-4 h-4 mr-2" />
                            Save Changes
                        </Button>
                    </CardFooter>
                </Card>
            </div>

            {/* --- Secondary Column (Right - Sticky) --- */}
            <div className="lg:col-span-1 space-y-6">

                {/* Current Symptoms & Files */}
                <Card className="sticky top-6">
                    <CardHeader>
                        <CardTitle>Current Status</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label>Current Symptoms</Label>
                            <Textarea
                                placeholder="Describe what you are feeling right now..."
                                className="min-h-[120px]"
                                value={currentSymptoms}
                                onChange={(e) => setCurrentSymptoms(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Upload Records / Lab Results</Label>
                            {!selectedFile ? (
                                <div className="relative border-2 border-dashed border-input hover:border-primary/50 transition-colors rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer bg-muted/10">
                                    <input
                                        type="file"
                                        accept="image/*,application/pdf"
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        onChange={handleFileChange}
                                    />
                                    <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                                    <p className="text-sm font-medium">Click to upload or drag & drop</p>
                                    <p className="text-xs text-muted-foreground mt-1">Images (JPG, PNG) or PDF up to 10MB</p>
                                </div>
                            ) : (
                                <div className="relative border rounded-lg p-4 bg-muted/20">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-2 truncate">
                                            <FileText className="w-5 h-5 text-primary" />
                                            <span className="text-sm font-medium truncate max-w-[150px]">{selectedFile.name}</span>
                                        </div>
                                        <Button variant="ghost" size="icon" onClick={clearFile} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>
                                    {previewUrl && selectedFile.type.startsWith('image/') && (
                                        <div className="mt-2 relative aspect-video rounded-md overflow-hidden border">
                                            <img src={previewUrl} alt="Preview" className="object-cover w-full h-full" />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* AI Summary */}
                <Card className="sticky top-[450px]">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-primary" />
                            Clinical Summary
                        </CardTitle>
                        <CardDescription>Generate a summary for your doctor.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Button
                            onClick={handleGenerateSummary}
                            className="w-full"
                            disabled={loadingAI}
                        >
                            {loadingAI ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Analyzing Records...
                                </>
                            ) : (
                                "Generate Summary"
                            )}
                        </Button>

                        {aiSummary && (
                            <div className="p-4 bg-muted rounded-md text-xs font-mono whitespace-pre-wrap animate-in fade-in border border-primary/20 max-h-[400px] overflow-y-auto">
                                {aiSummary}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
