import { Controller, Get, Patch, Body } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('students')
@ApiBearerAuth()
@Roles(UserRole.STUDENT)
@Controller('students')
export class StudentsController {
  constructor(private prisma: PrismaService) {}

  @Get('me')
  getProfile(@CurrentUser('id') userId: string) {
    return this.prisma.studentProfile.findUnique({
      where: { userId },
      include: { user: { select: { email: true, phone: true, avatarUrl: true } } },
    });
  }

  @Patch('me')
  updateProfile(@CurrentUser('id') userId: string, @Body() body: Record<string, unknown>) {
    return this.prisma.studentProfile.update({
      where: { userId },
      data: body as object,
    });
  }
}
