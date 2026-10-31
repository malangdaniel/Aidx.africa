import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload, FileText, ExternalLink, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  PharmacyOnboardingService, DOC_LABELS, IMAGE_ONLY_DOCS,
  type DocType, type PharmacyDocumentRow, errMsg } from '@/services/PharmacyOnboardingService';

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
};

interface Props {
  docType: DocType;
  doc?: PharmacyDocumentRow;
  pharmacyId: string;
  userId: string;
  disabled?: boolean;
  required?: boolean;
  onChanged: () => void;
}

export default function DocumentUploader({ docType, doc, pharmacyId, userId, disabled, required, onChanged }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const imageOnly = IMAGE_ONLY_DOCS.includes(docType);

  const pick = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      await PharmacyOnboardingService.uploadDocument({ pharmacyId, userId, docType, file });
      toast.success(`${DOC_LABELS[docType]} uploaded`);
      onChanged();
    } catch (e) {
      toast.error(errMsg(e, 'Upload failed'));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const view = async () => {
    if (!doc) return;
    const url = await PharmacyOnboardingService.signedUrl(doc.storage_path);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    else toast.error('Could not open this file.');
  };

  const remove = async () => {
    if (!doc) return;
    setBusy(true);
    try {
      await PharmacyOnboardingService.deleteDocument(doc);
      onChanged();
    } catch (e) {
      toast.error(errMsg(e, 'Could not remove file'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">
            {DOC_LABELS[docType]} {required && <span className="text-destructive">*</span>}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {imageOnly ? 'JPG, PNG or WEBP' : 'PDF or image'} · max 5MB
          </p>
        </div>
        {doc && (
          <Badge variant="outline" className={`capitalize ${STATUS_STYLE[doc.status] ?? ''}`}>
            {doc.status}
          </Badge>
        )}
      </div>

      {doc?.status === 'rejected' && doc.review_note && (
        <p className="text-xs text-destructive bg-destructive/10 rounded p-2">Rejected: {doc.review_note}</p>
      )}

      {doc && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <FileText className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{doc.file_name ?? 'Uploaded file'}</span>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={imageOnly ? 'image/jpeg,image/png,image/webp' : 'application/pdf,image/jpeg,image/png,image/webp'}
        onChange={(e) => pick(e.target.files?.[0])}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={disabled || busy} onClick={() => inputRef.current?.click()} className="gap-1.5 text-xs">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {doc ? 'Replace' : 'Upload'}
        </Button>
        {doc && (
          <Button type="button" size="sm" variant="ghost" onClick={view} className="gap-1.5 text-xs">
            <ExternalLink className="w-3.5 h-3.5" /> View
          </Button>
        )}
        {doc && doc.status !== 'approved' && !disabled && (
          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={remove} className="gap-1.5 text-xs text-destructive">
            <Trash2 className="w-3.5 h-3.5" /> Remove
          </Button>
        )}
      </div>
    </div>
  );
}
