'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

interface Plan {
  id: string;
  name: string;
  price: number;
  currency?: string;
  features: string[];
}

export default function PricingPage() {
  const token = useAuthStore((s) => s.accessToken);
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    api<Plan[]>('/payments/plans').then(setPlans).catch(console.error);
  }, []);

  async function subscribe(planId: string) {
    if (!token) {
      window.location.href = '/login?redirect=/pricing';
      return;
    }
    const order = await api<{ orderId: string; key: string; amount: number }>('/payments/create-order', {
      method: 'POST',
      token,
      body: JSON.stringify({ planId }),
    });
    alert(`Razorpay checkout: Order ${order.orderId} — integrate Razorpay SDK in production`);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="text-center text-3xl font-bold">Simple, Transparent Pricing</h1>
      <p className="mt-4 text-center text-muted-foreground">Start free. Upgrade when you need more.</p>
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.id} className={plan.id.includes('premium') ? 'border-primary ring-1 ring-primary' : ''}>
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              <p className="text-3xl font-bold">
                {plan.price === 0 ? 'Free' : `₹${plan.price}`}
                {plan.price > 0 && <span className="text-sm font-normal text-muted-foreground">/mo</span>}
              </p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">✓ {f}</li>
                ))}
              </ul>
              {plan.price > 0 ? (
                <Button className="mt-6 w-full" onClick={() => subscribe(plan.id)}>Subscribe</Button>
              ) : (
                <Button className="mt-6 w-full" variant="outline" asChild>
                  <a href="/signup">Get Started</a>
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
