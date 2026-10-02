import { useState } from 'react';
import { ClinicalAssessmentData, PossibleCondition } from '@/types/clinicalAssessment';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  AlertTriangle, 
  ShieldAlert, 
  Stethoscope, 
  Pill, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  Activity, 
  Calendar, 
  Sparkles,
  ShoppingBag,
  ArrowRight,
  UserCheck,
  Info,
  HeartPulse
} from 'lucide-react';
import { toast } from 'sonner';

interface ClinicalAssessmentDashboardProps {
  assessment: ClinicalAssessmentData;
  onBookConsult: (specialty: string) => void;
  onPharmacyRedirect?: () => void;
  onReopenChat?: () => void;
}

export default function ClinicalAssessmentDashboard({
  assessment,
  onBookConsult,
  onPharmacyRedirect,
  onReopenChat
}: ClinicalAssessmentDashboardProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedConditionId, setExpandedConditionId] = useState<string | null>(
    assessment.conditions?.[0]?.id || null
  );
  const [completedSelfCare, setCompletedSelfCare] = useState<Record<number, boolean>>({});
  const toggleConditionExpand = (id: string) => {
    setExpandedConditionId(prev => (prev === id ? null : id));
  };

  const toggleSelfCareItem = (idx: number) => {
    setCompletedSelfCare(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  // Risk Color Mapping
  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'Low':
        return <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-300 hover:bg-emerald-500/20 text-xs px-2.5 py-0.5 font-semibold">🟢 Low Risk</Badge>;
      case 'Moderate':
        return <Badge className="bg-amber-500/15 text-amber-700 border-amber-300 hover:bg-amber-500/20 text-xs px-2.5 py-0.5 font-semibold">🟡 Moderate Risk</Badge>;
      case 'High':
        return <Badge className="bg-orange-500/15 text-orange-700 border-orange-300 hover:bg-orange-500/20 text-xs px-2.5 py-0.5 font-semibold">🟠 High Risk</Badge>;
      case 'Emergency':
        return <Badge className="bg-rose-500/15 text-rose-700 border-rose-300 hover:bg-rose-500/20 text-xs px-2.5 py-0.5 font-semibold animate-pulse">🔴 Emergency</Badge>;
      default:
        return <Badge variant="outline">{risk}</Badge>;
    }
  };

  const getConditionColorClass = (percentage: number, severity: string) => {
    if (severity === 'Emergency' || percentage >= 90) return 'border-l-4 border-l-rose-500 bg-rose-50/30';
    if (percentage >= 75) return 'border-l-4 border-l-orange-500 bg-orange-50/20';
    if (percentage >= 50) return 'border-l-4 border-l-amber-500 bg-amber-50/20';
    return 'border-l-4 border-l-emerald-500 bg-emerald-50/20';
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-in fade-in duration-500">
      
      {/* Top Action Bar (Reopen Chat for reference) */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Clinical Assessment Dashboard</h1>
            <p className="text-xs text-muted-foreground">Interactive AI triage & structured medical findings</p>
          </div>
        </div>
        {onReopenChat && (
          <Button variant="outline" size="sm" onClick={onReopenChat} className="gap-2">
            <Stethoscope className="w-4 h-4" />
            <span className="hidden sm:inline">View Chat Record</span>
          </Button>
        )}
      </div>

      {/* Header Summary Card */}
      <Card className="border-primary/20 bg-gradient-to-br from-background via-muted/20 to-primary/5 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                Assessment Summary
              </CardTitle>
              <CardDescription className="text-xs">
                Generated on {assessment.summary.date}
              </CardDescription>
            </div>
            <div>{getRiskBadge(assessment.riskLevel)}</div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-background/80 backdrop-blur border rounded-xl p-3 shadow-2xs">
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mb-1">
                <ShieldAlert className="w-3.5 h-3.5 text-primary" /> Risk Level
              </div>
              <div className="font-bold text-sm">{assessment.riskLevel}</div>
            </div>
            <div className="bg-background/80 backdrop-blur border rounded-xl p-3 shadow-2xs">
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> AI Confidence
              </div>
              <div className="font-bold text-sm text-indigo-600 dark:text-indigo-400">
                {assessment.confidence}%
              </div>
            </div>
            <div className="bg-background/80 backdrop-blur border rounded-xl p-3 shadow-2xs">
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mb-1">
                <Activity className="w-3.5 h-3.5 text-emerald-500" /> Symptoms
              </div>
              <div className="font-bold text-sm">{assessment.summary.symptomCount} analyzed</div>
            </div>
            <div className="bg-background/80 backdrop-blur border rounded-xl p-3 shadow-2xs">
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mb-1">
                <Clock className="w-3.5 h-3.5 text-amber-500" /> Duration
              </div>
              <div className="font-bold text-sm">{assessment.summary.assessmentDurationMinutes} min triage</div>
            </div>
          </div>

          {/* Legal Disclaimer */}
          <div className="bg-muted/40 border border-muted-foreground/10 rounded-lg p-3 flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <p>
              This assessment is AI-generated and does not replace consultation with a licensed healthcare professional.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs Navigation */}
      <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-5 w-full bg-muted/60 p-1 rounded-xl">
          <TabsTrigger value="overview" className="text-xs py-2 rounded-lg font-medium">
            Overview
          </TabsTrigger>
          <TabsTrigger value="conditions" className="text-xs py-2 rounded-lg font-medium">
            Conditions
          </TabsTrigger>
          <TabsTrigger value="treatment" className="text-xs py-2 rounded-lg font-medium">
            Treatment
          </TabsTrigger>
          <TabsTrigger value="doctors" className="text-xs py-2 rounded-lg font-medium">
            Doctors
          </TabsTrigger>
          <TabsTrigger value="redflags" className="text-xs py-2 rounded-lg font-medium text-rose-600 dark:text-rose-400">
            Red Flags
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Overview */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-primary" /> Clinical Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-foreground/90 leading-relaxed bg-muted/30 p-3.5 rounded-lg border border-border/40">
                {assessment.clinicalSummaryText}
              </p>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Primary Complaint & Symptoms
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {assessment.summary.symptomsReported.map((symptom, idx) => (
                      <Badge key={idx} variant="secondary" className="px-2.5 py-1 text-xs">
                        ✓ {symptom}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Assessment Timeline
                  </h4>
                  <div className="text-xs space-y-1 text-muted-foreground bg-muted/20 p-2.5 rounded-lg">
                    <div><strong className="text-foreground">Symptom Duration:</strong> {assessment.summary.duration}</div>
                    <div><strong className="text-foreground">Reported On:</strong> {assessment.summary.date}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Possible Conditions */}
        <TabsContent value="conditions" className="mt-4 space-y-4">
          <div className="space-y-3">
            {assessment.conditions.map((condition) => {
              const isExpanded = expandedConditionId === condition.id;
              return (
                <Card 
                  key={condition.id} 
                  className={`transition-all ${getConditionColorClass(condition.matchPercentage, condition.severity)}`}
                >
                  <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0">
                    <div className="space-y-1 pr-4">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm text-foreground">{condition.name}</h3>
                        <Badge variant="outline" className="text-[10px] px-2 py-0">
                          {condition.severity} Severity
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {condition.rationale}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span className="text-sm font-bold text-primary">{condition.matchPercentage}%</span>
                        <span className="block text-[10px] text-muted-foreground">Match</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => toggleConditionExpand(condition.id)}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                    </div>
                  </CardHeader>

                  <CardContent className="px-4 pb-3 pt-0">
                    <Progress value={condition.matchPercentage} className="h-1.5 mb-3" />

                    {/* Collapsed Supporting Symptoms */}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {condition.supportingSymptoms.map((sym, i) => (
                        <span key={i} className="text-[11px] bg-background/80 text-foreground px-2 py-0.5 rounded border border-border/50">
                          ✓ {sym}
                        </span>
                      ))}
                    </div>

                    {/* Expanded Clinical Details */}
                    {isExpanded && condition.expandedDetails && (
                      <div className="mt-4 pt-4 border-t border-border/60 space-y-3 text-xs animate-in fade-in duration-300">
                        <div>
                          <strong className="text-foreground block mb-1">Clinical Rationale:</strong>
                          <p className="text-muted-foreground leading-relaxed">
                            {condition.expandedDetails.clinicalRationale}
                          </p>
                        </div>

                        {condition.expandedDetails.supportingFindings.length > 0 && (
                          <div>
                            <strong className="text-foreground block mb-1">Supporting Findings:</strong>
                            <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                              {condition.expandedDetails.supportingFindings.map((f, idx) => (
                                <li key={idx}>{f}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {condition.expandedDetails.symptomsAgainst.length > 0 && (
                          <div>
                            <strong className="text-foreground block mb-1">Findings Against Diagnosis:</strong>
                            <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                              {condition.expandedDetails.symptomsAgainst.map((f, idx) => (
                                <li key={idx}>{f}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div>
                          <strong className="text-foreground block mb-1">Typical Progression:</strong>
                          <p className="text-muted-foreground">{condition.expandedDetails.typicalProgression}</p>
                        </div>

                        <div className="bg-rose-50 dark:bg-rose-950/20 p-2.5 rounded-lg border border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-300">
                          <strong className="block mb-0.5 font-semibold">When to Seek Urgent Care:</strong>
                          <p>{condition.expandedDetails.whenToSeekUrgentCare}</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Tab 3: Treatment */}
        <TabsContent value="treatment" className="mt-4 space-y-6">
          {/* Section A: Self Care */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" /> Section A – Self-Care Guidance
              </CardTitle>
              <CardDescription className="text-xs">
                Recommended lifestyle & home care measures to support recovery.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {assessment.treatment.selfCareChecklist.map((item, idx) => {
                  const isChecked = Boolean(completedSelfCare[idx]);
                  return (
                    <div 
                      key={idx}
                      onClick={() => toggleSelfCareItem(idx)}
                      className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                        isChecked ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900 line-through opacity-75' : 'bg-background hover:bg-muted/30 border-border'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // Handled by div click
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <span className="text-xs font-medium leading-relaxed">{item}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Section B: OTC Medications */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-indigo-700 dark:text-indigo-400">
                <Pill className="w-4 h-4" /> Section B – Safe Over-The-Counter (OTC) Relief
              </CardTitle>
              <CardDescription className="text-xs">
                Available directly from our verified partner pharmacies.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                {assessment.treatment.otcMedications.map((med) => {
                  return (
                    <Card key={med.id} className="border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/20 dark:bg-indigo-950/10 flex flex-col justify-between">
                      <CardHeader className="p-4 pb-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold text-sm text-foreground">{med.name}</h4>
                            <span className="text-xs text-muted-foreground">{med.strength}</span>
                          </div>
                          <Badge variant="outline" className="text-indigo-700 border-indigo-300 text-[10px]">
                            For: {med.purpose}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 pt-0 space-y-2 text-xs">
                        <div>
                          <span className="font-semibold text-foreground">Dosage: </span>
                          <span className="text-muted-foreground">{med.dosage}</span>
                        </div>
                        {med.warnings && (
                          <div className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2 rounded border border-amber-200 dark:border-amber-900/30">
                            <strong>Warning: </strong>{med.warnings}
                          </div>
                        )}
                        <div className="pt-2 flex items-center justify-between border-t border-indigo-100 dark:border-indigo-900/30">
                          <div>
                            <span className="text-base font-bold text-primary">{med.formattedPrice}</span>
                            <span className="block text-[10px] text-emerald-600 font-medium">In Stock</span>
                          </div>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => onPharmacyRedirect?.(med.name)}
                            className="gap-1.5"
                          >
                            <ShoppingBag className="w-3.5 h-3.5" />
                            Find at a pharmacy
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Doctors */}
        <TabsContent value="doctors" className="mt-4 space-y-4">
          <Card className="border-blue-200 dark:border-blue-900/40 bg-gradient-to-r from-blue-50/50 via-background to-indigo-50/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2 text-blue-900 dark:text-blue-300">
                <Stethoscope className="w-5 h-5 text-blue-600" /> Recommended Specialist Referral
              </CardTitle>
              <CardDescription className="text-xs">
                Based on your symptom cluster, we recommend a consultation with a specialist.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-background border p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-lg font-bold text-primary">
                    {assessment.specialistReferral.specialty}
                  </h3>
                  <Badge variant="secondary" className="text-xs font-semibold">
                    Urgency: {assessment.specialistReferral.urgency}
                  </Badge>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">Reason: </strong>
                  {assessment.specialistReferral.reason}
                </p>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t text-xs">
                  <div>
                    <span className="text-muted-foreground block">Available Specialists</span>
                    <strong className="text-foreground font-semibold">{assessment.specialistReferral.availableDoctorsCount} doctors available</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Estimated Fee</span>
                    <strong className="text-foreground font-semibold">From {assessment.specialistReferral.estimatedFee}</strong>
                  </div>
                </div>
              </div>

              <Button 
                className="w-full h-11 text-sm font-semibold gap-2 shadow-sm"
                onClick={() => onBookConsult(assessment.specialistReferral.specialty)}
              >
                <UserCheck className="w-4 h-4" />
                View {assessment.specialistReferral.specialty} Doctors
                <ArrowRight className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 5: Red Flags */}
        <TabsContent value="redflags" className="mt-4 space-y-4">
          <Card className="border-rose-300 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-rose-800 dark:text-rose-300">
                <AlertTriangle className="w-5 h-5 text-rose-600 animate-pulse" /> Emergency Red Flags Warning
              </CardTitle>
              <CardDescription className="text-xs text-rose-700 dark:text-rose-400">
                Seek immediate emergency medical care if you experience any of these critical symptoms:
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                {assessment.redFlags.map((flag, idx) => (
                  <div 
                    key={idx} 
                    className="flex items-start gap-2.5 p-3 rounded-lg bg-background/90 border border-rose-200 dark:border-rose-900/40 text-xs font-semibold text-rose-900 dark:text-rose-200"
                  >
                    <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{flag}</span>
                  </div>
                ))}
              </div>

              <div className="pt-2 text-xs text-rose-800 dark:text-rose-400 font-medium text-center">
                In a medical emergency, do not wait for an online assessment. Call local emergency services or visit the nearest hospital immediately.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
