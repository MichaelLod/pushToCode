import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VoiceGateway } from './voice.gateway';
import { VoiceSessionService } from './voice-session.service';
import { TtsService } from './tts.service';

@Module({
  imports: [ConfigModule],
  providers: [VoiceGateway, VoiceSessionService, TtsService],
  exports: [VoiceSessionService, TtsService],
})
export class VoiceModule {}
