
# Plan: Corregir Modal de Confirmación que Aparece Prematuramente

## Problema Identificado

El modal de confirmación "Confirmar Creación de Cliente" aparece cuando se navega de la pestaña "Facturación" a "Resumen", en lugar de aparecer solo al hacer clic en "Finalizar y Crear Cliente".

**Causa raíz:** El componente `TabsTrigger` de Radix UI internamente es un `<button>`, y aunque se añadió `type="button"` como prop, el componente `TabsTrigger` actual NO está pasando esa propiedad al botón interno. Por defecto, un botón dentro de un `<form>` actúa como `type="submit"`, lo que dispara `form.handleSubmit()` al hacer clic en cualquier tab.

---

## Solución

### 1. Modificar el componente TabsTrigger

**Archivo:** `src/components/ui/tabs.tsx`

Modificar el `TabsTrigger` para que siempre tenga `type="button"`, previniendo que actúe como submit:

```typescript
const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    type="button"  // <-- AGREGAR ESTO
    className={cn(
      "inline-flex items-center justify-center...",
      className,
    )}
    {...props}
  />
));
```

### 2. Limpiar el código redundante

**Archivo:** `src/components/prospects/FinalizeProspectDialog.tsx`

Ahora que `TabsTrigger` siempre será `type="button"`, podemos quitar las props `type="button"` redundantes de los triggers (opcional, pero limpia el código):

```typescript
// Antes:
<TabsTrigger type="button" value="personal">Personal</TabsTrigger>

// Después:
<TabsTrigger value="personal">Personal</TabsTrigger>
```

---

## Por Qué Esto Resuelve el Problema

| Antes | Después |
|-------|---------|
| `TabsTrigger` no especifica `type`, hereda `submit` | `TabsTrigger` siempre tiene `type="button"` |
| Clic en tab = dispara `form.handleSubmit()` | Clic en tab = solo cambia de pestaña |
| Modal aparece al navegar | Modal aparece solo con "Finalizar" |

---

## Sección Técnica

El componente Radix `TabsPrimitive.Trigger` renderiza un `<button>`. En HTML, un `<button>` dentro de un `<form>` sin `type` explícito es `type="submit"` por defecto. Al añadir `type="button"` directamente en el componente base, garantizamos que NINGÚN TabsTrigger en toda la aplicación dispare submits accidentales.

La prop que se pasaba antes (`type="button"`) se estaba usando como una prop de React pero NO estaba siendo pasada al `<button>` del DOM porque `{...props}` no la procesaba correctamente en este contexto específico de Radix.
