'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fontLabel, type PixooFont } from '@/lib/api-types';
import { cn } from '@/lib/utils';

/**
 * Picks the font an element is rendered in.
 *
 * Divoom's catalogue is what gives the ids their names, so when it is unreachable
 * this falls back to a plain id input rather than hiding the field — the value still
 * has to be editable, named or not.
 */
export function FontField({
  value,
  fonts,
  onChange,
  className,
}: {
  value: number;
  fonts: PixooFont[];
  onChange: (value: number) => void;
  className?: string;
}) {
  if (fonts.length === 0) {
    return (
      <div className={cn('space-y-1.5', className)}>
        <Label className="text-xs">Font ID</Label>
        <Input
          type="number"
          min={0}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </div>
    );
  }

  const known = fonts.some((font) => font.id === value);

  return (
    <div className={cn('space-y-1.5', className)}>
      <Label className="text-xs">Font</Label>
      <select
        className="border-input bg-background h-9 w-full rounded-md border px-2 text-sm"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {/* Keep an unlisted id selectable so an existing scene is never silently changed. */}
        {!known && <option value={value}>Font {value}</option>}
        {fonts.map((font) => (
          <option key={font.id} value={font.id}>
            {fontLabel(font)}
          </option>
        ))}
      </select>
    </div>
  );
}
