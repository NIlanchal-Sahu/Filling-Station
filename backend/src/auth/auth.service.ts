import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { UserRole } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import {
  RegisterDto,
  LoginDto,
  GoogleAuthDto,
  SendOtpDto,
  VerifyOtpDto,
} from './dto/auth.dto';

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {
    this.googleClient = new OAuth2Client(config.get('GOOGLE_CLIENT_ID'));
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, ...(dto.phone ? [{ phone: dto.phone }] : [])] },
    });
    if (existing) throw new ConflictException('Email or phone already registered');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        role: dto.role,
        subscription: { create: { plan: 'FREE', jobPostsRemaining: 3 } },
        ...(dto.role === UserRole.STUDENT && dto.fullName
          ? { studentProfile: { create: { fullName: dto.fullName } } }
          : {}),
        ...(dto.role === UserRole.EMPLOYER && dto.businessName
          ? {
              employerProfile: {
                create: {
                  businessName: dto.businessName,
                  ownerName: dto.fullName || 'Owner',
                  category: 'General',
                },
              },
            }
          : {}),
      },
    });

    return this.issueTokens(user.id, user.email, user.role);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user?.passwordHash) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    if (user.isSuspended) throw new UnauthorizedException('Account suspended');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.issueTokens(user.id, user.email, user.role);
  }

  async googleAuth(dto: GoogleAuthDto) {
    const ticket = await this.googleClient.verifyIdToken({
      idToken: dto.idToken,
      audience: this.config.get('GOOGLE_CLIENT_ID'),
    });
    const payload = ticket.getPayload();
    if (!payload?.email) throw new BadRequestException('Invalid Google token');

    let user = await this.prisma.user.findFirst({
      where: { OR: [{ googleId: payload.sub }, { email: payload.email }] },
    });

    if (!user) {
      const role = dto.role || UserRole.STUDENT;
      user = await this.prisma.user.create({
        data: {
          email: payload.email,
          googleId: payload.sub,
          emailVerified: payload.email_verified ?? true,
          avatarUrl: payload.picture,
          role,
          subscription: { create: { plan: 'FREE', jobPostsRemaining: 3 } },
          ...(role === UserRole.STUDENT
            ? { studentProfile: { create: { fullName: payload.name || 'User' } } }
            : {
                employerProfile: {
                  create: {
                    businessName: payload.name || 'My Business',
                    ownerName: payload.name || 'Owner',
                    category: 'General',
                  },
                },
              }),
        },
      });
    } else if (!user.googleId) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { googleId: payload.sub, avatarUrl: user.avatarUrl || payload.picture },
      });
    }

    return this.issueTokens(user.id, user.email, user.role);
  }

  async sendOtp(dto: SendOtpDto) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.prisma.otpCode.deleteMany({ where: { phone: dto.phone } });
    await this.prisma.otpCode.create({ data: { phone: dto.phone, code, expiresAt } });

    // In production: integrate SMS provider (Twilio, MSG91)
    console.log(`OTP for ${dto.phone}: ${code}`);

    return { message: 'OTP sent successfully', ...(process.env.NODE_ENV !== 'production' ? { code } : {}) };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const otp = await this.prisma.otpCode.findFirst({
      where: { phone: dto.phone, code: dto.code, expiresAt: { gt: new Date() } },
    });
    if (!otp) throw new BadRequestException('Invalid or expired OTP');

    await this.prisma.otpCode.deleteMany({ where: { phone: dto.phone } });

    let user = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (!user) {
      const role = dto.role || UserRole.STUDENT;
      user = await this.prisma.user.create({
        data: {
          email: `${dto.phone.replace(/\D/g, '')}@phone.localjob.app`,
          phone: dto.phone,
          phoneVerified: true,
          role,
          subscription: { create: { plan: 'FREE', jobPostsRemaining: 3 } },
          studentProfile: role === UserRole.STUDENT ? { create: { fullName: 'User' } } : undefined,
          employerProfile:
            role === UserRole.EMPLOYER
              ? { create: { businessName: 'My Business', ownerName: 'Owner', category: 'General' } }
              : undefined,
        },
      });
    } else {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { phoneVerified: true },
      });
    }

    return this.issueTokens(user.id, user.email, user.role);
  }

  async refresh(refreshToken: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });
    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.delete({ where: { id: stored.id } });
    return this.issueTokens(stored.user.id, stored.user.email, stored.user.role);
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return { message: 'If email exists, reset link sent' };

    const token = uuidv4();
    await this.prisma.passwordReset.create({
      data: { email, token, expiresAt: new Date(Date.now() + 3600000) },
    });
    // In production: send email with link
    console.log(`Password reset token for ${email}: ${token}`);
    return { message: 'If email exists, reset link sent' };
  }

  async resetPassword(token: string, password: string) {
    const reset = await this.prisma.passwordReset.findUnique({ where: { token } });
    if (!reset || reset.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired token');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await this.prisma.user.update({ where: { email: reset.email }, data: { passwordHash } });
    await this.prisma.passwordReset.delete({ where: { id: reset.id } });
    return { message: 'Password updated successfully' };
  }

  async getMe(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        avatarUrl: true,
        emailVerified: true,
        phoneVerified: true,
        createdAt: true,
        employerProfile: true,
        studentProfile: true,
        subscription: true,
      },
    });
  }

  private async issueTokens(userId: string, email: string, role: UserRole) {
    const payload = { sub: userId, email, role };
    const accessToken = this.jwt.sign(payload, {
      secret: this.config.get('JWT_SECRET'),
      expiresIn: this.config.get('JWT_EXPIRES_IN') || '15m',
    });

    const refreshToken = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.prisma.refreshToken.create({ data: { token: refreshToken, userId, expiresAt } });

    return {
      accessToken,
      refreshToken,
      user: { id: userId, email, role },
    };
  }
}
