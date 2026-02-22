/**
 * VitalsEntryForm — Manual vitals entry with React Hook Form + Zod validation.
 * Validates physiologically plausible ranges before submission.
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { RawVital } from '@/services/EliteService';

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------
const vitalsSchema = z.object({
    heart_rate: z.coerce.number().min(30).max(250).optional().or(z.literal('')),
    spo2: z.coerce.number().min(50).max(100).optional().or(z.literal('')),
    systolic_bp: z.coerce.number().min(50).max(300).optional().or(z.literal('')),
    diastolic_bp: z.coerce.number().min(30).max(200).optional().or(z.literal('')),
    temperature: z.coerce.number().min(33).max(43).optional().or(z.literal('')),
    weight: z.coerce.number().min(1).max(500).optional().or(z.literal('')),
    blood_glucose: z.coerce.number().min(1).max(50).optional().or(z.literal('')),
    mood: z.number().min(1).max(10).optional(),
    fatigue: z.number().min(1).max(10).optional(),
    symptoms: z.string().optional(),
});

type VitalsFormValues = z.infer<typeof vitalsSchema>;

interface VitalsEntryFormProps {
    onSubmit: (vitals: RawVital[]) => Promise<void>;
    isLoading?: boolean;
}

export default function VitalsEntryForm({ onSubmit, isLoading }: VitalsEntryFormProps) {
    const {
        register,
        handleSubmit,
        setValue,
        watch,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<VitalsFormValues>({
        resolver: zodResolver(vitalsSchema),
        defaultValues: { mood: 5, fatigue: 5 },
    });

    const moodVal = watch('mood') ?? 5;
    const fatigueVal = watch('fatigue') ?? 5;

    const handleFormSubmit = async (data: VitalsFormValues) => {
        const vitals: RawVital[] = [];

        const add = (metric: string, value: string | number | undefined, unit: string) => {
            if (value !== '' && value !== undefined && value !== null) {
                vitals.push({ metric: metric as any, value: Number(value), unit, source: 'manual', confidence: 1.0 });
            }
        };

        add('heart_rate', data.heart_rate, 'bpm');
        add('spo2', data.spo2, '%');
        add('systolic_bp', data.systolic_bp, 'mmHg');
        add('diastolic_bp', data.diastolic_bp, 'mmHg');
        add('temperature', data.temperature, '°C');
        add('weight', data.weight, 'kg');
        add('blood_glucose', data.blood_glucose, 'mmol/L');
        add('mood', data.mood, '1-10');
        add('fatigue', data.fatigue, '1-10');

        if (vitals.length === 0) {
            toast.error('Please enter at least one vital measurement.');
            return;
        }

        try {
            await onSubmit(vitals);
            toast.success('Vitals logged successfully!');
            reset({ mood: 5, fatigue: 5 });
        } catch (err: any) {
            toast.error(err.message ?? 'Failed to log vitals. Please try again.');
        }
    };

    const inputCls = "bg-white/5 border-white/20 text-white placeholder:text-white/40 focus:border-violet-400 focus:ring-violet-400/20 h-9";
    const labelCls = "text-xs font-medium text-white/70 mb-1 block";
    const errCls = "text-xs text-red-400 mt-0.5";

    return (
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
                {/* Heart Rate */}
                <div>
                    <Label className={labelCls}>Heart Rate (bpm)</Label>
                    <Input {...register('heart_rate')} type="number" placeholder="e.g. 72" className={inputCls} />
                    {errors.heart_rate && <p className={errCls}>{errors.heart_rate.message}</p>}
                </div>

                {/* SpO2 */}
                <div>
                    <Label className={labelCls}>SpO₂ (%)</Label>
                    <Input {...register('spo2')} type="number" placeholder="e.g. 98" className={inputCls} />
                    {errors.spo2 && <p className={errCls}>{errors.spo2.message}</p>}
                </div>

                {/* BP Systolic */}
                <div>
                    <Label className={labelCls}>BP Systolic (mmHg)</Label>
                    <Input {...register('systolic_bp')} type="number" placeholder="e.g. 120" className={inputCls} />
                    {errors.systolic_bp && <p className={errCls}>{errors.systolic_bp.message}</p>}
                </div>

                {/* BP Diastolic */}
                <div>
                    <Label className={labelCls}>BP Diastolic (mmHg)</Label>
                    <Input {...register('diastolic_bp')} type="number" placeholder="e.g. 80" className={inputCls} />
                    {errors.diastolic_bp && <p className={errCls}>{errors.diastolic_bp.message}</p>}
                </div>

                {/* Temperature */}
                <div>
                    <Label className={labelCls}>Temperature (°C)</Label>
                    <Input {...register('temperature')} type="number" step="0.1" placeholder="e.g. 36.8" className={inputCls} />
                    {errors.temperature && <p className={errCls}>{errors.temperature.message}</p>}
                </div>

                {/* Weight */}
                <div>
                    <Label className={labelCls}>Weight (kg)</Label>
                    <Input {...register('weight')} type="number" step="0.1" placeholder="e.g. 70" className={inputCls} />
                    {errors.weight && <p className={errCls}>{errors.weight.message}</p>}
                </div>

                {/* Blood Glucose */}
                <div className="col-span-2">
                    <Label className={labelCls}>Blood Glucose (mmol/L)</Label>
                    <Input {...register('blood_glucose')} type="number" step="0.1" placeholder="e.g. 5.5" className={inputCls} />
                    {errors.blood_glucose && <p className={errCls}>{errors.blood_glucose.message}</p>}
                </div>
            </div>

            {/* Mood slider */}
            <div>
                <Label className={labelCls}>
                    Mood: <span className="text-violet-300 font-semibold">{moodVal}/10</span>
                </Label>
                <Slider
                    min={1} max={10} step={1}
                    value={[moodVal]}
                    onValueChange={([v]) => setValue('mood', v)}
                    className="mt-1"
                />
            </div>

            {/* Fatigue slider */}
            <div>
                <Label className={labelCls}>
                    Fatigue: <span className="text-violet-300 font-semibold">{fatigueVal}/10</span>
                    <span className="text-white/40 ml-1 text-[10px]">(10 = exhausted)</span>
                </Label>
                <Slider
                    min={1} max={10} step={1}
                    value={[fatigueVal]}
                    onValueChange={([v]) => setValue('fatigue', v)}
                    className="mt-1"
                />
            </div>

            <Button
                type="submit"
                disabled={isSubmitting || isLoading}
                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold h-10 rounded-lg shadow-lg shadow-violet-900/30"
            >
                {(isSubmitting || isLoading) ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Logging…</>
                ) : (
                    <><CheckCircle className="w-4 h-4 mr-2" />Log Vitals</>
                )}
            </Button>
        </form>
    );
}
