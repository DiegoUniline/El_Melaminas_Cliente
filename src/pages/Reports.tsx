import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart3, TrendingUp, TrendingDown, Users, DollarSign, FileDown, Calendar, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts';
import { formatCurrency } from '@/lib/billing';
import { format, subMonths, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { exportToExcel } from '@/lib/exportToExcel';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function Reports() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());

  // Fetch monthly income data
  const { data: monthlyIncome = [], isLoading: loadingIncome } = useQuery({
    queryKey: ['monthly-income', selectedYear],
    queryFn: async () => {
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;
      
      const { data, error } = await supabase
        .from('payments')
        .select('amount, payment_date')
        .gte('payment_date', startDate)
        .lte('payment_date', endDate)
        .order('payment_date');

      if (error) throw error;

      // Group by month
      const monthlyData: { [key: string]: number } = {};
      const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      months.forEach((m, i) => monthlyData[m] = 0);

      data?.forEach(payment => {
        const month = new Date(payment.payment_date).getMonth();
        monthlyData[months[month]] += Number(payment.amount);
      });

      return months.map(month => ({
        month,
        ingresos: monthlyData[month],
      }));
    },
  });

  // Fetch client growth
  const { data: clientGrowth = [], isLoading: loadingGrowth } = useQuery({
    queryKey: ['client-growth', selectedYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('created_at, status')
        .order('created_at');

      if (error) throw error;

      // Group by month for selected year
      const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const monthlyNew: { [key: string]: number } = {};
      const monthlyCancelled: { [key: string]: number } = {};
      months.forEach(m => {
        monthlyNew[m] = 0;
        monthlyCancelled[m] = 0;
      });

      data?.forEach(client => {
        const date = new Date(client.created_at);
        if (date.getFullYear().toString() === selectedYear) {
          const month = months[date.getMonth()];
          monthlyNew[month]++;
        }
      });

      // Get cancelled clients
      const { data: cancelled } = await supabase
        .from('clients')
        .select('cancelled_at')
        .eq('status', 'cancelled')
        .not('cancelled_at', 'is', null);

      cancelled?.forEach(client => {
        if (client.cancelled_at) {
          const date = new Date(client.cancelled_at);
          if (date.getFullYear().toString() === selectedYear) {
            const month = months[date.getMonth()];
            monthlyCancelled[month]++;
          }
        }
      });

      return months.map(month => ({
        month,
        nuevos: monthlyNew[month],
        bajas: monthlyCancelled[month],
      }));
    },
  });

  // Fetch payment methods distribution
  const { data: paymentMethodsData = [], isLoading: loadingMethods } = useQuery({
    queryKey: ['payment-methods-dist', selectedYear],
    queryFn: async () => {
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;

      const { data, error } = await supabase
        .from('payments')
        .select('payment_type, amount')
        .gte('payment_date', startDate)
        .lte('payment_date', endDate);

      if (error) throw error;

      // Get payment method names
      const { data: methods } = await supabase.from('payment_methods').select('id, name');
      const methodsMap = new Map(methods?.map(m => [m.id, m.name]) || []);

      // Group by payment type
      const grouped: { [key: string]: { count: number; amount: number } } = {};
      data?.forEach(payment => {
        const methodName = methodsMap.get(payment.payment_type) || payment.payment_type;
        if (!grouped[methodName]) {
          grouped[methodName] = { count: 0, amount: 0 };
        }
        grouped[methodName].count++;
        grouped[methodName].amount += Number(payment.amount);
      });

      return Object.entries(grouped).map(([name, data]) => ({
        name,
        value: data.count,
        amount: data.amount,
      }));
    },
  });

  // Fetch top debtors
  const { data: topDebtors = [], isLoading: loadingDebtors } = useQuery({
    queryKey: ['top-debtors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_billing')
        .select(`
          balance,
          clients!inner(
            id,
            first_name,
            last_name_paterno,
            status,
            neighborhood
          )
        `)
        .gt('balance', 0)
        .order('balance', { ascending: false })
        .limit(10);

      if (error) throw error;

      return data?.map(item => ({
        id: item.clients.id,
        name: `${item.clients.first_name} ${item.clients.last_name_paterno}`,
        neighborhood: item.clients.neighborhood,
        balance: item.balance,
        status: item.clients.status,
      })) || [];
    },
  });

  // Summary statistics
  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ['report-summary', selectedYear],
    queryFn: async () => {
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;
      const prevYearStart = `${parseInt(selectedYear) - 1}-01-01`;
      const prevYearEnd = `${parseInt(selectedYear) - 1}-12-31`;

      // Current year income
      const { data: currentPayments } = await supabase
        .from('payments')
        .select('amount')
        .gte('payment_date', startDate)
        .lte('payment_date', endDate);

      const currentIncome = currentPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      // Previous year income
      const { data: prevPayments } = await supabase
        .from('payments')
        .select('amount')
        .gte('payment_date', prevYearStart)
        .lte('payment_date', prevYearEnd);

      const prevIncome = prevPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      // Client counts
      const { count: totalClients } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true });

      const { count: activeClients } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      // Total debt
      const { data: debts } = await supabase
        .from('client_billing')
        .select('balance')
        .gt('balance', 0);

      const totalDebt = debts?.reduce((sum, d) => sum + Number(d.balance), 0) || 0;

      // Payments count
      const paymentsCount = currentPayments?.length || 0;

      const incomeGrowth = prevIncome > 0 ? ((currentIncome - prevIncome) / prevIncome) * 100 : 0;

      return {
        currentIncome,
        prevIncome,
        incomeGrowth,
        totalClients: totalClients || 0,
        activeClients: activeClients || 0,
        totalDebt,
        paymentsCount,
      };
    },
  });

  const handleExportIncome = () => {
    const exportData = monthlyIncome.map(item => ({
      Mes: item.month,
      Ingresos: item.ingresos,
    }));
    exportToExcel(exportData, `Ingresos_${selectedYear}`);
  };

  const handleExportDebtors = () => {
    const exportData = topDebtors.map(item => ({
      Cliente: item.name,
      Colonia: item.neighborhood,
      Adeudo: item.balance,
    }));
    exportToExcel(exportData, `Deudores_${new Date().toISOString().split('T')[0]}`);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <BarChart3 className="h-8 w-8" />
              Reportes
            </h1>
            <p className="text-muted-foreground mt-1">
              Análisis detallado del negocio
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(year => (
                  <SelectItem key={year} value={year}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-100">
                  <DollarSign className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {loadingSummary ? '...' : formatCurrency(summary?.currentIncome || 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Ingresos {selectedYear}</p>
                  {summary && summary.incomeGrowth !== 0 && (
                    <div className={`flex items-center gap-1 text-xs ${summary.incomeGrowth > 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                      {summary.incomeGrowth > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {Math.abs(summary.incomeGrowth).toFixed(1)}% vs año anterior
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{loadingSummary ? '...' : summary?.activeClients}</p>
                  <p className="text-xs text-muted-foreground">Clientes Activos</p>
                  <p className="text-xs text-muted-foreground">{summary?.totalClients} totales</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100">
                  <BarChart3 className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{loadingSummary ? '...' : summary?.paymentsCount}</p>
                  <p className="text-xs text-muted-foreground">Pagos Registrados</p>
                  <p className="text-xs text-muted-foreground">en {selectedYear}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100">
                  <TrendingDown className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-destructive">
                    {loadingSummary ? '...' : formatCurrency(summary?.totalDebt || 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Cartera Vencida</p>
                  <p className="text-xs text-muted-foreground">Por cobrar</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for different reports */}
        <Tabs defaultValue="income">
          <TabsList className="grid w-full max-w-lg grid-cols-4">
            <TabsTrigger value="income">Ingresos</TabsTrigger>
            <TabsTrigger value="clients">Clientes</TabsTrigger>
            <TabsTrigger value="methods">Métodos</TabsTrigger>
            <TabsTrigger value="debtors">Deudores</TabsTrigger>
          </TabsList>

          {/* Income Report */}
          <TabsContent value="income" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Ingresos Mensuales</CardTitle>
                  <CardDescription>Evolución de ingresos en {selectedYear}</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={handleExportIncome}>
                  <FileDown className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </CardHeader>
              <CardContent>
                {loadingIncome ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={monthlyIncome}>
                        <defs>
                          <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                        <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, 'Ingresos']} />
                        <Area type="monotone" dataKey="ingresos" stroke="#3b82f6" fillOpacity={1} fill="url(#colorIngresos)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Client Growth Report */}
          <TabsContent value="clients" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Crecimiento de Clientes</CardTitle>
                <CardDescription>Nuevos clientes vs bajas en {selectedYear}</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingGrowth ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={clientGrowth}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="nuevos" name="Nuevos Clientes" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="bajas" name="Bajas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payment Methods Report */}
          <TabsContent value="methods" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Distribución por Método de Pago</CardTitle>
                <CardDescription>Pagos agrupados por método en {selectedYear}</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingMethods ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={paymentMethodsData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {paymentMethodsData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-3">
                      {paymentMethodsData.map((item, index) => (
                        <div key={item.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                            <span className="font-medium">{item.name}</span>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{item.value} pagos</p>
                            <p className="text-sm text-muted-foreground">{formatCurrency(item.amount)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Top Debtors Report */}
          <TabsContent value="debtors" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Top 10 Deudores</CardTitle>
                  <CardDescription>Clientes con mayor adeudo pendiente</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={handleExportDebtors}>
                  <FileDown className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </CardHeader>
              <CardContent>
                {loadingDebtors ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>CLIENTE</TableHead>
                        <TableHead>COLONIA</TableHead>
                        <TableHead>ESTADO</TableHead>
                        <TableHead className="text-right">ADEUDO</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topDebtors.map((debtor, index) => (
                        <TableRow key={debtor.id}>
                          <TableCell className="font-medium">{index + 1}</TableCell>
                          <TableCell>{debtor.name}</TableCell>
                          <TableCell className="text-muted-foreground">{debtor.neighborhood}</TableCell>
                          <TableCell>
                            <Badge variant={debtor.status === 'active' ? 'default' : 'secondary'}>
                              {debtor.status === 'active' ? 'Activo' : 'Baja'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-destructive">
                            {formatCurrency(debtor.balance)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {topDebtors.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No hay clientes con adeudo
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}