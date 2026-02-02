
# Plan: Corregir Modal de Confirmación que Aparece al Cambiar de Tab

## Problema Identificado

El modal de confirmación sigue apareciendo cuando se cambia de la pestaña "Facturación" a "Resumen", a pesar de haber agregado `type="button"` al componente `TabsTrigger`.

**Causa raíz:** El componente `TabsPrimitive.Trigger` de Radix UI puede no estar respetando correctamente la prop `type="button"` cuando está dentro de un `<form>`. El comportamiento de submit se está disparando de alguna manera.

---

## Solución

### Opcion Elegida: Separar la TabsList del Form

La solución más robusta es **reestructurar el componente** para que la navegación de tabs (`TabsList` con los `TabsTrigger`) esté **fuera del `<form>`**, mientras que el contenido de cada tab permanece dentro del form.

**Archivo:** `src/components/prospects/FinalizeProspectDialog.tsx`

### Cambio Estructural

```text
ANTES:
<Form {...form}>
  <form onSubmit={...}>
    <Tabs>
      <TabsList>          <-- DENTRO del form (problema)
        <TabsTrigger />
      </TabsList>
      <TabsContent>
        {form fields}
      </TabsContent>
    </Tabs>
    <DialogFooter>
      <Button type="submit" />
    </DialogFooter>
  </form>
</Form>

DESPUÉS:
<Form {...form}>
  <Tabs>
    <TabsList>              <-- FUERA del form (solución)
      <TabsTrigger />
    </TabsList>
    <form onSubmit={...}>
      <TabsContent>
        {form fields}
      </TabsContent>
      <DialogFooter>
        <Button type="submit" />
      </DialogFooter>
    </form>
  </Tabs>
</Form>
```

### Cambios Específicos

1. Mover la apertura de `<Tabs>` antes del `<form>`
2. Mantener `<TabsList>` con todos los triggers fuera del form
3. El `<form>` solo envuelve los `<TabsContent>` y el `<DialogFooter>`
4. Cerrar `</Tabs>` después del `</form>`

---

## Por Qué Esto Resuelve el Problema

| Antes | Después |
|-------|---------|
| TabsTrigger dentro de form | TabsTrigger fuera de form |
| Click en tab puede disparar submit | Click en tab solo cambia de pestaña |
| Modal aparece al navegar | Modal aparece solo con "Finalizar" |

Esta es la solución más robusta porque:
- Elimina completamente la posibilidad de que los botones de navegación disparen un submit
- No depende de que Radix UI respete la prop `type`
- Es un patrón común en formularios con tabs

---

## Sección Tecnica

El formulario HTML tiene un comportamiento por defecto donde cualquier `<button>` sin `type` explícito actúa como `type="submit"`. Aunque se agregó `type="button"` al componente Radix, la biblioteca puede estar renderizando el botón de una forma que no respeta esa prop, o puede haber algún evento de click que burbujea y dispara el submit.

Al mover los `TabsTrigger` fuera del `<form>`, eliminamos cualquier posibilidad de interacción accidental entre la navegación de tabs y el submit del formulario.

Estructura final:

```
DialogContent
├── DialogHeader
├── Info banner
├── Form (react-hook-form wrapper)
│   └── Tabs
│       ├── TabsList (FUERA del form)
│       │   └── TabsTrigger x5
│       └── form (HTML element)
│           ├── TabsContent x5
│           └── DialogFooter
│               └── Button type="submit"
└── ConfirmFinalizeDialog
```
