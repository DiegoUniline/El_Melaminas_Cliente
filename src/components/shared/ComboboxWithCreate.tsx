import { useState, useEffect, useRef } from 'react';
import { Check, ChevronsUpDown, Plus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CatalogItem {
  id: string;
  name: string;
  [key: string]: any;
}

interface ComboboxWithCreateProps {
  value: string;
  onChange: (value: string, item?: CatalogItem) => void;
  items: CatalogItem[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  tableName: string;
  displayField?: string;
  disabled?: boolean;
  className?: string;
  onItemCreated?: (item: CatalogItem) => void;
}

export function ComboboxWithCreate({
  value,
  onChange,
  items,
  placeholder = 'Seleccionar...',
  searchPlaceholder = 'Buscar...',
  emptyMessage = 'No se encontraron resultados.',
  tableName,
  displayField = 'name',
  disabled = false,
  className,
  onItemCreated,
}: ComboboxWithCreateProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter items based on search
  const filteredItems = items.filter((item) =>
    item[displayField]?.toLowerCase().includes(search.toLowerCase())
  );

  // Check if search matches exactly
  const exactMatch = items.some(
    (item) => item[displayField]?.toLowerCase() === search.toLowerCase()
  );

  // Get selected item display value
  const selectedItem = items.find((item) => item.id === value);
  const displayValue = selectedItem?.[displayField] || '';

  const handleCreate = async () => {
    if (!search.trim()) return;

    setIsCreating(true);
    try {
      // Use a generic approach that works with any catalog table
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/${tableName}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'Prefer': 'return=representation',
          },
          body: JSON.stringify({ name: search.trim() }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.code === '23505') {
          toast.error('Este elemento ya existe');
        } else {
          throw new Error(errorData.message || 'Error al crear');
        }
        return;
      }

      const data = await response.json();
      const newItem = Array.isArray(data) ? data[0] : data;

      toast.success(`"${search.trim()}" creado`);
      onChange(newItem.id, newItem as CatalogItem);
      onItemCreated?.(newItem as CatalogItem);
      setSearch('');
      setOpen(false);
    } catch (error: any) {
      console.error('Error creating item:', error);
      toast.error(error.message || 'Error al crear');
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelect = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    onChange(itemId, item);
    setOpen(false);
    setSearch('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between font-normal',
            !value && 'text-muted-foreground',
            className
          )}
        >
          {displayValue || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            ref={inputRef}
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {filteredItems.length === 0 && !search && (
              <CommandEmpty>{emptyMessage}</CommandEmpty>
            )}

            {/* Create option when search doesn't match exactly */}
            {search && !exactMatch && (
              <CommandGroup>
                <CommandItem
                  onSelect={handleCreate}
                  disabled={isCreating}
                  className="text-primary cursor-pointer"
                >
                  {isCreating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  Crear "{search}"
                </CommandItem>
              </CommandGroup>
            )}

            {/* Existing items */}
            {filteredItems.length > 0 && (
              <CommandGroup>
                {filteredItems.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    onSelect={() => handleSelect(item.id)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === item.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {item[displayField]}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {search && filteredItems.length === 0 && exactMatch && (
              <CommandEmpty>No hay más resultados</CommandEmpty>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
