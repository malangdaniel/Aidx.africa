import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Stethoscope, Pill, AlertTriangle, ArrowRight, UserPlus } from 'lucide-react';

export interface Diagnosis {
  condition: string;
  probability: number;
  rationale: string;
}

interface DiagnosisResultProps {
  diagnoses: Diagnosis[];
  recommendedSpecialist: string;
  recommendedMeds: Array<{ name: string; type: string }>;
  onBookConsult: () => void;
  onOrderMeds: () => void;
}

export default function DiagnosisResult({
  diagnoses,
  recommendedSpecialist,
  recommendedMeds,
  onBookConsult,
  onOrderMeds
}: DiagnosisResultProps) {
  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
        <div>
          <h4 className="font-semibold text-amber-800">Disclaimer</h4>
          <p className="text-sm text-amber-700">
            This is an AI-generated assessment and not a definitive medical diagnosis. 
            Please consult with a qualified healthcare professional.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Potential Conditions</CardTitle>
          <CardDescription>Based on the symptoms you described</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {diagnoses.map((diagnosis, index) => (
            <div key={index} className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-medium">{diagnosis.condition}</span>
                <span className="text-sm text-muted-foreground">{diagnosis.probability}% Match</span>
              </div>
              <Progress value={diagnosis.probability} className="h-2" />
              <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                <span className="font-semibold">Rationale:</span> {diagnosis.rationale}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-800">
              <Stethoscope className="w-5 h-5" />
              Recommended Specialist
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold text-blue-900 mb-1">
              {recommendedSpecialist}
            </div>
            <p className="text-sm text-blue-700 mb-4">
              Best suited to address your specific symptoms.
            </p>
            <Button className="w-full" onClick={onBookConsult}>
              <UserPlus className="w-4 h-4 mr-2" />
              Find {recommendedSpecialist}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <Pill className="w-5 h-5" />
              Recommended Relief
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 mb-4">
              {recommendedMeds.map((med, idx) => (
                <li key={idx} className="flex items-center gap-2 text-sm text-green-900">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-600" />
                  <span className="font-medium">{med.name}</span>
                  <Badge variant="outline" className="text-green-700 border-green-300 ml-auto">
                    {med.type}
                  </Badge>
                </li>
              ))}
            </ul>
            <Button variant="outline" className="w-full border-green-600 text-green-700 hover:bg-green-100" onClick={onOrderMeds}>
              <ArrowRight className="w-4 h-4 mr-2" />
              Order Medications
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
