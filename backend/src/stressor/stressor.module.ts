import { Module } from '@nestjs/common';
import { StressorController } from './stressor.controller';
import { StressorService } from './stressor.service';

@Module({
  controllers: [StressorController],
  providers: [StressorService],
  exports: [StressorService],
})
export class StressorModule {}
