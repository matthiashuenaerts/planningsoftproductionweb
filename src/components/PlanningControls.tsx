
import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Wand2 } from 'lucide-react';

interface PlanningControlsProps {
  selectedDate: Date;
  onGeneratePlan: () => Promise<void>;
  isGenerating: boolean;
}

const PlanningControls: React.FC<PlanningControlsProps> = ({
  selectedDate,
  onGeneratePlan,
  isGenerating
}) => {
  return (
    <div className="flex items-center">
      <Button
        onClick={onGeneratePlan}
        disabled={isGenerating}
        variant="default"
        className="whitespace-nowrap"
      >
        {isGenerating ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Wand2 className="mr-2 h-4 w-4" />
            Generate Weekly Plan
          </>
        )}
      </Button>
    </div>
  );
};

export default PlanningControls;
