import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ReposService } from './repos.service';
import { ReposController } from './repos.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [ReposController],
  providers: [ReposService],
  exports: [ReposService],
})
export class ReposModule {}
