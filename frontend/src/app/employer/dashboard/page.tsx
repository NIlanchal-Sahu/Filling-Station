'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Briefcase,
  Users,
  UserCheck,
  XCircle,
  CheckCircle,
  BadgeCheck,
  MapPin,
  Building2,
  Globe,
  Pencil,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

interface EmployerProfile {
  businessName: string;
  ownerName: string;
  category: string;
  description?: string | null;
  logoUrl?: string | null;
  photos: string[];
  city?: string | null;
  state?: string | null;
  address?: string | null;
  companySize?: string | null;
  website?: string | null;
  isVerified: boolean;
  user: { email: string; phone?: string | null; avatarUrl?: string | null };
}

interface DashboardData {
  activeJobs: number;
  totalApplicants: number;
  newApplications: number;
  shortlisted: number;
  rejected: number;
  hired: number;
  recentApplications: Array<{
    id: string;
    status: string;
    student: { fullName: string };
    job: { title: string };
  }>;
}

function ProfileAvatar({ src, name, size = 80 }: { src?: string | null; name: string; size?: number }) {
  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={size}
        height={size}
        className="rounded-full border-4 border-card object-cover shadow-md"
        style={{ width: size, height: size }}
      />
    );
  }
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      className="flex items-center justify-center rounded-full border-4 border-card bg-primary text-primary-foreground font-bold shadow-md"
      style={{ width: size, height: size, fontSize: size * 0.3 }}
    >
      {initials}
    </div>
  );
}

export default function EmployerDashboard() {
  const token = useAuthStore((s) => s.accessToken);
  const [profile, setProfile] = useState<EmployerProfile | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    if (!token) return;
    api<EmployerProfile>('/employers/me', { token }).then(setProfile).catch(console.error);
    api<DashboardData>('/employers/dashboard', { token }).then(setData).catch(console.error);
  }, [token]);

  const stats = [
    { label: 'Active Jobs', value: data?.activeJobs ?? 0, icon: Briefcase },
    { label: 'Total Applicants', value: data?.totalApplicants ?? 0, icon: Users },
    { label: 'New', value: data?.newApplications ?? 0, icon: UserCheck },
    { label: 'Shortlisted', value: data?.shortlisted ?? 0, icon: CheckCircle },
    { label: 'Rejected', value: data?.rejected ?? 0, icon: XCircle },
    { label: 'Hired', value: data?.hired ?? 0, icon: CheckCircle },
  ];

  const coverPhoto = profile?.photos?.[0];
  const shopPhotos = profile?.photos?.slice(1) ?? [];
  const location = [profile?.city, profile?.state].filter(Boolean).join(', ');

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Business Profile Card */}
      <Card className="overflow-hidden">
        <div className="relative h-40 bg-gradient-to-r from-primary/80 to-primary md:h-52">
          {coverPhoto ? (
            <Image src={coverPhoto} alt="Shop" fill className="object-cover" priority />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-r from-primary to-primary/70" />
          )}
          <div className="absolute inset-0 bg-black/30" />
        </div>

        <CardContent className="relative px-6 pb-6 pt-0">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              {/* Business logo */}
              <div className="-mt-10 shrink-0">
                {profile?.logoUrl ? (
                  <Image
                    src={profile.logoUrl}
                    alt={profile.businessName}
                    width={88}
                    height={88}
                    className="rounded-xl border-4 border-card object-cover shadow-lg"
                  />
                ) : (
                  <div className="flex h-[88px] w-[88px] items-center justify-center rounded-xl border-4 border-card bg-primary/10 shadow-lg">
                    <Building2 className="h-10 w-10 text-primary" />
                  </div>
                )}
              </div>

              <div className="pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold">{profile?.businessName ?? 'Your Business'}</h1>
                  {profile?.isVerified && (
                    <BadgeCheck className="h-6 w-6 text-primary" aria-label="Verified" />
                  )}
                </div>
                <span className="mt-1 inline-block rounded-full bg-primary/10 px-3 py-0.5 text-sm font-medium text-primary">
                  {profile?.category ?? 'Business Category'}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <Link href="/employer/settings">
                <Button variant="outline" size="sm">
                  <Pencil className="mr-1 h-4 w-4" /> Edit Profile
                </Button>
              </Link>
              <Link href="/employer/jobs/new">
                <Button size="sm">Post a Job</Button>
              </Link>
            </div>
          </div>

          {/* Owner + business details */}
          <div className="mt-6 grid gap-6 border-t border-border pt-6 md:grid-cols-3">
            <div className="flex items-start gap-4">
              <ProfileAvatar
                src={profile?.user.avatarUrl}
                name={profile?.ownerName ?? 'Owner'}
                size={64}
              />
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Owner</p>
                <p className="font-semibold">{profile?.ownerName ?? '—'}</p>
                <p className="text-sm text-muted-foreground">{profile?.user.email}</p>
                {profile?.user.phone && (
                  <p className="text-sm text-muted-foreground">{profile.user.phone}</p>
                )}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">About Business</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {profile?.description ?? 'Add a description about your business in Settings.'}
              </p>
              {profile?.companySize && (
                <p className="mt-2 text-sm">
                  <span className="font-medium">Team size:</span> {profile.companySize} employees
                </p>
              )}
            </div>

            <div className="space-y-2 text-sm">
              {location && (
                <p className="flex items-start gap-2 text-muted-foreground">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>
                    {profile?.address && <>{profile.address}<br /></>}
                    {location}
                  </span>
                </p>
              )}
              {profile?.website && (
                <p className="flex items-center gap-2">
                  <Globe className="h-4 w-4 shrink-0 text-primary" />
                  <a href={profile.website} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                    {profile.website.replace(/^https?:\/\//, '')}
                  </a>
                </p>
              )}
            </div>
          </div>

          {/* Shop photo gallery */}
          {(shopPhotos.length > 0 || coverPhoto) && (
            <div className="mt-6 border-t border-border pt-6">
              <p className="mb-3 text-sm font-semibold">Shop Photos</p>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {(coverPhoto ? [coverPhoto, ...shopPhotos] : shopPhotos).map((photo, i) => (
                  <div key={i} className="relative h-28 w-40 shrink-0 overflow-hidden rounded-lg border border-border">
                    <Image src={photo} alt={`Shop photo ${i + 1}`} fill className="object-cover" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <h2 className="mt-8 text-lg font-semibold">Overview</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-lg bg-primary/10 p-3 text-primary">
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-sm text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-8">
        <CardHeader><CardTitle>Recent Applications</CardTitle></CardHeader>
        <CardContent>
          {data?.recentApplications?.length ? (
            <div className="divide-y">
              {data.recentApplications.map((app) => (
                <div key={app.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">{app.student.fullName}</p>
                    <p className="text-sm text-muted-foreground">{app.job.title}</p>
                  </div>
                  <span className="rounded bg-muted px-2 py-1 text-xs">{app.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No applications yet.</p>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/employer/jobs"><Button variant="outline">Manage Jobs</Button></Link>
        <Link href="/employer/messages"><Button variant="outline">Messages</Button></Link>
        <Link href="/employer/settings"><Button variant="outline">Settings</Button></Link>
      </div>
    </div>
  );
}
