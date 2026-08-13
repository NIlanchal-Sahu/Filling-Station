import { Controller, Get, Post, Body, Headers, RawBodyRequest, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { SubscriptionPlan } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    plan: SubscriptionPlan.FREE,
    price: 0,
    features: ['3 job posts', 'Basic profile', 'Standard listing'],
  },
  {
    id: 'premium_employer',
    name: 'Premium Employer',
    plan: SubscriptionPlan.PREMIUM_EMPLOYER,
    price: 999,
    currency: 'INR',
    features: ['Unlimited jobs', 'Featured jobs', 'Priority listing', 'Candidate recommendations'],
  },
  {
    id: 'premium_student',
    name: 'Premium Student',
    plan: SubscriptionPlan.PREMIUM_STUDENT,
    price: 299,
    currency: 'INR',
    features: ['Profile boost', 'Featured profile', 'AI resume analysis'],
  },
];

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  @Get('plans')
  @Public()
  getPlans() {
    return PLANS;
  }

  @ApiBearerAuth()
  @Post('create-order')
  async createRazorpayOrder(
    @CurrentUser('id') userId: string,
    @Body() body: { planId: string },
  ) {
    const plan = PLANS.find((p) => p.id === body.planId);
    if (!plan || plan.price === 0) return { error: 'Invalid plan' };

    // In production: create Razorpay order via API
    const orderId = `order_${Date.now()}`;
    return {
      orderId,
      amount: plan.price * 100,
      currency: 'INR',
      key: this.config.get('RAZORPAY_KEY_ID'),
      plan: plan.plan,
    };
  }

  @ApiBearerAuth()
  @Post('create-checkout')
  async createStripeCheckout(
    @CurrentUser('id') userId: string,
    @Body() body: { planId: string },
  ) {
    const plan = PLANS.find((p) => p.id === body.planId);
    if (!plan || plan.price === 0) return { error: 'Invalid plan' };

    // In production: Stripe checkout session
    return {
      sessionId: `cs_${Date.now()}`,
      url: `${this.config.get('FRONTEND_URL')}/pricing/success?plan=${plan.id}`,
      plan: plan.plan,
    };
  }

  @Public()
  @Post('webhook/razorpay')
  async razorpayWebhook(@Body() body: { payload?: { payment?: { entity?: { order_id?: string; notes?: { userId?: string; plan?: SubscriptionPlan } } } } }) {
    const notes = body.payload?.payment?.entity?.notes;
    if (notes?.userId && notes?.plan) {
      await this.activatePlan(notes.userId, notes.plan);
    }
    return { status: 'ok' };
  }

  @Public()
  @Post('webhook/stripe')
  async stripeWebhook(@Body() body: { data?: { object?: { metadata?: { userId?: string; plan?: SubscriptionPlan } } } }) {
    const metadata = body.data?.object?.metadata;
    if (metadata?.userId && metadata?.plan) {
      await this.activatePlan(metadata.userId, metadata.plan);
    }
    return { status: 'ok' };
  }

  private async activatePlan(userId: string, plan: SubscriptionPlan) {
    await this.prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        plan,
        jobPostsRemaining: plan === SubscriptionPlan.PREMIUM_EMPLOYER ? 999 : 3,
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      update: {
        plan,
        jobPostsRemaining: plan === SubscriptionPlan.PREMIUM_EMPLOYER ? 999 : 3,
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
  }
}
