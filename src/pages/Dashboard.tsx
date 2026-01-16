import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Users, UserPlus, CreditCard, AlertTriangle, TrendingUp, Calendar } from 'lucide-react';

interface DashboardStats {
  totalClients: number;
  activeClients: number;
  pendingProspects: number;
  clientsWithDebt: number;
  monthlyIncome: number;
  recentPayments: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalClients: 0,
    activeClients: 0,
    pendingProspects: 0,
    clientsWithDebt: 0,
    monthlyIncome: 0,
    recentPayments: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { count: totalClients } = await supabase
          .from('clients')
          .select('*', { count: 'exact', head: true });

        const { count: activeClients } = await supabase
          .from('clients')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active');

        const { count: pendingProspects } = await supabase
          .from('prospects')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');

        const { count: clientsWithDebt } = await supabase
          .from('client_billing')
          .select('*', { count: 'exact', head: true })
          .lt('balance', 0);

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

        const { data: monthPayments } = await supabase
          .from('payments')
          .select('amount')
          .gte('payment_date', startOfMonth.split('T')[0])
          .lte('payment_date', endOfMonth.split('T')[0]);

        const monthlyIncome = monthPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { count: recentPayments } = await supabase
          .from('payments')
          .select('*', { count: 'exact', head: true })
          .gte('payment_date', sevenDaysAgo.split('T')[0]);

        setStats({
          totalClients: totalClients || 0,
          activeClients: activeClients || 0,
          pendingProspects: pendingProspects || 0,
          clientsWithDebt: clientsWithDebt || 0,
          monthlyIncome,
          recentPayments: recentPayments || 0,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    {
      title: 'Clientes Totales',
      value: stats.totalClients,
      description: `${stats.activeClients} activos`,
      icon: Users,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Prospectos Pendientes',
      value: stats.pendingProspects,
      description: 'Por finalizar',
      icon: UserPlus,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
    {
      title: 'Clientes con Adeudo',
      value: stats.clientsWithDebt,
      description: 'Requieren atención',
      icon: AlertTriangle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
    },
    {
      title: 'Ingresos del Mes',
      value: `$${stats.monthlyIncome.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
      description: `${stats.recentPayments} pagos recientes`,
      icon: TrendingUp,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
  ];

  return (
    <AppLayout title="Dashboard">
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statCards.map((card) => (
            <Card key={card.title} className="animate-fade-in">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${card.bgColor}`}>
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{isLoading ? '...' : card.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Día de Corte
              </CardTitle>
              <CardDescription>
                Información del ciclo de facturación
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold text-primary">10</p>
                  <p className="text-sm text-muted-foreground">de cada mes</p>
                </div>
                <Badge variant="secondary" className="text-sm">
                  Día fijo de corte
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Acciones Rápidas
              </CardTitle>
              <CardDescription>
                Accesos directos a funciones principales
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Usa el menú lateral para acceder a:
              </p>
              <ul className="text-sm space-y-1">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Registrar nuevos prospectos
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Gestionar clientes y equipos
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Registrar pagos
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}