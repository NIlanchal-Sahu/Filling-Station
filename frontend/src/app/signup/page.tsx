'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleParam = searchParams.get('role');
  const setAuth = useAuthStore((s) => s.setAuth);

  const [role, setRole] = useState<'STUDENT' | 'EMPLOYER'>(roleParam === 'employer' ? 'EMPLOYER' : 'STUDENT');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const body = {
        email,
        password,
        role,
        fullName: name,
        businessName: role === 'EMPLOYER' ? name : undefined,
      };
      const res = await api<{ accessToken: string; refreshToken: string; user: { id: string; email: string; role: 'STUDENT' | 'EMPLOYER' | 'ADMIN' } }>(
        '/auth/register',
        { method: 'POST', body: JSON.stringify(body) },
      );
      setAuth(res.accessToken, res.refreshToken, res.user);
      router.push(role === 'EMPLOYER' ? '/employer/dashboard' : '/student/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-2xl">Join LocalJob</CardTitle>
        <p className="text-sm text-muted-foreground">Create your free account</p>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex gap-2">
          <Button type="button" variant={role === 'STUDENT' ? 'default' : 'outline'} className="flex-1" onClick={() => setRole('STUDENT')}>
            Job Seeker
          </Button>
          <Button type="button" variant={role === 'EMPLOYER' ? 'default' : 'outline'} className="flex-1" onClick={() => setRole('EMPLOYER')}>
            Employer
          </Button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div>
            <label className="text-sm font-medium">{role === 'EMPLOYER' ? 'Business Name' : 'Full Name'}</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium">Email</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium">Password</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="mt-1" />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account? <Link href="/login" className="text-primary hover:underline">Sign in</Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function SignupPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center px-4 py-12">
      <Suspense fallback={<div>Loading...</div>}>
        <SignupForm />
      </Suspense>
    </div>
  );
}
