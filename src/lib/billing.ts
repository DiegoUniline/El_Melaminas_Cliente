// Función para calcular el prorrateo
export function calculateProration(
  installationDate: Date,
  billingDay: number,
  monthlyFee: number
): { proratedAmount: number; daysCharged: number; firstBillingDate: Date } {
  const installDay = installationDate.getDate();
  const installMonth = installationDate.getMonth();
  const installYear = installationDate.getFullYear();

  let firstBillingDate: Date;
  let daysCharged: number;

  if (installDay <= billingDay) {
    // Si se instaló antes del día de corte del mismo mes
    // Cobrar del día de instalación al día de corte
    firstBillingDate = new Date(installYear, installMonth, billingDay);
    daysCharged = billingDay - installDay;
  } else {
    // Si se instaló después del día de corte
    // Cobrar del día de instalación al día de corte del siguiente mes
    firstBillingDate = new Date(installYear, installMonth + 1, billingDay);
    
    // Calcular días hasta fin de mes + días hasta el día ANTERIOR al corte del siguiente mes
    // El día de corte inicia la nueva mensualidad, así que no se cuenta en el prorrateo
    const lastDayOfMonth = new Date(installYear, installMonth + 1, 0).getDate();
    const daysUntilEndOfMonth = lastDayOfMonth - installDay;
    daysCharged = daysUntilEndOfMonth + (billingDay - 1);
  }

  // Calcular el monto prorrateado (basado en 30 días por mes)
  const dailyRate = monthlyFee / 30;
  const proratedAmount = Math.round(dailyRate * daysCharged * 100) / 100;

  return {
    proratedAmount,
    daysCharged,
    firstBillingDate,
  };
}

// Función para formatear moneda
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Función para calcular el saldo total inicial
export function calculateInitialBalance(
  proratedAmount: number,
  installationCost: number,
  additionalCharges: number = 0
): number {
  return proratedAmount + installationCost + additionalCharges;
}
