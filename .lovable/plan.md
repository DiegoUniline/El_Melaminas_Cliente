
# Plan: Corregir el Modal de Confirmación que Aparece al Navegar entre Tabs

## Problema Identificado

El modal de confirmación aparece cuando el usuario hace clic en "Siguiente" estando en la pestaña "Facturación" para ir a "Resumen". Esto no debería pasar - el modal solo debe aparecer al hacer clic en "Finalizar y Crear Cliente".

### Análisis del Flujo Actual

```
Tab: Facturación
  → Usuario hace clic en "Siguiente" (Button type="button")
  → handleNext() se ejecuta
  → setActiveTab('summary')
  → Re-render
  → isLastTab = true
  → [PROBLEMA] El modal aparece
```

### Causa Raíz Probables

1. **Event Bubbling**: El evento del clic puede estar burbujeando y disparando un submit del formulario
2. **React Hook Form**: Puede haber alguna validación automática que dispara el submit
3. **Radix/Browser Behavior**: Comportamiento inesperado del navegador

## Solución Propuesta

### Enfoque: Prevenir el Submit en handleNext

Modificar la función `handleNext()` para que explícitamente prevenga cualquier evento de submit que pudiera estar ocurriendo, y también agregar `preventDefault()` en el propio botón.

### Cambios en el Archivo

**Archivo:** `src/components/prospects/FinalizeProspectDialog.tsx`

#### Cambio 1: Modificar handleNext para prevenir submit

```typescript
// Líneas 222-227: Modificar handleNext
const handleNext = (e?: React.MouseEvent) => {
  e?.preventDefault();
  e?.stopPropagation();
  const currentIndex = TABS.indexOf(activeTab);
  if (currentIndex < TABS.length - 1) {
    setActiveTab(TABS[currentIndex + 1]);
  }
};
```

#### Cambio 2: Pasar el evento al handler del botón

```typescript
// Línea 1279: Modificar el onClick del botón Siguiente
<Button type="button" onClick={(e) => handleNext(e)}>
  Siguiente
</Button>
```

#### Cambio 3: Agregar preventDefault en el evento del form

Como respaldo adicional, modificar el form para que solo procese submits reales:

```typescript
// Línea 599-607: Modificar el form
<form 
  onSubmit={(e) => {
    e.preventDefault();
    // Solo procesar si realmente estamos en la última tab
    if (activeTab === 'summary') {
      form.handleSubmit(handleFormSubmit)(e);
    }
  }} 
  onKeyDown={(e) => {
    if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
      e.preventDefault();
    }
  }}
  className="space-y-4"
>
```

## Por Qué Esto Resuelve el Problema

| Antes | Después |
|-------|---------|
| handleNext no previene eventos | handleNext previene propagación |
| Form procesa cualquier submit | Form solo procesa submit en tab final |
| Modal puede aparecer accidentalmente | Modal solo aparece con acción explícita |

Esta solución tiene múltiples capas de protección:
1. El botón "Siguiente" previene cualquier evento de submit
2. El formulario ignora submits que no vengan del tab final
3. Se detiene la propagación del evento

---

## Sección Técnica

### Estructura del Componente

```
DialogContent
├── DialogHeader
├── Info banner
├── Form (react-hook-form wrapper)
│   └── Tabs
│       ├── TabsList (fuera del form HTML)
│       │   └── TabsTrigger x5 (todos con type="button")
│       └── form (HTML element)
│           ├── TabsContent x5
│           └── DialogFooter
│               ├── Button "Cancelar" (type="button")
│               ├── Button "Anterior" (type="button", condicional)
│               └── Button "Siguiente/Finalizar" 
│                   - En tabs 1-4: type="button", onClick={handleNext}
│                   - En tab 5: type="submit"
└── ConfirmFinalizeDialog (modal de confirmación)
```

### Flujo de Eventos Corregido

1. Usuario en tab "Facturación" hace clic en "Siguiente"
2. `onClick={(e) => handleNext(e)}` se ejecuta
3. `e.preventDefault()` previene cualquier comportamiento por defecto
4. `e.stopPropagation()` detiene el bubbling
5. `setActiveTab('summary')` cambia a la pestaña final
6. El componente se re-renderiza con `isLastTab = true`
7. El botón ahora es "Finalizar y Crear Cliente" con `type="submit"`
8. **No hay submit** - el usuario solo navegó

### Respaldo: Validación en onSubmit

Si por alguna razón un submit se dispara en una tab que no es la final, el handler del form lo ignora completamente, previniendo que el modal aparezca.
