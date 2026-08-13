'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Briefcase, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/auth-store';
import { cn } from '@/lib/utils';

const publicLinks = [
  { href: '/jobs', label: 'Jobs' },
  { href: '/about', label: 'About' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/contact', label: 'Contact' },
  { href: '/faq', label: 'FAQ' },
];

export function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  const dashboardHref =
    user?.role === 'EMPLOYER'
      ? '/employer/dashboard'
      : user?.role === 'ADMIN'
        ? '/admin'
        : '/student/dashboard';

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-primary">
          <Briefcase className="h-6 w-6" />
          LocalJob
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {publicLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'text-sm font-medium hover:text-primary',
                pathname === link.href && 'text-primary',
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <>
              <Link href={dashboardHref}>
                <Button variant="ghost" size="sm">Dashboard</Button>
              </Link>
              <Button variant="outline" size="sm" onClick={logout}>Logout</Button>
            </>
          ) : (
            <>
              <Link href="/login"><Button variant="ghost" size="sm">Login</Button></Link>
              <Link href="/signup"><Button size="sm">Join Free</Button></Link>
            </>
          )}
        </div>

        <button className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X /> : <Menu />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-border bg-card p-4 md:hidden">
          {publicLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block py-2 text-sm"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="mt-4 flex gap-2">
            {user ? (
              <Button variant="outline" className="w-full" onClick={logout}>Logout</Button>
            ) : (
              <>
                <Link href="/login" className="flex-1"><Button variant="outline" className="w-full">Login</Button></Link>
                <Link href="/signup" className="flex-1"><Button className="w-full">Join</Button></Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
