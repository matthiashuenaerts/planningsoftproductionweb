import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

export interface DuplicateProduct {
  name: string;
  article_code: string | null;
  existingPrice: number | null;
  newPrice: number | null;
}

interface CsvDuplicateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicates: DuplicateProduct[];
  onIgnore: () => void;
  onUpdatePrices: () => void;
}

export const CsvDuplicateDialog: React.FC<CsvDuplicateDialogProps> = ({
  open,
  onOpenChange,
  duplicates,
  onIgnore,
  onUpdatePrices,
}) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Duplicate Articles Found</AlertDialogTitle>
          <AlertDialogDescription>
            {duplicates.length} article(s) from the CSV already exist in the database. 
            What would you like to do with these duplicates?
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <ScrollArea className="max-h-60 border rounded-md p-2">
          <div className="space-y-2">
            {duplicates.slice(0, 10).map((dup, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{dup.name}</p>
                  <p className="text-muted-foreground text-xs">{dup.article_code || 'No article code'}</p>
                </div>
                <div className="flex gap-2 ml-2">
                  <Badge variant="outline" className="text-xs">
                    Old: €{dup.existingPrice?.toFixed(2) ?? '0.00'}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    New: €{dup.newPrice?.toFixed(2) ?? '0.00'}
                  </Badge>
                </div>
              </div>
            ))}
            {duplicates.length > 10 && (
              <p className="text-muted-foreground text-xs text-center py-2">
                ...and {duplicates.length - 10} more
              </p>
            )}
          </div>
        </ScrollArea>

        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel onClick={() => onOpenChange(false)}>
            Cancel Import
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onIgnore}
            className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
          >
            Ignore Duplicates
          </AlertDialogAction>
          <AlertDialogAction onClick={onUpdatePrices}>
            Update Prices
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
