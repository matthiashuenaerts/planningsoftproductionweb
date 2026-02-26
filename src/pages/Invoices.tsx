import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useTenant } from '@/context/TenantContext';
import { useLanguage } from '@/context/LanguageContext';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Download } from 'lucide-react';
import { format } from 'date-fns';
import { useSignedUrl } from '@/hooks/useSignedUrl';

const statusColors: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-700',
};

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const InvoiceRow: React.FC<{ invoice: any }> = ({ invoice }) => {
  const signedUrl = useSignedUrl('invoices', invoice.pdf_path);

  const handleDownload = () => {
    if (signedUrl) {
      window.open(signedUrl, '_blank');
    }
  };

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/30 transition-colors">
      <div className="flex items-center gap-3">
        <FileText className="h-5 w-5 text-muted-foreground" />
        <div>
          <p className="font-medium text-sm">
            {monthNames[invoice.month - 1]} {invoice.year}
          </p>
          {invoice.amount && (
            <p className="text-xs text-muted-foreground">€{Number(invoice.amount).toFixed(2)}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {invoice.payment_deadline && (
          <span className="text-xs text-muted-foreground">
            Due: {format(new Date(invoice.payment_deadline), 'dd/MM/yyyy')}
          </span>
        )}
        <Badge variant="outline" className={statusColors[invoice.status] || ''}>
          {invoice.status}
        </Badge>
        {invoice.pdf_path && (
          <Button variant="ghost" size="sm" onClick={handleDownload} disabled={!signedUrl}>
            <Download className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};

const Invoices: React.FC = () => {
  const { currentEmployee } = useAuth();
  const { tenant } = useTenant();
  const { t } = useLanguage();

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
      <main className="flex-1 ml-0 md:ml-64 p-6">
        <h1 className="text-2xl font-bold mb-6">Invoices</h1>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Billing History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : !invoices?.length ? (
              <p className="text-muted-foreground text-center py-8">No invoices yet</p>
            ) : (
              <div className="space-y-2">
                {invoices.map((inv: any) => (
                  <InvoiceRow key={inv.id} invoice={inv} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Invoices;
