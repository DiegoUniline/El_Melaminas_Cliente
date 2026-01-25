
# Plan: Mejorar Flujo de Conversión con Resumen y Cargos del Catálogo

## Resumen del Problema

El usuario necesita que el modal de conversión de prospecto a cliente (`FinalizeProspectDialog`):

1. **Muestre un resumen completo** de la facturación inicial con formato moneda
2. **Los cargos adicionales vengan del catálogo** (`charge_catalog`) en lugar de un input libre
3. **Navegación por pasos**: Cambiar "Finalizar y Crear Cliente" por "Siguiente" hasta el último paso
4. **Un tab final de Resumen** que muestre toda la información antes de crear el cliente

---

## Solución Propuesta

### 1. Agregar Tab de Resumen Final

Agregar un 5to tab llamado **"Resumen"** que muestre:
- Datos personales del cliente
- Dirección completa
- Datos técnicos (SSID, IP)
- **Resumen de facturación** con formato moneda:
  - Plan seleccionado
  - Mensualidad
  - Costo de instalación
  - Prorrateo
  - Cargos adicionales (del catálogo)
  - **Total saldo inicial**

### 2. Cambiar Cargos Adicionales a Selector del Catálogo

**Cambios en el formulario:**

Reemplazar el input de "Cargos Adicionales" por:
```typescript
// Query para obtener catálogo
const { data: chargeCatalog = [] } = useQuery({
  queryKey: ['charge_catalog'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('charge_catalog')
      .select('*')
      .eq('is_active', true)
      .order('name');
    if (error) throw error;
    return data;
  },
});

// Estado para cargos seleccionados (múltiples)
const [selectedCharges, setSelectedCharges] = useState<{
  catalog_id: string;
  name: string;
  amount: number;
}[]>([]);
```

**UI del selector de cargos:**
- Select para elegir cargo del catálogo
- Input para modificar monto (pre-llenado con default_amount)
- Botón "Agregar"
- Lista de cargos agregados con opción de eliminar

### 3. Navegación por Pasos (Siguiente/Anterior)

**Orden de tabs:**
1. Personal
2. Dirección  
3. Técnico
4. Facturación
5. **Resumen** (nuevo)

**Botones del footer:**

```typescript
const tabs = ['personal', 'address', 'technical', 'billing', 'summary'];
const currentIndex = tabs.indexOf(activeTab);
const isLastTab = activeTab === 'summary';
const isFirstTab = activeTab === 'personal';

// En DialogFooter:
<Button variant="outline" onClick={() => onOpenChange(false)}>
  Cancelar
</Button>

{!isFirstTab && (
  <Button variant="outline" onClick={() => setActiveTab(tabs[currentIndex - 1])}>
    Anterior
  </Button>
)}

{isLastTab ? (
  <Button type="submit" className="bg-green-600 hover:bg-green-700">
    Finalizar y Crear Cliente
  </Button>
) : (
  <Button type="button" onClick={() => setActiveTab(tabs[currentIndex + 1])}>
    Siguiente
  </Button>
)}
```

---

## Cambios en el Archivo

### `src/components/prospects/FinalizeProspectDialog.tsx`

#### 1. Agregar imports y queries

```typescript
// Agregar al schema (modificar additional_charges)
additional_charges: z.array(z.object({
  catalog_id: z.string(),
  name: z.string(),
  amount: z.number(),
})).optional(),

// Query para catálogo
const { data: chargeCatalog = [] } = useQuery({...});

// Estado para cargos seleccionados
const [selectedCharges, setSelectedCharges] = useState<{
  catalog_id: string;
  name: string;
  amount: number;
}[]>([]);
const [selectedChargeId, setSelectedChargeId] = useState('');
const [chargeAmount, setChargeAmount] = useState('');
```

#### 2. Modificar TabsList (agregar Resumen)

