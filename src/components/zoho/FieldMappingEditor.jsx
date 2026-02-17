import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Save, RefreshCw } from 'lucide-react';

const APP_FIELDS = {
  Policy: [
    'policy_id',
    'policy_number',
    'policy_name',
    'details_of_coverage',
    'policy_status',
    'effective_date',
    'expiration_date',
    'customer_name',
    'customer_email',
    'property_address'
  ],
  Claim: [
    'claim_name',
    'policy_id',
    'customer_email',
    'claim_type',
    'claim_status',
    'contractor',
    'contractor_email',
    'property_address',
    'customer_facing_description',
    'claim_date'
  ]
};

export default function FieldMappingEditor({ moduleType }) {
  const [zohoFields, setZohoFields] = useState([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [newMapping, setNewMapping] = useState({ app_field: '', zoho_field: '' });
  const queryClient = useQueryClient();

  const moduleName = moduleType === 'Policy' ? 'Policies' : 'Claims';

  const { data: mappings = [], isLoading } = useQuery({
    queryKey: ['zoho-mappings', moduleType],
    queryFn: () => base44.entities.ZohoFieldMapping.filter({ module_type: moduleType }),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ZohoFieldMapping.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zoho-mappings', moduleType] });
      setNewMapping({ app_field: '', zoho_field: '' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ZohoFieldMapping.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['zoho-mappings', moduleType] });
    },
  });

  const fetchZohoFields = async () => {
    try {
      setLoadingFields(true);
      const { data } = await base44.functions.invoke('zohoGetFields', { module: moduleName });
      if (data.availableFields) {
        setZohoFields(data.availableFields);
      }
    } catch (err) {
      console.error('Failed to fetch Zoho fields:', err);
    } finally {
      setLoadingFields(false);
    }
  };

  useEffect(() => {
    fetchZohoFields();
  }, [moduleType]);

  const handleAddMapping = () => {
    if (newMapping.app_field && newMapping.zoho_field) {
      createMutation.mutate({
        module_type: moduleType,
        app_field: newMapping.app_field,
        zoho_field: newMapping.zoho_field,
        is_active: true
      });
    }
  };

  const appFieldsInUse = mappings.map(m => m.app_field);
  const availableAppFields = APP_FIELDS[moduleType].filter(f => !appFieldsInUse.includes(f));

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="border-b border-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{moduleType} Field Mapping</CardTitle>
          <Button 
            onClick={fetchZohoFields} 
            variant="outline" 
            size="sm"
            disabled={loadingFields}
          >
            {loadingFields ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
          </div>
        ) : (
          <>
            {/* Existing Mappings */}
            <div className="space-y-2">
              {mappings.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">
                  No field mappings configured yet
                </p>
              ) : (
                mappings.map((mapping) => (
                  <div key={mapping.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <div className="flex-1 grid grid-cols-3 gap-3 items-center">
                      <div>
                        <Badge variant="outline" className="bg-white">
                          {mapping.app_field}
                        </Badge>
                      </div>
                      <div className="text-center text-slate-400 text-sm">→</div>
                      <div>
                        <Badge className="bg-blue-100 text-blue-700">
                          {mapping.zoho_field}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => deleteMutation.mutate(mapping.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>

            {/* Add New Mapping */}
            {availableAppFields.length > 0 && zohoFields.length > 0 && (
              <div className="border-t pt-4 space-y-3">
                <h4 className="text-sm font-medium text-slate-700">Add New Mapping</h4>
                <div className="grid grid-cols-3 gap-3 items-end">
                  <div className="space-y-2">
                    <Label className="text-xs">App Field</Label>
                    <Select
                      value={newMapping.app_field}
                      onValueChange={(value) => setNewMapping({ ...newMapping, app_field: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select field" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableAppFields.map((field) => (
                          <SelectItem key={field} value={field}>
                            {field}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="text-center text-slate-400 text-sm pb-2">→</div>
                  <div className="space-y-2">
                    <Label className="text-xs">Zoho Field</Label>
                    <Select
                      value={newMapping.zoho_field}
                      onValueChange={(value) => setNewMapping({ ...newMapping, zoho_field: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select field" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {zohoFields.map((field) => (
                          <SelectItem key={field} value={field}>
                            {field}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button 
                  onClick={handleAddMapping}
                  disabled={!newMapping.app_field || !newMapping.zoho_field || createMutation.isPending}
                  className="w-full bg-slate-900 hover:bg-slate-800"
                >
                  {createMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Add Mapping
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}