import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Circle, Loader2 } from 'lucide-react';

interface ProgressStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'error';
}

interface ScheduleGenerationProgressProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  currentStep: string;
  steps: ProgressStep[];
  progress: number;
  currentWorker?: string;
  totalWorkers?: number;
  processedWorkers?: number;
}

export const ScheduleGenerationProgress: React.FC<ScheduleGenerationProgressProps> = ({
  isOpen,
  onOpenChange,
  currentStep,
  steps,
  progress,
  currentWorker,
  totalWorkers,
  processedWorkers
}) => {
  const getStepIcon = (status: ProgressStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'running':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'error':
        return <Circle className="w-5 h-5 text-red-500" />;
      default:
        return <Circle className="w-5 h-5 text-gray-300" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Generating Schedule</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Overall Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Overall Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>

          {/* Worker Progress */}
          {totalWorkers && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Workers Processed</span>
                <span>{processedWorkers || 0}/{totalWorkers}</span>
              </div>
              {currentWorker && (
                <div className="text-sm text-muted-foreground">
                  Currently processing: {currentWorker}
                </div>
              )}
            </div>
          )}

          {/* Steps */}
          <div className="space-y-3">
            {steps.map((step) => (
              <div key={step.id} className="flex items-start space-x-3">
                {getStepIcon(step.status)}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{step.title}</div>
                  <div className="text-xs text-muted-foreground">{step.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};