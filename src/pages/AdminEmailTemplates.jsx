import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, Plus, Edit2, Save, X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export default function AdminEmailTemplates() {
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [formData, setFormData] = useState({
    template_name: '',
    subject: '',
    body: '',
    description: '',
    available_variables: ''
  });

  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['email-templates'],
    queryFn: () => base44.entities.EmailTemplate.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.EmailTemplate.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['email-templates']);
      setEditingTemplate(null);
      setFormData({
        template_name: '',
        subject: '',
        body: '',
        description: '',
        available_variables: ''
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.EmailTemplate.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['email-templates']);
      setEditingTemplate(null);
    }
  });

  const handleEdit = (template) => {
    setEditingTemplate(template.id);
    setFormData({
      template_name: template.template_name,
      subject: template.subject,
      body: template.body,
      description: template.description || '',
      available_variables: template.available_variables || ''
    });
  };

  const handleSave = () => {
    if (editingTemplate === 'new') {
      createMutation.mutate(formData);
    } else {
      updateMutation.mutate({ id: editingTemplate, data: formData });
    }
  };

  const handleCancel = () => {
    setEditingTemplate(null);
    setFormData({
      template_name: '',
      subject: '',
      body: '',
      description: '',
      available_variables: ''
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-6">
        <div className="max-w-6xl mx-auto">
          <p className="text-slate-600">Loading templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-900 rounded-lg">
              <Mail className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Email Templates</h1>
              <p className="text-sm text-slate-500">Manage automated email content</p>
            </div>
          </div>
          <Button
            onClick={() => {
              setEditingTemplate('new');
              setFormData({
                template_name: '',
                subject: '',
                body: '',
                description: '',
                available_variables: ''
              });
            }}
            className="bg-slate-900 hover:bg-slate-800"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Button>
        </div>

        {/* Edit Form */}
        {editingTemplate && (
          <Card className="border-2 border-blue-200 shadow-lg">
            <CardHeader>
              <CardTitle>{editingTemplate === 'new' ? 'New Template' : 'Edit Template'}</CardTitle>
              <CardDescription>Configure email subject and body content</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Template Name (Identifier)</Label>
                <Input
                  value={formData.template_name}
                  onChange={(e) => setFormData({...formData, template_name: e.target.value})}
                  placeholder="e.g., welcome_email"
                  disabled={editingTemplate !== 'new'}
                />
                <p className="text-xs text-slate-500">Unique identifier used in code</p>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="What this email is used for"
                />
              </div>

              <div className="space-y-2">
                <Label>Available Variables</Label>
                <Input
                  value={formData.available_variables}
                  onChange={(e) => setFormData({...formData, available_variables: e.target.value})}
                  placeholder="e.g., {{name}}, {{email}}, {{password}}"
                />
                <p className="text-xs text-slate-500">Variables that can be used in subject and body</p>
              </div>

              <div className="space-y-2">
                <Label>Subject</Label>
                <Input
                  value={formData.subject}
                  onChange={(e) => setFormData({...formData, subject: e.target.value})}
                  placeholder="Email subject line"
                />
              </div>

              <div className="space-y-2">
                <Label>Body (HTML supported)</Label>
                <Textarea
                  value={formData.body}
                  onChange={(e) => setFormData({...formData, body: e.target.value})}
                  placeholder="Email body content..."
                  className="min-h-[300px] font-mono text-sm"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={handleSave} className="bg-slate-900 hover:bg-slate-800">
                  <Save className="h-4 w-4 mr-2" />
                  Save Template
                </Button>
                <Button onClick={handleCancel} variant="outline">
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Templates List */}
        <div className="grid gap-4">
          {templates.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Mail className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600">No email templates yet</p>
                <p className="text-sm text-slate-500">Click "New Template" to create one</p>
              </CardContent>
            </Card>
          ) : (
            templates.map((template) => (
              <Card key={template.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-slate-900">{template.template_name}</h3>
                        <Badge variant="outline">{template.template_name}</Badge>
                      </div>
                      {template.description && (
                        <p className="text-sm text-slate-600 mb-2">{template.description}</p>
                      )}
                      {template.available_variables && (
                        <p className="text-xs text-slate-500">
                          <strong>Variables:</strong> {template.available_variables}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(template)}
                    >
                      <Edit2 className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  </div>

                  <div className="space-y-3 bg-slate-50 rounded-lg p-4">
                    <div>
                      <p className="text-xs font-semibold text-slate-500 mb-1">SUBJECT</p>
                      <p className="text-sm text-slate-900">{template.subject}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 mb-1">BODY PREVIEW</p>
                      <div className="text-sm text-slate-700 max-h-32 overflow-y-auto bg-white rounded p-2 border border-slate-200">
                        {template.body.substring(0, 200)}...
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}