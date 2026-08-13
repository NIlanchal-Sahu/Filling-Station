'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await api('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
    setSent(true);
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center px-4 py-12">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Reset Password</CardTitle>
        </CardHeader>
        <CardContent>
          {sent ? (
            <p className="text-sm text-muted-foreground">If an account exists, a reset link has been sent.</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <Button type="submit" className="w-full">Send Reset Link</Button>
            </form>
          )}
          <Link href="/login" className="mt-4 block text-center text-sm text-primary">Back to login</Link>
        </CardContent>
      </Card>
    </div>
  );
}
