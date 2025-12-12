import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Part } from "@/services/partsListService";
import { QRCodeSVG } from "qrcode.react";
import { Badge } from "@/components/ui/badge";

interface PartDetailDialogProps {
  part: Part | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PartDetailDialog({ part, open, onOpenChange }: PartDetailDialogProps) {
  if (!part) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'green':
        return <Badge className="bg-green-500">Complete</Badge>;
      case 'orange':
        return <Badge className="bg-orange-500">In Progress</Badge>;
      case 'red':
        return <Badge className="bg-red-500">Issues</Badge>;
      default:
        return <Badge variant="secondary">Unprocessed</Badge>;
    }
  };

  // Collect all path fields that have values
  const pathFields = [
    { label: 'CNC PRG 1', value: part.cncprg1 },
    { label: 'CNC PRG 2', value: part.cncprg2 },
    { label: 'Afbeelding', value: part.afbeelding },
  ].filter(field => field.value);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            Part Details
            {getStatusBadge(part.color_status)}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          {/* Part Information */}
          <div className="space-y-3">
            <DetailRow label="Wand Naam" value={part.wand_naam} />
            <DetailRow label="Materiaal" value={part.materiaal} />
            <DetailRow label="Dikte" value={part.dikte} />
            <DetailRow label="Lengte" value={part.lengte} />
            <DetailRow label="Breedte" value={part.breedte} />
            <DetailRow label="Aantal" value={part.aantal?.toString()} />
            <DetailRow label="Nerf" value={part.nerf} />
            <DetailRow label="Doorlopende Nerf" value={part.doorlopende_nerf} />
          </div>

          {/* Additional Details */}
          <div className="space-y-3">
            <DetailRow label="CNC Pos" value={part.cnc_pos} />
            <DetailRow label="ABD" value={part.abd} />
            <DetailRow label="Workstation Status" value={part.workstation_name_status} />
            <DetailRow label="Afplak Boven" value={part.afplak_boven} />
            <DetailRow label="Afplak Onder" value={part.afplak_onder} />
            <DetailRow label="Afplak Links" value={part.afplak_links} />
            <DetailRow label="Afplak Rechts" value={part.afplak_rechts} />
          </div>
        </div>

        {/* QR Codes for Paths */}
        {pathFields.length > 0 && (
          <div className="mt-6 pt-4 border-t">
            <h4 className="text-sm font-medium text-muted-foreground mb-4">File Paths (QR Codes)</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {pathFields.map((field, index) => (
                <div key={index} className="flex flex-col items-center p-4 bg-white rounded-lg border">
                  <QRCodeSVG 
                    value={field.value!} 
                    size={120}
                    level="M"
                    includeMargin
                  />
                  <p className="text-xs font-medium mt-2">{field.label}</p>
                  <p className="text-xs text-muted-foreground text-center break-all max-w-[140px]" title={field.value!}>
                    {field.value!.length > 30 ? `...${field.value!.slice(-27)}` : field.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Comments */}
        {(part.commentaar || part.commentaar_2) && (
          <div className="mt-4 pt-4 border-t space-y-3">
            {part.commentaar && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">Commentaar:</span>
                <p className="mt-1">{part.commentaar}</p>
              </div>
            )}
            {part.commentaar_2 && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">Commentaar 2:</span>
                <p className="mt-1">{part.commentaar_2}</p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  
  return (
    <div>
      <span className="text-sm font-medium text-muted-foreground">{label}:</span>
      <span className="ml-2">{value}</span>
    </div>
  );
}
