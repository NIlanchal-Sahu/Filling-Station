import Link from 'next/link';
import { Briefcase } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-border bg-card mt-auto">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2 font-bold text-primary">
              <Briefcase className="h-5 w-5" /> LocalJob
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Connecting students with local job opportunities.
            </p>
          </div>
          <div>
            <h4 className="font-semibold">For Job Seekers</h4>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li><Link href="/jobs">Browse Jobs</Link></li>
              <li><Link href="/signup?role=student">Create Profile</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold">For Employers</h4>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li><Link href="/signup?role=employer">Post a Job</Link></li>
              <li><Link href="/pricing">Pricing</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold">Company</h4>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li><Link href="/about">About</Link></li>
              <li><Link href="/contact">Contact</Link></li>
              <li><Link href="/faq">FAQ</Link></li>
            </ul>
          </div>
        </div>
        <p className="mt-8 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} LocalJob. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
