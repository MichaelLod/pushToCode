import { StressorService } from './stressor.service';
import { StressorConfigDto, AddProjectDto, StressorStatusDto } from './dto/stressor.dto';
export declare class StressorController {
    private readonly stressorService;
    constructor(stressorService: StressorService);
    getStatus(): StressorStatusDto;
    getConfig(): StressorConfigDto;
    updateConfig(config: Partial<StressorConfigDto>): StressorConfigDto;
    start(): Promise<{
        success: boolean;
        message: string;
    }>;
    stop(): Promise<{
        success: boolean;
        message: string;
    }>;
    addProject(dto: AddProjectDto): StressorConfigDto;
    removeProject(projectPath: string): StressorConfigDto;
    getLogs(lines?: string): {
        logs: string;
    };
}
