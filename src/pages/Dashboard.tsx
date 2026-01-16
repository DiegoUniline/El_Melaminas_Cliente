import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { 
  Users, UserPlus, CreditCard, AlertTriangle, TrendingUp, Calendar, 
  DollarSign, ArrowRight, Loader2, Activity, ChevronRight
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { formatCurrency } from '@/lib/billing';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Dashboard() {
  // Fetch main stats
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const [
        { count: totalClients },
        { count: activeClients },
        { count: pendingProspects },
        { data: billingData },
      ] = await Promise.all([
        supabase.from('clients').select('*', { count: 'exact', head: true }),
        supabase.from('clients').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('prospects').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('client_billing').select('balance').gt('balance', 0),
      ]);

      const clientsWithDebt = billingData?.length || 0;
      const totalDebt = billingData?.reduce((sum, b) => sum + Number(b.balance), 0) || 0;

      // Monthly income
      const now = new Date();
      const startOfCurrentMonth = format(startOfMonth(now), 'yyyy-MM-dd');
      const endOfCurrentMonth = format(endOfMonth(now), 'yyyy-MM-dd');

      const { data: monthPayments } = await supabase
        .from('payments')
        .select('amount')
        .gte('payment_date', startOfCurrentMonth)
        .lte('payment_date', endOfCurrentMonth);

      const monthlyIncome = monthPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      // Recent payments count
      const sevenDaysAgo = format(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
      const { count: recentPayments } = await supabase
        .from('payments')
        .select('*', { count: 'exact', head: true })
        .gte('payment_date', sevenDaysAgo);

      return {
        totalClients: totalClients || 0,
        activeClients: activeClients || 0,
        pendingProspects: pendingProspects || 0,
        clientsWithDebt,
        totalDebt,
        monthlyIncome,
        recentPayments: recentPayments || 0,
      };
    },
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch last 6 months income for chart
  const { data: incomeData = [] } = useQuery({
    queryKey: ['dashboard-income-chart'],
    queryFn: async () => {
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const date = subMonths(new Date(), i);
        const start = format(startOfMonth(date), 'yyyy-MM-dd');
        const end = format(endOfMonth(date), 'yyyy-MM-dd');
        
        const { data } = await supabase
          .from('payments')
          .select('amount')
          .gte('payment_date', start)
          .lte('payment_date', end);

        const total = data?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
        
        months.push({
          month: format(date, 'MMM', { locale: es }),
          ingresos: total,
        });
      }
      return months;
    },
  });

  // Fetch recent payments
  const { data: recentPaymentsList = [] } = useQuery({
    queryKey: ['dashboard-recent-payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          id,
          amount,
          payment_date,
          clients!inner(first_name, last_name_paterno)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch clients needing attention (overdue)
  const { data: overdueClients = [] } = useQuery({
    queryKey: ['dashboard-overdue-clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_billing')
        .select(`
          balance,
          billing_day,
          clients!inner(id, first_name, last_name_paterno, neighborhood)
        `)
        .gt('balance', 0)
        .order('balance', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data || [];
    },
  });

  const statCards = [
    {
      title: 'Clientes Activos',
      value: stats?.activeClients || 0,
      description: `de ${stats?.totalClients || 0} totales`,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Prospectos Pendientes',
      value: stats?.pendingProspects || 0,
      description: 'Por finalizar',
      icon: UserPlus,
      color: 'text-amber-600',
      bgColor: 'bg-amber-100',
    },
    {
      title: 'Clientes con Adeudo',
      value: stats?.clientsWithDebt || 0,
      description: formatCurrency(stats?.totalDebt || 0),
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
    },
    {
      title: 'Ingresos del Mes',
      value: formatCurrency(stats?.monthlyIncome || 0),
      description: `${stats?.recentPayments || 0} pagos recientes`,
      icon: TrendingUp,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100',
    },
  ];

  return (
    <AppLayout title="Dashboard">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statCards.map((card) => (
            <Card key={card.title} className="animate-fade-in hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${card.bgColor}`}>
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loadingStats ? <Loader2 className="h-6 w-6 animate-spin" /> : card.value}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid gap-4 md:grid-cols-7">
          {/* Income Chart - Takes more space */}
          <Card className="md:col-span-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Ingresos Últimos 6 Meses
              </CardTitle>
              <CardDescription>
                Evolución de ingresos mensuales
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={incomeData}>
                    <defs>
                      <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis 
                      tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} 
                      className="text-xs"
                    />
                    <Tooltip 
                      formatter={(value: number) => [`$${value.toLocaleString()}`, 'Ingresos']}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="ingresos" 
                      stroke="hsl(var(--primary))" 
                      fillOpacity={1} 
                      fill="url(#colorIngresos)" 
                      strokeWidth={2} 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions & Info */}
          <Card className="md:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Acciones Rápidas
              </CardTitle>
              <CardDescription>
                Accesos directos a funciones principales
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link to="/prospects">
                <Button variant="outline" className="w-full justify-between group">
                  <span className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    Nuevo Prospecto
                  </span>
                  <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link to="/clients">
                <Button variant="outline" className="w-full justify-between group">
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Gestionar Clientes
                  </span>
                  <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link to="/payments">
                <Button variant="outline" className="w-full justify-between group">
                  <span className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Registrar Pago
                  </span>
                  <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link to="/reports">
                <Button variant="outline" className="w-full justify-between group">
                  <span className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Ver Reportes
                  </span>
                  <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row - Recent Activity */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Recent Payments */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-emerald-600" />
                  Pagos Recientes
                </CardTitle>
                <CardDescription>Últimos 5 pagos registrados</CardDescription>
              </div>
              <Link to="/payments">
                <Button variant="ghost" size="sm">
                  Ver todos <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentPaymentsList.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">No hay pagos recientes</p>
                ) : (
                  recentPaymentsList.map((payment: any) => (
                    <div key={payment.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="font-medium">
                          {payment.clients.first_name} {payment.clients.last_name_paterno}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(payment.payment_date), 'dd MMM yyyy', { locale: es })}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-emerald-600 bg-emerald-50">
                        +{formatCurrency(payment.amount)}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Clients Needing Attention */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  Clientes con Adeudo
                </CardTitle>
                <CardDescription>Top 5 clientes con mayor deuda</CardDescription>
              </div>
              <Link to="/clients/debt">
                <Button variant="ghost" size="sm">
                  Ver todos <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {overdueClients.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">No hay clientes con adeudo</p>
                ) : (
                  overdueClients.map((item: any) => (
                    <div key={item.clients.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="font-medium">
                          {item.clients.first_name} {item.clients.last_name_paterno}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {item.clients.neighborhood}
                        </p>
                      </div>
                      <Badge variant="destructive">
                        {formatCurrency(item.balance)}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}