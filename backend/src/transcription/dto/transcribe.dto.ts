import { IsOptional, IsString, IsNumber, IsIn, Min, Max } from 'class-validator';

export class TranscribeDto {
  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  prompt?: string;
}

export class TranscribeResponseDto {
  text: string;
  duration?: number;
  language?: string;
}

export type TtsVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

export class TextToSpeechDto {
  @IsString()
  text: string;

  @IsOptional()
  @IsString()
  @IsIn(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'])
  voice?: TtsVoice;

  @IsOptional()
  @IsNumber()
  @Min(0.25)
  @Max(4.0)
  speed?: number;
}
