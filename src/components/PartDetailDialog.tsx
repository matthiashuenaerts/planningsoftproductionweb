import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Part } from "@/services/partsListService";
import { QRCodeSVG } from "qrcode.react";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";
import { Ruler, Layers, Hash, Box, Scan } from "lucide-react";

interface PartDetailDialogProps {
  part: Part | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PartDetailDialog({ part, open, onOpenChange }: PartDetailDialogProps) {
  const isMobile = useIsMobile();

  if (!part) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'green':
        return <Badge className="bg-emerald-500 text-[10px] h-5">Complete</Badge>;
      case 'orange':
        return <Badge className="bg-orange-500 text-[10px] h-5">In Progress</Badge>;
      case 'red':
        return <Badge className="bg-red-500 text-[10px] h-5">Issues</Badge>;
      default:
        return <Badge variant="secondary" className="text-[10px] h-5">Unprocessed</Badge>;
    }
  };

  const pathFields = [
    { label: 'CNC PRG 1', value: part.cncprg1 },
    { label: 'CNC PRG 2', value: part.cncprg2 },
    { label: 'Afbeelding', value: part.afbeelding },
  ].filter(field => field.value);

  const edgeBanding = [
    { label: 'Boven', value: part.afplak_boven },
    { label: 'Onder', value: part.afplak_onder },
    { label: 'Links', value: part.afplak_links },
    { label: 'Rechts', value: part.afplak_rechts },
  ].filter(f => f.value);

  const content = (
    <div className="space-y-4">
      {/* Main info card */}
      <div className="rounded-lg bg-muted/40 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{part.wand_naam || 'Unnamed Part'}</h3>
          {getStatusBadge(part.color_status)}
        </div>
        {part.materiaal && (
          <p className="text-xs text-muted-foreground font-mono">{part.materiaal}</p>
        )}
      </div>

      {/* Dimensions grid */}
      <div className="grid grid-cols-3 gap-2">
        <DimensionCard icon={<Ruler className="h-3 w-3" />} label="Lengte" value={part.lengte} />
        <DimensionCard icon={<Ruler className="h-3 w-3 rotate-90" />} label="Breedte" value={part.breedte} />
        <DimensionCard icon={<Layers className="h-3 w-3" />} label="Dikte" value={part.dikte} />
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-2">
        {part.aantal && <InfoChip label="Aantal" value={part.aantal.toString()} />}
        {part.nerf && <InfoChip label="Nerf" value={part.nerf} />}
        {part.doorlopende_nerf && <InfoChip label="Doorl. Nerf" value={part.doorlopende_nerf} />}
        {part.cnc_pos && <InfoChip label="CNC Pos" value={part.cnc_pos} />}
        {part.workstation_name_status && <InfoChip label="Workstation" value={part.workstation_name_status} />}
      </div>

      {/* ABD path */}
      {part.abd && (
        <div className="rounded-lg bg-muted/40 p-2.5">
          <span className="text-[11px] font-medium text-muted-foreground">ABD</span>
          <p className="text-xs font-mono break-all mt-0.5">{part.abd}</p>
        </div>
      )}

      {/* Edge banding */}
      {edgeBanding.length > 0 && (
        <div>
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Afplakband</span>
          <div className="grid grid-cols-2 gap-1.5 mt-1.5">
            {edgeBanding.map((edge, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg bg-muted/30 px-2.5 py-1.5">
                <span className="text-[11px] text-muted-foreground w-10 flex-shrink-0">{edge.label}</span>
                <span className="text-xs font-mono truncate">{edge.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* QR Codes */}
      {pathFields.length > 0 && (
        <div className="pt-2 border-t border-border/50">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">QR Codes</span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
            {pathFields.map((field, index) => (
              <div key={index} className="flex flex-col items-center p-3 bg-white rounded-lg border border-border/40 shadow-sm">
                <QRCodeSVG value={field.value!} size={isMobile ? 90 : 110} level="M" includeMargin />
                <p className="text-[11px] font-medium mt-1.5">{field.label}</p>
                <p className="text-[10px] text-muted-foreground text-center break-all max-w-[120px]" title={field.value!}>
                  {field.value!.length > 25 ? `...${field.value!.slice(-22)}` : field.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comments */}
      {(part.commentaar || part.commentaar_2) && (
        <div className="pt-2 border-t border-border/50 space-y-2">
          {part.commentaar && (
            <div className="rounded-lg bg-muted/30 p-2.5">
              <span className="text-[11px] font-medium text-muted-foreground">Commentaar</span>
              <p className="text-sm mt-0.5">{part.commentaar}</p>
            </div>
          )}
          {part.commentaar_2 && (
            <div className="rounded-lg bg-muted/30 p-2.5">
              <span className="text-[11px] font-medium text-muted-foreground">Commentaar 2</span>
              <p className="text-sm mt-0.5">{part.commentaar_2}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[92vh] overflow-y-auto px-4 pb-6">
          <SheetHeader className="mb-3">
            <SheetTitle className="text-sm flex items-center gap-2">
              <Box className="h-4 w-4" />
              Part Details
            </SheetTitle>
          </SheetHeader>
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center gap-2">
            Part Details
          </DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}

function DimensionCard({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  if (!value) return <div className="rounded-lg bg-muted/20 p-2.5 text-center text-xs text-muted-foreground">{label}: -</div>;
  return (
    <div className="rounded-lg bg-muted/40 p-2.5 text-center">
      <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">{icon}<span className="text-[10px]">{label}</span></div>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-muted/30 px-2.5 py-1.5">
      <span className="text-[11px] text-muted-foreground flex-shrink-0">{label}</span>
      <span className="text-xs font-medium truncate">{value}</span>
    </div>
  );
}
