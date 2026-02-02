import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPhoneNumber, PHONE_COUNTRIES, PhoneCountry } from "@/lib/phoneUtils";

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  country: PhoneCountry;
  onCountryChange: (country: PhoneCountry) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  hasError?: boolean;
}

export function PhoneInput({
  value,
  onChange,
  country,
  onCountryChange,
  placeholder = "000-000-0000",
  disabled = false,
  className = "",
  hasError = false,
}: PhoneInputProps) {
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    onChange(formatted);
  };

  return (
    <div className={`flex gap-2 ${className}`}>
      <Select
        value={country}
        onValueChange={(val) => onCountryChange(val as PhoneCountry)}
        disabled={disabled}
      >
        <SelectTrigger className="w-[100px] flex-shrink-0">
          <SelectValue>
            {PHONE_COUNTRIES.find(c => c.value === country)?.flag} {country}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {PHONE_COUNTRIES.map((countryOption) => (
            <SelectItem key={countryOption.value} value={countryOption.value}>
              {countryOption.flag} {countryOption.label} ({countryOption.code})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="tel"
        value={value}
        onChange={handlePhoneChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`flex-1 ${hasError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
        maxLength={12} // XXX-XXX-XXXX = 12 chars
      />
    </div>
  );
}
