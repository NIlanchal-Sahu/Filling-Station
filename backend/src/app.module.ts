import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { EmployersModule } from './employers/employers.module';
import { StudentsModule } from './students/students.module';
import { JobsModule } from './jobs/jobs.module';
import { ApplicationsModule } from './applications/applications.module';
import { SavedJobsModule } from './saved-jobs/saved-jobs.module';
import { MatchingModule } from './matching/matching.module';
import { ChatModule } from './chat/chat.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentsModule } from './payments/payments.module';
import { AdminModule } from './admin/admin.module';
import { UploadModule } from './upload/upload.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    EmployersModule,
    StudentsModule,
    JobsModule,
    ApplicationsModule,
    SavedJobsModule,
    MatchingModule,
    ChatModule,
    NotificationsModule,
    PaymentsModule,
    AdminModule,
    UploadModule,
  ],
})
export class AppModule {}
