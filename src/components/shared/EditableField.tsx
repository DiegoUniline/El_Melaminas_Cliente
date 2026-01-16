import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PhoneInput } from "./PhoneInput";
import { PhoneCountry } from "@/lib/phoneUtils";

interface EditableFieldProps {
  label: string;
  value: string;
  isEditing: boolean;
  onChange: (value: string) => void;
  type?: 'text' | 'phone' | 'number' | 'select';
  options?: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  phoneCountry?: PhoneCountry;
  onPhoneCountryChange?: (country: PhoneCountry) => void;
}

export function EditableField({
  label,
  value,
  isEditing,
  onChange,
  type = 'text',
  options = [],
  placeholder = '',
  className = '',
  phoneCountry = 'MX',
  onPhoneCountryChange,
}: EditableFieldProps) {
  if (!isEditing) {
    return (
      <div className={className}>
        <span className="text-muted-foreground text-sm">{label}</span>
        <p className="font-medium">{value || '-'}</p>
      </div>
    );
  }

  if (type === 'phone') {
    return (
      <div className={`space-y-1 ${className}`}>
        <Label className="text-sm">{label}</Label>
        <PhoneInput
          value={value}
          onChange={onChange}
          country={phoneCountry}
          onCountryChange={onPhoneCountryChange || (() => {})}
          placeholder={placeholder}
        />
      </div>
    );
  }

  if (type === 'select') {
    return (
      <div className={`space-y-1 ${className}`}>
        <Label className="text-sm">{label}</Label>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className={`space-y-1 ${className}`}>
      <Label className="text-sm">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
