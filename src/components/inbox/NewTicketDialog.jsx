import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Paperclip, X, CheckCircle2 } from 'lucide-react';

export default function NewTicketDialog({ open, onOpenChange, userEmail }) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const queryClient = useQueryClient();

  const generateTicketNumber = () => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `TICKET-${timestamp}-${random}`;
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      let fileUrls = [];
      
      if (files.length > 0) {
        setUploading(true);
        for (const file of files) {
          const { data } = await base44.integrations.Core.UploadFile({ file });
          fileUrls.push(data.file_url);
        }
        setUploading(false);
      }

      const ticketNumber = generateTicketNumber();
      const subjectWithTicket = `[${ticketNumber}] ${subject}`;

      const currentUser = await base44.auth.me();
      const emailToUse = currentUser.role === 'admin' ? 'info@silverbackhw.com' : (userEmail || currentUser.email);

      // Use backend function to create message with proper permissions
      const response = await base44.functions.invoke('createMessage', {
        customer_email: emailToUse,
        subject: subjectWithTicket,
        message_body: message,
        file_urls: fileUrls
      });

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      return ticketNumber;
    },
    onSuccess: () => {
      setSuccess(true);
      queryClient.invalidateQueries(['messages']);
      setTimeout(() => {
        setSuccess(false);
        setSubject('');
        setMessage('');
        setFiles([]);
        onOpenChange(false);
      }, 2000);
    },
    onError: (error) => {
      console.error('Error submitting ticket:', error);
      alert(`Error submitting ticket: ${error.message}`);
    }
  });

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    const validFiles = selectedFiles.filter(file => file.size <= 10 * 1024 * 1024);
    
    if (validFiles.length !== selectedFiles.length) {
      alert('Some files were too large (max 10MB)');
    }
    
    setFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  if (success) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <div className="py-8 text-center">
            <div className="p-4 bg-emerald-100 rounded-full w-fit mx-auto mb-4">
              <CheckCircle2 className="h-12 w-12 text-emerald-600" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Ticket Created!</h3>
            <p className="text-slate-600">Your support ticket has been submitted successfully.</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Open a New Ticket</DialogTitle>
          <DialogDescription>
            Submit a new support ticket. We'll respond as soon as possible.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="subject">Subject *</Label>
            <Input
              id="subject"
              placeholder="Brief description of your issue"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message *</Label>
            <Textarea
              id="message"
              placeholder="Please describe your issue in detail..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Attachments (optional)</Label>
            <div className="space-y-2">
              {files.map((file, index) => (
                <div key={index} className="flex items-center justify-between bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <div className="flex items-center gap-2">
                    <Paperclip className="h-4 w-4 text-slate-500" />
                    <span className="text-sm text-slate-700">{file.name}</span>
                    <span className="text-xs text-slate-500">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFile(index)}
                    className="h-8 w-8"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('file-upload').click()}
                className="w-full"
              >
                <Paperclip className="h-4 w-4 mr-2" />
                Attach Files
              </Button>
              <input
                id="file-upload"
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <p className="text-xs text-slate-500">Maximum file size: 10MB per file</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitMutation.isPending || uploading}
          >
            Cancel
          </Button>
          <Button
            onClick={() => submitMutation.mutate()}
            disabled={!subject || !message || submitMutation.isPending || uploading}
            className="bg-slate-900 hover:bg-slate-800"
          >
            {submitMutation.isPending || uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {uploading ? 'Uploading...' : 'Submitting...'}
              </>
            ) : (
              'Submit Ticket'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}