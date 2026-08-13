'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

export default function EmployerSettingsPage() {
  const token = useAuthStore((s) => s.accessToken);
  const [profile, setProfile] = useState({
    businessName: '',
    ownerName: '',
    category: '',
    description: '',
    city: '',
    state: '',
    address: '',
    website: '',
    companySize: '',
    logoUrl: '',
    photos: '',
  });
  const [avatarUrl, setAvatarUrl] = useState('');

  useEffect(() => {
    if (!token) return;
    api<{
      businessName: string;
      ownerName: string;
      category: string;
      description?: string;
      city?: string;
      state?: string;
      address?: string;
      website?: string;
      companySize?: string;
      logoUrl?: string;
      photos?: string[];
      user: { avatarUrl?: string };
    }>('/employers/me', { token }).then((p) => {
      setProfile({
        businessName: p.businessName || '',
        ownerName: p.ownerName || '',
        category: p.category || '',
        description: p.description || '',
        city: p.city || '',
        state: p.state || '',
        address: p.address || '',
        website: p.website || '',
        companySize: p.companySize || '',
        logoUrl: p.logoUrl || '',
        photos: (p.photos || []).join(', '),
      });
      setAvatarUrl(p.user.avatarUrl || '');
    }).catch(console.error);
  }, [token]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    const { photos, ...rest } = profile;
    await api('/employers/me', {
      method: 'PATCH',
      token,
      body: JSON.stringify({
        ...rest,
        photos: photos.split(',').map((s) => s.trim()).filter(Boolean),
      }),
    });
    if (avatarUrl) {
      await api('/users/me', { method: 'PATCH', token, body: JSON.stringify({ avatarUrl }) });
    }
    alert('Profile saved!');
  }

  const fields = [
    { key: 'businessName', label: 'Business Name' },
    { key: 'ownerName', label: 'Owner Name' },
    { key: 'category', label: 'Business Category (e.g. Food & Beverage)' },
    { key: 'description', label: 'About Your Business', textarea: true },
    { key: 'logoUrl', label: 'Business Logo URL' },
    { key: 'photos', label: 'Shop Photo URLs (comma-separated)' },
    { key: 'address', label: 'Address' },
    { key: 'city', label: 'City' },
    { key: 'state', label: 'State' },
    { key: 'companySize', label: 'Company Size' },
    { key: 'website', label: 'Website' },
  ] as const;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold">Employer Settings</h1>
      <Card className="mt-6">
        <CardHeader><CardTitle>Business Profile</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Owner Photo URL</label>
              <Input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} className="mt-1" placeholder="https://..." />
            </div>
            {fields.map(({ key, label, textarea }) => (
              <div key={key}>
                <label className="text-sm font-medium">{label}</label>
                {textarea ? (
                  <textarea
                    className="mt-1 flex min-h-[80px] w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                    value={profile[key]}
                    onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}
                  />
                ) : (
                  <Input
                    value={profile[key]}
                    onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}
                    className="mt-1"
                  />
                )}
              </div>
            ))}
            <Button type="submit">Save Profile</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
