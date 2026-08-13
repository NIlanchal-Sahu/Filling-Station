import { Module } from '@nestjs/common';
import { EmployersController } from './employers.controller';

@Module({ controllers: [EmployersController] })
export class EmployersModule {}