```typescript
<TabsList className="grid w-full grid-cols-5">
  <TabsTrigger value="personal">Personal</TabsTrigger>
  <TabsTrigger value="address">Dirección</TabsTrigger>
  <TabsTrigger value="technical">Técnico</TabsTrigger>
  <TabsTrigger value="billing">Facturación</TabsTrigger>
  <TabsTrigger value="summary">Resumen</TabsTrigger>
</TabsList>
```

#### 3. Reemplazar input de Cargos Adicionales (en tab billing)

```typescript
{/* Selector de cargos del catálogo */}
<div className="space-y-3">
  <FormLabel>Cargos Adicionales</FormLabel>
  <div className="flex gap-2">
    <Select value={selectedChargeId} onValueChange={handleChargeSelect}>
      <SelectTrigger className="flex-1">
        <SelectValue placeholder="Seleccionar cargo" />
      </SelectTrigger>
      <SelectContent>
        {chargeCatalog.map((item) => (
          <SelectItem key={item.id} value={item.id}>
            {item.name} ({formatCurrency(item.default_amount)})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    <Input
      type="number"
      className="w-32"
      placeholder="Monto"
      value={chargeAmount}
      onChange={(e) => setChargeAmount(e.target.value)}
    />
    <Button type="button" variant="outline" onClick={handleAddCharge}>
      Agregar
    </Button>
  </div>
  
  {/* Lista de cargos agregados */}
  {selectedCharges.length > 0 && (
    <div className="border rounded-lg p-3 space-y-2">
      {selectedCharges.map((charge, index) => (
        <div key={index} className="flex justify-between items-center">
          <span>{charge.name}</span>
          <div className="flex items-center gap-2">
            <span className="font-medium">{formatCurrency(charge.amount)}</span>
            <Button variant="ghost" size="icon" onClick={() => handleRemoveCharge(index)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )}
</div>
```

#### 4. Agregar Tab de Resumen

```typescript
<TabsContent value="summary" className="space-y-4 pt-4">
  <div className="space-y-4">
    {/* Datos Personales */}
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm">Datos Personales</CardTitle>
      </CardHeader>
      <CardContent className="text-sm">
        <p><strong>Nombre:</strong> {form.watch('first_name')} {form.watch('last_name_paterno')} {form.watch('last_name_materno')}</p>
        <p><strong>Teléfono:</strong> {formatPhoneNumber(form.watch('phone1'))}</p>
      </CardContent>
    </Card>

    {/* Dirección */}
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm">Dirección</CardTitle>
      </CardHeader>
      <CardContent className="text-sm">
        <p>{form.watch('street')} {form.watch('exterior_number')}{form.watch('interior_number') && ` Int. ${form.watch('interior_number')}`}</p>
        <p>{form.watch('neighborhood')}, {form.watch('city')}</p>
      </CardContent>
    </Card>

    {/* Resumen de Facturación */}
    <Card className="border-primary">
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          Resumen de Facturación
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Plan:</span>
            <span className="font-medium">{selectedPlanName}</span>
          </div>
          <div className="flex justify-between">
            <span>Mensualidad:</span>
            <span className="font-medium">{formatCurrency(form.watch('monthly_fee'))}</span>
          </div>
          <Separator />
          <div className="flex justify-between">
            <span>Costo de Instalación:</span>
            <span className="font-medium">{formatCurrency(form.watch('installation_cost'))}</span>
          </div>
          <div className="flex justify-between">
            <span>Prorrateo:</span>
            <span className="font-medium">{formatCurrency(form.watch('prorated_amount'))}</span>
          </div>
          {selectedCharges.map((charge, i) => (
            <div key={i} className="flex justify-between">
              <span>{charge.name}:</span>
              <span className="font-medium">{formatCurrency(charge.amount)}</span>
            </div>
          ))}
          <Separator />
          <div className="flex justify-between text-base font-bold text-primary">
            <span>Total Saldo Inicial:</span>
            <span>{formatCurrency(totalInitialBalance)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</TabsContent>
```

