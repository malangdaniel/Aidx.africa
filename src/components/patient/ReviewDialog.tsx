import { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Star, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ReviewDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    revieweeId: string;
    doctorName: string;
    consultationId?: string;
    onSubmitted?: () => void;
}

export default function ReviewDialog({
    open,
    onOpenChange,
    revieweeId,
    doctorName,
    consultationId,
    onSubmitted,
}: ReviewDialogProps) {
    const [rating, setRating] = useState(0);
    const [hover, setHover] = useState(0);
    const [comment, setComment] = useState('');
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(false);
    const [existingId, setExistingId] = useState<string | null>(null);

    useEffect(() => {
        const loadExisting = async () => {
            if (!open) return;
            setLoading(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                let query = supabase
                    .from('reviews')
                    .select('id, rating, comment')
                    .eq('reviewer_id', user.id)
                    .eq('reviewee_id', revieweeId);

                query = consultationId
                    ? query.eq('consultation_id', consultationId)
                    : query.is('consultation_id', null);

                const { data } = await query.maybeSingle();

                if (data) {
                    setExistingId(data.id);
                    setRating(data.rating || 0);
                    setComment(data.comment || '');
                } else {
                    setExistingId(null);
                    setRating(0);
                    setComment('');
                }
            } finally {
                setLoading(false);
            }
        };
        loadExisting();
    }, [open, revieweeId, consultationId]);

    const handleSubmit = async () => {
        if (rating < 1) {
            toast.error('Please select a star rating.');
            return;
        }
        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('You must be signed in to leave a review.');

            if (existingId) {
                const { error } = await supabase
                    .from('reviews')
                    .update({ rating, comment: comment.trim() || null })
                    .eq('id', existingId);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('reviews').insert({
                    reviewer_id: user.id,
                    reviewee_id: revieweeId,
                    consultation_id: consultationId ?? null,
                    rating,
                    comment: comment.trim() || null,
                });
                if (error) throw error;
            }

            toast.success(existingId ? 'Review updated' : 'Thanks for your review!');
            onOpenChange(false);
            onSubmitted?.();
        } catch (e: any) {
            console.error('Review error:', e);
            const isPermissionError =
                e?.code === '42501' ||
                e?.message?.toLowerCase?.().includes('policy') ||
                e?.message?.toLowerCase?.().includes('permission') ||
                e?.message?.toLowerCase?.().includes('consulted');
            if (isPermissionError) {
                toast.error('You can only review a doctor you have consulted');
            } else {
                toast.error(e?.message || 'Failed to save review.');
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-[420px]">
                <DialogHeader>
                    <DialogTitle>{existingId ? 'Edit your review' : 'Write a review'}</DialogTitle>
                    <DialogDescription>Share your experience with {doctorName}.</DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    </div>
                ) : (
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Rating</Label>
                            <div className="flex gap-1">
                                {[1, 2, 3, 4, 5].map((value) => (
                                    <button
                                        key={value}
                                        type="button"
                                        aria-label={`Rate ${value} star${value > 1 ? 's' : ''}`}
                                        onMouseEnter={() => setHover(value)}
                                        onMouseLeave={() => setHover(0)}
                                        onClick={() => setRating(value)}
                                        className="p-1"
                                    >
                                        <Star
                                            className={`w-7 h-7 transition-colors ${(hover || rating) >= value
                                                ? 'fill-amber-500 text-amber-500'
                                                : 'text-muted-foreground/40'
                                                }`}
                                        />
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="review-comment">Your review (optional)</Label>
                            <Textarea
                                id="review-comment"
                                rows={4}
                                placeholder="How was your consultation?"
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                maxLength={1000}
                            />
                        </div>
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={saving || loading} className="flex-1 gap-2">
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                        {existingId ? 'Update review' : 'Submit review'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
