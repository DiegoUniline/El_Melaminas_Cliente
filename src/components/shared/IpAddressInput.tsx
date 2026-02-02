import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Valida si es una IP completa válida
function isValidIPAddress(ip: string): boolean {
  if (!ip) return false;
  const pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!pattern.test(ip)) return false;
  return ip.split('.').every(n => {
    const num = parseInt(n, 10);
    return num >= 0 && num <= 255;
  });
}

interface IpAddressInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function IpAddressInput({
  value,
  onChange,
  placeholder = "192.168.1.1",
  disabled = false,
  className = "",
}: IpAddressInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Solo permitir números y puntos
    const cleaned = e.target.value.replace(/[^0-9.]/g, '');
    // Evitar múltiples puntos seguidos
    const normalized = cleaned.replace(/\.+/g, '.');
    onChange(normalized);
  };

  const isComplete = isValidIPAddress(value);
  const isPartial = value.length > 0 && !isComplete;

  return (
    <Input
      type="text"
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      disabled={disabled}
      maxLength={15} // XXX.XXX.XXX.XXX = 15 chars
      className={cn(
        className,
        isPartial && "border-amber-500 focus-visible:ring-amber-500"
      )}
    />
  );
}