#### 5. Modificar DialogFooter

```typescript
<DialogFooter className="pt-4">
  <Button
    type="button"
    variant="outline"
    onClick={() => onOpenChange(false)}
    disabled={isLoading}
  >
    Cancelar
  </Button>
  
  {activeTab !== 'personal' && (
    <Button
      type="button"
      variant="outline"
      onClick={handlePrevious}
      disabled={isLoading}
    >
      Anterior
    </Button>
  )}
  
  {activeTab === 'summary' ? (
    <Button
      type="submit"
      disabled={isLoading}
      className="bg-green-600 hover:bg-green-700"
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Finalizando...
        </>
      ) : (
        'Finalizar y Crear Cliente'
      )}
    </Button>
  ) : (
    <Button type="button" onClick={handleNext}>
      Siguiente
    </Button>
  )}
</DialogFooter>
```

#### 6. Actualizar lógica de handleFinalize

Modificar para crear cargos individuales del catálogo:

```typescript
// Crear cargos adicionales del catálogo
for (const charge of selectedCharges) {
  chargesToCreate.push({
    client_id: clientData.id,
    charge_catalog_id: charge.catalog_id,
    description: charge.name,
    amount: charge.amount,
    status: 'pending',
    created_by: user?.id,
  });
}
```

---

## Funciones Auxiliares Nuevas

```typescript
const tabs = ['personal', 'address', 'technical', 'billing', 'summary'];

const handleNext = () => {
  const currentIndex = tabs.indexOf(activeTab);
  if (currentIndex < tabs.length - 1) {
    setActiveTab(tabs[currentIndex + 1]);
  }
};

const handlePrevious = () => {
  const currentIndex = tabs.indexOf(activeTab);
  if (currentIndex > 0) {
    setActiveTab(tabs[currentIndex - 1]);
  }
};

const handleChargeSelect = (catalogId: string) => {
  setSelectedChargeId(catalogId);
  const item = chargeCatalog.find(c => c.id === catalogId);
  if (item) {
    setChargeAmount(item.default_amount.toString());
  }
};

const handleAddCharge = () => {
  const item = chargeCatalog.find(c => c.id === selectedChargeId);
  if (item && chargeAmount) {
    setSelectedCharges([...selectedCharges, {
      catalog_id: item.id,
      name: item.name,
      amount: parseFloat(chargeAmount),
    }]);
    setSelectedChargeId('');
    setChargeAmount('');
  }
};

const handleRemoveCharge = (index: number) => {
  setSelectedCharges(selectedCharges.filter((_, i) => i !== index));
};

// Total calculado
const totalAdditionalCharges = selectedCharges.reduce((sum, c) => sum + c.amount, 0);
const totalInitialBalance = 
  (form.watch('installation_cost') || 0) + 
  (form.watch('prorated_amount') || 0) + 
  totalAdditionalCharges;
```

---

## Resultado Final

### Flujo de Usuario:

1. **Tab Personal** → Botón "Siguiente"
2. **Tab Dirección** → Botones "Anterior" / "Siguiente"
3. **Tab Técnico** → Botones "Anterior" / "Siguiente"
4. **Tab Facturación** → Botones "Anterior" / "Siguiente"
   - Selector de plan con precio en formato moneda
   - Selector de cargos del catálogo con montos predefinidos
   - Resumen parcial de costos
5. **Tab Resumen** → Botones "Anterior" / "Finalizar y Crear Cliente"
   - Datos personales resumidos
   - Dirección completa
   - **Resumen de facturación con todos los montos en formato moneda**
   - Total del saldo inicial destacado

### Beneficios:
- El usuario puede revisar toda la información antes de confirmar
- Los cargos adicionales vienen del catálogo con montos predefinidos
- Navegación clara con pasos definidos
- Todos los montos se muestran con `formatCurrency()`
