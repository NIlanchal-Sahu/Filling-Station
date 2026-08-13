'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ContactPage() {
  const [sent, setSent] = useState(false);

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <Card>
        <CardHeader><CardTitle>Contact Us</CardTitle></CardHeader>
        <CardContent>
          {sent ? (
            <p className="text-muted-foreground">Thank you! We&apos;ll get back to you soon.</p>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); setSent(true); }} className="space-y-4">
              <Input placeholder="Name" required />
              <Input type="email" placeholder="Email" required />
              <textarea className="flex min-h-[120px] w-full rounded-md border border-border bg-card px-3 py-2 text-sm" placeholder="Message" required />
              <Button type="submit" className="w-full">Send Message</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
