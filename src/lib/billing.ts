// Función para calcular el prorrateo
export function calculateProration(
  installationDate: Date,
  billingDay: number,
  monthlyFee: number
): { proratedAmount: number; daysCharged: number; firstBillingDate: Date } {
  // IMPORTANTE: Usar UTC para evitar problemas de timezone
  // Al recibir "2026-02-02" de un input date, JavaScript puede interpretarlo
  // como medianoche UTC, que en zonas horarias negativas (como México) 
  // se convierte al día anterior
  const installDay = installationDate.getUTCDate();
  const installMonth = installationDate.getUTCMonth();
  const installYear = installationDate.getUTCFullYear();

  let firstBillingDate: Date;
  let daysCharged: number;

  if (installDay < billingDay) {
    // Si se instaló ANTES del día de corte del mismo mes
    // Cobrar del día de instalación al día ANTERIOR al corte (el corte inicia nuevo ciclo)
    // Ejemplo: instalar día 2, corte día 10
    // Días a cobrar: 2, 3, 4, 5, 6, 7, 8, 9 = 8 días
    // Fórmula: billing_day - install_day = 10 - 2 = 8 días ✓
    firstBillingDate = new Date(Date.UTC(installYear, installMonth, billingDay));
    daysCharged = billingDay - installDay;
  } else if (installDay === billingDay) {
    // Si se instaló EL MISMO día del corte, prorrateo es 0
    // La primera mensualidad completa empieza ese día
    firstBillingDate = new Date(Date.UTC(installYear, installMonth, billingDay));
    daysCharged = 0;
  } else {
    // Si se instaló DESPUÉS del día de corte
    // Cobrar del día de instalación al día ANTERIOR al corte del siguiente mes
    // Ejemplo: instalar día 15, corte día 10
    // Días de febrero restantes (15-28) + días de marzo (1-9)
    firstBillingDate = new Date(Date.UTC(installYear, installMonth + 1, billingDay));
    
    // Calcular días hasta fin de mes (INCLUYENDO el día de instalación) 
    // + días hasta el día ANTERIOR al corte del siguiente mes
    const lastDayOfMonth = new Date(Date.UTC(installYear, installMonth + 1, 0)).getUTCDate();
    const daysUntilEndOfMonth = lastDayOfMonth - installDay + 1; // +1 para incluir el día de instalación
    daysCharged = daysUntilEndOfMonth + (billingDay - 1); // billingDay - 1 porque el día de corte no se incluye
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
