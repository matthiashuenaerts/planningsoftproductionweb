import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useTenant } from '@/context/TenantContext';
import { useLanguage } from '@/context/LanguageContext';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Download, Eye, ExternalLink, X } from 'lucide-react';
import { format } from 'date-fns';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { useIsMobile } from '@/hooks/use-mobile';

const statusColors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-700',
};

const statusTranslationKeys: Record<string, string> = {
  draft: 'inv_status_draft',
  sent: 'inv_status_sent',
  paid: 'inv_status_paid',
  overdue: 'inv_status_overdue',
  cancelled: 'inv_status_cancelled',
};

const monthKeys = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const InvoiceRow: React.FC<{ invoice: any; onPreview: (url: string) => void }> = ({ invoice, onPreview }) => {
  const { t } = useLanguage();
  const signedUrl = useSignedUrl('invoices', invoice.pdf_path);
  const isMobile = useIsMobile();

  const handleDownload = () => {
    if (signedUrl) {
      const a = document.createElement('a');
      a.href = signedUrl;
      a.download = `invoice-${invoice.year}-${String(invoice.month).padStart(2, '0')}.pdf`;
      a.click();
    }
  };

  const handleOpenNewTab = () => {
    if (signedUrl) {
      window.open(signedUrl, '_blank');
    }
  };

  const handlePreview = () => {
    if (signedUrl) {
      onPreview(signedUrl);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg hover:bg-accent/30 transition-colors gap-3">
      <div className="flex items-center gap-3">
        <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
        <div>
          <p className="font-medium text-sm">
            {monthKeys[invoice.month - 1]} {invoice.year}
          </p>
          {invoice.amount && (
            <p className="text-xs text-muted-foreground">€{Number(invoice.amount).toFixed(2)}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {invoice.payment_deadline && (
          <span className="text-xs text-muted-foreground">
            {t('inv_due')}: {format(new Date(invoice.payment_deadline), 'dd/MM/yyyy')}
          </span>
        )}
        <Badge variant="outline" className={statusColors[invoice.status] || ''}>
          {t(statusTranslationKeys[invoice.status] || invoice.status)}
        </Badge>
        {invoice.pdf_path && (
          <div className="flex items-center gap-1">
            {!isMobile && (
              <Button variant="ghost" size="sm" onClick={handlePreview} disabled={!signedUrl} title={t('inv_preview')}>
                <Eye className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleOpenNewTab} disabled={!signedUrl} title={t('inv_open_new_tab')}>
              <ExternalLink className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleDownload} disabled={!signedUrl} title={t('inv_download')}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

const Invoices: React.FC = () => {
  const { currentEmployee } = useAuth();
  const { tenant } = useTenant();
  const { t } = useLanguage();
  const isMobile = useIsMobile();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['invoices', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .order('year', { ascending: false })
        .order('month', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!tenant?.id,
  });

  return (
    <div className="flex min-h-screen bg-background">
      <Navbar />
      <main className={`flex-1 min-w-0 overflow-x-hidden p-4 md:p-6 ${!isMobile ? 'ml-64' : 'pt-16'}`}>
        <h1 className="text-2xl font-bold mb-6">{t('inv_invoices')}</h1>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t('inv_billing_history')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">{t('inv_loading')}</p>
            ) : !invoices?.length ? (
              <p className="text-muted-foreground text-center py-8">{t('inv_no_invoices')}</p>
            ) : (
              <div className="space-y-2">
                {invoices.map((inv: any) => (
                  <InvoiceRow key={inv.id} invoice={inv} onPreview={setPreviewUrl} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* PDF Preview */}
        {previewUrl && (
          <Card className="mt-4">
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-sm">{t('inv_preview')}</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => window.open(previewUrl, '_blank')}>
                  <ExternalLink className="h-4 w-4 mr-1" />
                  {t('inv_open_new_tab')}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setPreviewUrl(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <iframe
                src={previewUrl}
                className="w-full border-0 rounded-b-lg"
                style={{ height: '80vh' }}
                title="Invoice Preview"
              />
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Invoices;
