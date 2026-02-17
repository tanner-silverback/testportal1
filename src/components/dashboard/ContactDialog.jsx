import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload, X, CheckCircle2 } from 'lucide-react';

export default function ContactDialog({ open, onOpenChange }) {
  const [formData, setFormData] = useState({ email: '', subject: '', message: '' });
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);
    const maxSize = 500 * 1024 * 1024; // 500MB

    if (totalSize > maxSize) {
      setError('Total file size cannot exceed 500MB');
      return;
    }

    setFiles(selectedFiles);
    setError('');
  };

  const removeFile = (index) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSending(true);

    try {
      let file_urls = [];

      // Upload files if any
      if (files.length > 0) {
        setUploading(true);
        for (const file of files) {
          const { data } = await base44.integrations.Core.UploadFile({ file });
          file_urls.push(data.file_url);
        }
        setUploading(false);
      }

      // Submit contact form
      const { data } = await base44.functions.invoke('submitContactForm', {
        email: formData.email,
        subject: formData.subject,
        message: formData.message,
        file_urls
      });

      if (data.success) {
        setSuccess(true);
        setTimeout(() => {
          onOpenChange(false);
          setSuccess(false);
          setFormData({ email: '', subject: '', message: '' });
          setFiles([]);
        }, 2000);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send message');
    } finally {
      setSending(false);
      setUploading(false);
    }
  };

  if (success) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="py-8 text-center">
            <div className="p-4 bg-emerald-100 rounded-full w-fit mx-auto mb-4">
              <CheckCircle2 className="h-12 w-12 text-emerald-600" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">Message Sent!</h3>
            <p className="text-slate-600">We'll get back to you as soon as possible.</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Contact SilverBack Home Warranty</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Your Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              placeholder="your.email@example.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject *</Label>
            <Input
              id="subject"
              value={formData.subject}
              onChange={(e) => setFormData({...formData, subject: e.target.value})}
              placeholder="What can we help you with?"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message *</Label>
            <Textarea
              id="message"
              value={formData.message}
              onChange={(e) => setFormData({...formData, message: e.target.value})}
              placeholder="Tell us more about your request..."
              rows={6}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="files">Attachments (Max 500MB total)</Label>
            <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors">
              <input
                id="files"
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="files" className="cursor-pointer flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-slate-400" />
                <p className="text-sm text-slate-600">Click to upload files</p>
                <p className="text-xs text-slate-500">Images, documents, videos - up to 500MB</p>
              </label>
            </div>

            {files.length > 0 && (
              <div className="space-y-2 mt-3">
                {files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">{file.name}</p>
                      <p className="text-xs text-slate-500">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFile(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="text-center pt-4 border-t">
            <p className="text-sm text-slate-600">
              Don't want to email? Call us at <a href="tel:8016868927" className="font-semibold text-slate-900 hover:text-slate-700 underline">(801)686-8927</a>
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="bg-slate-900 hover:bg-slate-800"
              disabled={sending || uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading Files...
                </>
              ) : sending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Message'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}