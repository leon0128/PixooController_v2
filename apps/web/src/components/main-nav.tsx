'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/scenes', label: 'Scenes' },
  { href: '/schedules', label: 'Schedule' },
];

export function MainNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-4 text-sm">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            'hover:text-foreground transition-colors',
            pathname.startsWith(link.href)
              ? 'text-foreground font-medium'
              : 'text-muted-foreground',
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
