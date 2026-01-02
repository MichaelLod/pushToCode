import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ClaudeModule } from './claude/claude.module';
import { TranscriptionModule } from './transcription/transcription.module';
import { ReposModule } from './repos/repos.module';
import { StressorModule } from './stressor/stressor.module';
import { VoiceModule } from './voice/voice.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    AuthModule,
    ClaudeModule,
    TranscriptionModule,
    ReposModule,
    StressorModule,
    VoiceModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
