import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload, FileText, ExternalLink, Trash2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  DoctorOnboardingService,
  DOCTOR_DOC_LABELS,
  type DoctorDocType,
  type DoctorUploadedDoc,
} from '@/services/DoctorOnboardingService';

interface DoctorDocumentUploaderProps {
  docType: DoctorDocType;
  doc?: DoctorUploadedDoc;
  userId: string;
  disabled?: boolean;
  required?: boolean;
  currentDocs: DoctorUploadedDoc[];
  onDocUpdated: (updatedDocs: DoctorUploadedDoc[]) => void;
}

export function DoctorDocumentUploader({
  docType,
  doc,
  userId,
  disabled,
  required,
  currentDocs,
  onDocUpdated,
}: DoctorDocumentUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handlePick = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const newDoc = await DoctorOnboardingService.uploadDocument({
        userId,
        docType,
        file,
        currentDocs,
      });
      const updated = [...currentDocs.filter((d) => d.docType !== docType), newDoc];
      onDocUpdated(updated);
      toast.success(`${DOCTOR_DOC_LABELS[docType]} uploaded successfully`);
    } catch (e: any) {
      toast.error(e.message || 'Document upload failed');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleView = async () => {
    if (!doc) return;
    try {
      const url = await DoctorOnboardingService.getSignedUrl(doc.storagePath);
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        toast.error('Could not generate document preview URL.');
      }
    } catch (e: any) {
      toast.error('Failed to open document: ' + e.message);
    }
  };

  const handleRemove = async () => {
    if (!doc) return;
    setBusy(true);
    try {
      const updated = await DoctorOnboardingService.deleteDocument({
        userId,
        docType,
        storagePath: doc.storagePath,
        currentDocs,
      });
      onDocUpdated(updated);
      toast.success('Document removed');
    } catch (e: any) {
      toast.error(e.message || 'Could not remove document');
    } finally {
      setBusy(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3 transition-colors hover:border-border/80">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">
              {DOCTOR_DOC_LABELS[docType]}
            </p>
            {required && (
              <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30 bg-destructive/5 font-medium px-1.5 py-0">
                Required
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Clear scan or photo · PDF, JPG, PNG or WEBP · Max 5MB
          </p>
        </div>

        {doc && (
          <Badge className="bg-emerald-600/10 text-emerald-700 border-emerald-500/20 gap-1 text-[11px] shrink-0">
            <CheckCircle2 className="w-3 h-3" />
            Uploaded
          </Badge>
        )}
      </div>

      {doc && (
        <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-muted/40 border border-muted text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="font-medium truncate text-foreground">{doc.fileName}</p>
              {doc.sizeBytes > 0 && (
                <p className="text-[10px] text-muted-foreground">{formatSize(doc.sizeBytes)}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleView}
              className="h-7 text-xs gap-1 px-2 hover:bg-muted"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View
            </Button>
            {!disabled && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemove}
                disabled={busy}
                className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 px-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      )}

      {!disabled && (
        <div>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            onChange={(e) => handlePick(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant={doc ? 'outline' : 'default'}
            size="sm"
            disabled={busy || disabled}
            onClick={() => inputRef.current?.click()}
            className="w-full sm:w-auto text-xs gap-1.5"
          >
            {busy ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            {doc ? 'Replace Document' : `Upload ${docType === 'medical_license' ? 'License' : docType === 'government_id' ? 'ID Card' : 'Certificate'}`}
          </Button>
        </div>
      )}
    </div>
  );
}

