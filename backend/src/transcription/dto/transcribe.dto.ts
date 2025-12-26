import { IsOptional, IsString } from 'class-validator';

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
