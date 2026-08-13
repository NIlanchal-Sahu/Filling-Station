'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

export default function StudentProfilePage() {
  const token = useAuthStore((s) => s.accessToken);
  const [profile, setProfile] = useState({
    fullName: '',
    bio: '',
    city: '',
    education: '',
    schoolCollege: '',
    course: '',
    skills: '',
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!token) return;
    api<Record<string, unknown>>('/students/me', { token }).then((p) => {
      setProfile({
        fullName: (p.fullName as string) || '',
        bio: (p.bio as string) || '',
        city: (p.city as string) || '',
        education: (p.education as string) || '',
        schoolCollege: (p.schoolCollege as string) || '',
        course: (p.course as string) || '',
        skills: ((p.skills as string[]) || []).join(', '),
      });
    }).catch(console.error);
  }, [token]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    await api('/students/me', {
      method: 'PATCH',
      token,
      body: JSON.stringify({
        ...profile,
        skills: profile.skills.split(',').map((s) => s.trim()).filter(Boolean),
      }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold">My Profile</h1>
      <Card className="mt-6">
        <CardHeader><CardTitle>Profile Details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            {['fullName', 'city', 'education', 'schoolCollege', 'course'].map((field) => (
              <div key={field}>
                <label className="text-sm font-medium capitalize">{field.replace(/([A-Z])/g, ' $1')}</label>
                <Input
                  value={profile[field as keyof typeof profile]}
                  onChange={(e) => setProfile({ ...profile, [field]: e.target.value })}
                  className="mt-1"
                />
              </div>
            ))}
            <div>
              <label className="text-sm font-medium">Bio</label>
              <textarea className="mt-1 flex min-h-[80px] w-full rounded-md border border-border bg-card px-3 py-2 text-sm" value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium">Skills (comma-separated)</label>
              <Input value={profile.skills} onChange={(e) => setProfile({ ...profile, skills: e.target.value })} className="mt-1" />
            </div>
            <Button type="submit">{saved ? 'Saved!' : 'Save Profile'}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
