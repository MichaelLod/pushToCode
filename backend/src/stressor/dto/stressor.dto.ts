import { IsBoolean, IsArray, IsString, IsNumber, Min, Max, IsOptional } from 'class-validator';

export class StressorConfigDto {
  @IsBoolean()
  enabled: boolean;

  @IsArray()
  @IsString({ each: true })
  projects: string[];

  @IsNumber()
  @Min(1)
  @Max(24)
  @IsOptional()
  intervalMinHours?: number;

  @IsNumber()
  @Min(1)
  @Max(48)
  @IsOptional()
  intervalMaxHours?: number;
}

export class AddProjectDto {
  @IsString()
  path: string;
}

export class StressorStatusDto {
  running: boolean;
  enabled: boolean;
  pid: number | null;
  projects: string[];
  intervalMinHours: number;
  intervalMaxHours: number;
  lastRun: string | null;
  nextRun: string | null;
}
