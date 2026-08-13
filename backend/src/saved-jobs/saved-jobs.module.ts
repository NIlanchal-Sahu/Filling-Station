import { Module } from '@nestjs/common';
import { SavedJobsController } from './saved-jobs.controller';

@Module({ controllers: [SavedJobsController] })
export class SavedJobsModule {}
