import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Loader2,
  Stethoscope,
  FileText,
  Pill,
  FlaskConical,
  AlertTriangle,
  User,
  Calendar,
  Clock,
  CheckCircle2,
  ClipboardList,
  Heart,
  Info,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { format } from 'date-fns';

interface ConsultationReportProps {
  open: boolean;
  onClose: () => void;
  consultation: {
    id: string;
    scheduled_at: string;
    status: string;
    price: number;
    doctor_profile?: {
      first_name: string;
      last_name: string;
      specialties?: string[];
    };
  };
}

interface ReportData {
  diagnosis: string | null;
  clinical_summary: string | null;
  notes: string | null;
  decision_support: any | null;
  started_at: string | null;
  ended_at: string | null;
  prescriptions: PrescriptionMed[];
}

interface PrescriptionMed {
  name: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
  quantity?: string;
  notes?: string;
}

export default function ConsultationReport({ open, onClose, consultation }: ConsultationReportProps) {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ReportData | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>('diagnosis');

  useEffect(() => {
    if (open && consultation.id) {
      fetchReport();
    }
  }, [open, consultation.id]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      // Fetch full consultation data
      const { data: consultData, error } = await supabase
        .from('consultations')
        .select('diagnosis, notes, clinical_summary, decision_support, started_at, ended_at')
        .eq('id', consultation.id)
        .single();

      if (error) throw error;

      // Fetch prescriptions (untyped table)
      const { data: rxData } = await supabase
        .from('prescriptions' as any)
        .select('prescription_data, notes')
        .eq('consultation_id', consultation.id);

      const prescriptions: PrescriptionMed[] = (rxData || []).flatMap((rx: any) => {
        const meds = rx.prescription_data?.medications || [];
        return meds.map((m: any) => ({
          name: m.name || m.drug_name || 'Unknown medication',
          dosage: m.dosage || m.dose,
          frequency: m.frequency,
          duration: m.duration,
          instructions: m.instructions || rx.notes,
          quantity: m.quantity,
          notes: m.notes
        }));
      });

      setReport({
        diagnosis: consultData?.diagnosis || null,
        clinical_summary: consultData?.clinical_summary || null,
        notes: consultData?.notes || null,
        decision_support: consultData?.decision_support || null,
        started_at: consultData?.started_at || null,
        ended_at: consultData?.ended_at || null,
        prescriptions
      });
    } catch (err) {
      console.error('Error fetching report:', err);
    } finally {
      setLoading(false);
    }
  };

  const doctorName = `Dr. ${consultation.doctor_profile?.first_name || 'Unknown'} ${consultation.doctor_profile?.last_name || 'Doctor'}`;
  const specialty = consultation.doctor_profile?.specialties?.[0] || 'Medical Specialist';

  const getSessionDuration = () => {
    if (!report?.started_at || !report?.ended_at) return null;
    const start = new Date(report.started_at);
    const end = new Date(report.ended_at);
    const mins = Math.round((end.getTime() - start.getTime()) / 60000);
    return `${mins} min`;
  };

  const getDifferentials = () => {
    if (!report?.decision_support) return [];
    const ds = report.decision_support as any;
    return ds?.differentials || ds?.differential_diagnoses || ds?.conditions || [];
  };

  const getInvestigations = () => {
    if (!report?.decision_support) return [];
    const ds = report.decision_support as any;
    return ds?.investigations || ds?.recommended_tests || ds?.tests || [];
  };

  const getRedFlags = () => {
    if (!report?.decision_support) return [];
    const ds = report.decision_support as any;
    return ds?.red_flags || ds?.redFlags || [];
  };

  const toggleSection = (section: string) => {
    setExpandedSection(prev => prev === section ? null : section);
  };

  const sections = [
    {
      id: 'diagnosis',
      label: 'Diagnosis & Clinical Summary',
      icon: Stethoscope,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50 dark:bg-indigo-950/20',
      borderColor: 'border-indigo-200 dark:border-indigo-900/40',
      hasContent: !!(report?.diagnosis || report?.clinical_summary)
    },
    {
      id: 'differentials',
      label: 'Differential Diagnoses',
      icon: ClipboardList,
      color: 'text-violet-600',
      bgColor: 'bg-violet-50 dark:bg-violet-950/20',
      borderColor: 'border-violet-200 dark:border-violet-900/40',
      hasContent: getDifferentials().length > 0
    },
    {
      id: 'prescriptions',
      label: 'Prescription & Medications',
      icon: Pill,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50 dark:bg-emerald-950/20',
      borderColor: 'border-emerald-200 dark:border-emerald-900/40',
      hasContent: (report?.prescriptions || []).length > 0
    },
    {
      id: 'investigations',
      label: 'Investigations Requested',
      icon: FlaskConical,
      color: 'text-sky-600',
      bgColor: 'bg-sky-50 dark:bg-sky-950/20',
      borderColor: 'border-sky-200 dark:border-sky-900/40',
      hasContent: getInvestigations().length > 0
    },
    {
      id: 'notes',
      label: "Doctor's Notes",
      icon: FileText,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50 dark:bg-amber-950/20',
      borderColor: 'border-amber-200 dark:border-amber-900/40',
      hasContent: !!report?.notes
    },
    {
      id: 'redflags',
      label: 'Red Flags & Follow-Up',
      icon: AlertTriangle,
      color: 'text-rose-600',
      bgColor: 'bg-rose-50 dark:bg-rose-950/20',
      borderColor: 'border-rose-200 dark:border-rose-900/40',
      hasContent: getRedFlags().length > 0
    }
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-4 border-b bg-gradient-to-r from-background to-muted/30">
          <DialogTitle className="text-base font-bold">Consultation Report</DialogTitle>

          {/* Doctor & Meta info */}
          <div className="flex flex-wrap items-center justify-between gap-3 mt-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">{doctorName}</p>
                <p className="text-xs text-muted-foreground">{specialty}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {format(new Date(consultation.scheduled_at), 'MMM dd, yyyy')}
              </span>
              {getSessionDuration() && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {getSessionDuration()} session
                </span>
              )}
              <Badge variant="secondary" className="text-[10px]">
                ₦{consultation.price.toLocaleString()}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[calc(90vh-140px)]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading your consultation report...</p>
            </div>
          ) : !report ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3 text-center px-6">
              <FileText className="w-10 h-10 text-muted-foreground opacity-40" />
              <p className="text-sm text-muted-foreground">
                This consultation report is not available yet. Reports become available once the doctor completes the session.
              </p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {/* Disclaimer */}
              <div className="flex items-start gap-2 text-[11px] text-muted-foreground bg-muted/40 border border-border/40 rounded-lg p-2.5">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>This report is generated from your doctor's clinical notes and does not replace ongoing medical care.</span>
              </div>

              {/* Sections */}
              {sections.map((section) => {
                const Icon = section.icon;
                const isExpanded = expandedSection === section.id;

                return (
                  <div
                    key={section.id}
                    className={`rounded-xl border overflow-hidden transition-all ${section.borderColor}`}
                  >
                    {/* Section Header */}
                    <button
                      className={`w-full flex items-center justify-between px-4 py-3 ${section.bgColor} hover:opacity-90 transition-opacity`}
                      onClick={() => toggleSection(section.id)}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 ${section.color}`} />
                        <span className="text-xs font-semibold text-foreground">{section.label}</span>
                        {!section.hasContent && (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            No data
                          </Badge>
                        )}
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>

                    {/* Section Body */}
                    {isExpanded && (
                      <div className="p-4 space-y-3 bg-background animate-in fade-in duration-200">

                        {/* Diagnosis & Summary */}
                        {section.id === 'diagnosis' && (
                          <>
                            {report.diagnosis ? (
                              <div>
                                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">
                                  Primary Diagnosis
                                </p>
                                <p className="text-sm font-semibold text-foreground p-3 bg-muted/30 rounded-lg border border-border/40">
                                  {report.diagnosis}
                                </p>
                              </div>
                            ) : null}

                            {report.clinical_summary ? (
                              <div>
                                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">
                                  Clinical Summary
                                </p>
                                <p className="text-xs leading-relaxed text-foreground/90 bg-muted/20 p-3 rounded-lg border border-border/30">
                                  {report.clinical_summary}
                                </p>
                              </div>
                            ) : null}

                            {!report.diagnosis && !report.clinical_summary && (
                              <p className="text-xs text-muted-foreground italic">
                                No diagnosis has been recorded for this consultation.
                              </p>
                            )}
                          </>
                        )}

                        {/* Differential Diagnoses */}
                        {section.id === 'differentials' && (
                          <>
                            {getDifferentials().length > 0 ? (
                              <div className="space-y-2">
                                {getDifferentials().map((diff: any, idx: number) => (
                                  <div key={idx} className="flex items-start gap-3 p-3 rounded-lg border border-border/40 bg-muted/20">
                                    <div className="mt-0.5">
                                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                        idx === 0 ? 'bg-violet-500 text-white' : 'bg-muted text-muted-foreground'
                                      }`}>
                                        {idx + 1}
                                      </div>
                                    </div>
                                    <div className="flex-1">
                                      <p className="text-xs font-semibold text-foreground">
                                        {typeof diff === 'string' ? diff : diff.name || diff.condition}
                                      </p>
                                      {typeof diff === 'object' && diff.probability && (
                                        <p className="text-[10px] text-muted-foreground mt-0.5">
                                          Probability: {diff.probability}%
                                        </p>
                                      )}
                                      {typeof diff === 'object' && diff.rationale && (
                                        <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                                          {diff.rationale}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground italic">No differential diagnoses recorded.</p>
                            )}
                          </>
                        )}

                        {/* Prescriptions */}
                        {section.id === 'prescriptions' && (
                          <>
                            {report.prescriptions.length > 0 ? (
                              <div className="space-y-3">
                                {report.prescriptions.map((med, idx) => (
                                  <div key={idx} className="p-3.5 rounded-lg border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/30 dark:bg-emerald-950/10">
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        <Pill className="w-3.5 h-3.5 text-emerald-600" />
                                        <span className="text-sm font-bold text-foreground">{med.name}</span>
                                      </div>
                                      {med.dosage && (
                                        <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-300">
                                          {med.dosage}
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                                      {med.frequency && <span><strong className="text-foreground">Frequency:</strong> {med.frequency}</span>}
                                      {med.duration && <span><strong className="text-foreground">Duration:</strong> {med.duration}</span>}
                                      {med.quantity && <span><strong className="text-foreground">Quantity:</strong> {med.quantity}</span>}
                                    </div>
                                    {med.instructions && (
                                      <p className="mt-2 text-[11px] text-amber-800 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2 rounded border border-amber-200 dark:border-amber-900/30">
                                        <strong>Instructions:</strong> {med.instructions}
                                      </p>
                                    )}
                                    {med.notes && (
                                      <p className="mt-1.5 text-[11px] text-muted-foreground italic">{med.notes}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground italic">No medications were prescribed during this consultation.</p>
                            )}
                          </>
                        )}

                        {/* Investigations */}
                        {section.id === 'investigations' && (
                          <>
                            {getInvestigations().length > 0 ? (
                              <div className="space-y-2">
                                {getInvestigations().map((inv: any, idx: number) => (
                                  <div key={idx} className="flex items-start gap-3 p-3 rounded-lg border border-border/40 bg-muted/20">
                                    <FlaskConical className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
                                    <div>
                                      <p className="text-xs font-semibold text-foreground">
                                        {typeof inv === 'string' ? inv : inv.name || inv.test}
                                      </p>
                                      {typeof inv === 'object' && inv.reason && (
                                        <p className="text-[11px] text-muted-foreground mt-0.5">{inv.reason}</p>
                                      )}
                                      {typeof inv === 'object' && inv.priority && (
                                        <Badge variant="outline" className="text-[10px] mt-1">{inv.priority}</Badge>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground italic">No investigations were requested during this consultation.</p>
                            )}
                          </>
                        )}

                        {/* Doctor Notes */}
                        {section.id === 'notes' && (
                          <>
                            {report.notes ? (
                              <div className="p-3 rounded-lg bg-amber-50/40 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-900/30">
                                <p className="text-xs leading-relaxed text-foreground/90 whitespace-pre-wrap">
                                  {report.notes}
                                </p>
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground italic">No additional notes from the doctor.</p>
                            )}
                          </>
                        )}

                        {/* Red Flags */}
                        {section.id === 'redflags' && (
                          <>
                            {getRedFlags().length > 0 ? (
                              <div className="space-y-2">
                                {getRedFlags().map((flag: any, idx: number) => (
                                  <div key={idx} className="flex items-start gap-2.5 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40">
                                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 mt-0.5 shrink-0" />
                                    <p className="text-xs font-medium text-rose-800 dark:text-rose-300">
                                      {typeof flag === 'string' ? flag : flag.description || flag.flag}
                                    </p>
                                  </div>
                                ))}
                                <p className="text-[11px] text-rose-700 font-medium text-center pt-1">
                                  Seek immediate care if any of the above symptoms develop.
                                </p>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 p-2.5 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200">
                                <CheckCircle2 className="w-4 h-4" />
                                No specific red flags noted for this consultation.
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              <Separator className="my-2" />

              {/* Bottom Disclaimer */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30 text-[11px] text-muted-foreground border border-border/30">
                <Heart className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                <p>
                  This consultation report is for personal reference only. Always follow your doctor's instructions and seek professional medical advice for ongoing health concerns.
                </p>
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
