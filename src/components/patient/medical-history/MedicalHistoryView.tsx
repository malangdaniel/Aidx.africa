import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, FileText, Loader2, Save } from 'lucide-react';
import ListItemManager from './ListItemManager';

// --- MOCK DATA / TYPES ---

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
    const [loadingAI, setLoadingAI] = useState(false);
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

    const handleGenerateSummary = () => {
        setLoadingAI(true);
        // Simulate AI delay
        setTimeout(() => {
            setLoadingAI(false);
            setAiSummary(
                "PATIENT SUMMARY:\n" +
                "Subject is a 45-year-old male presenting with reported " + (currentSymptoms || "no specific acute symptoms") + ".\n" +
                "PMH varies. " + (medications.length > 0 ? `Currently on ${medications.map(m => m.name).join(', ')}.` : "No current medications.") + "\n" +
                "Risk factors include " + (isSmoker ? "smoking" : "non-smoker") + ".\n" +
                "Suggested Action: Routine monitoring advised."
            );
        }, 2000);
    };

    const handleSave = () => {
        // Allow saving to backend
        console.log("Saving data...");
    };

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
                            <p className="font-medium">John Doe</p>
                        </div>
                        <div>
                            <Label className="text-muted-foreground">Age / Sex</Label>
                            <p className="font-medium">45 / Male</p>
                        </div>
                        <div>
                            <Label className="text-muted-foreground">Address</Label>
                            <p className="font-medium">123 Health St, Medical City</p>
                        </div>
                        <div>
                            <Label className="text-muted-foreground">Occupation</Label>
                            <p className="font-medium">Software Engineer</p>
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
                            <div className="border-2 border-dashed border-input hover:border-primary/50 transition-colors rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer bg-muted/10">
                                <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                                <p className="text-sm font-medium">Click to upload or drag & drop</p>
                                <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG up to 10MB</p>
                            </div>
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
                            <div className="p-4 bg-muted rounded-md text-xs font-mono whitespace-pre-wrap animate-in fade-in border border-primary/20">
                                {aiSummary}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
