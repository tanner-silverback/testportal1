import React, { useMemo } from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";

export default function CoverageCheckerDialog({ open, onOpenChange, policies = [], claims = [] }) {
  const coverageUrl = 'https://claims-checker.silverbackhw.com/';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] p-0 gap-0">
        <iframe
          src={coverageUrl}
          className="w-full h-full border-0 rounded-lg"
          title="Coverage Checker"
        />
      </DialogContent>
    </Dialog>
  );
}