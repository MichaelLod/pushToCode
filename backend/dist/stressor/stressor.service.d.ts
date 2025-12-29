import { StressorConfigDto, StressorStatusDto } from './dto/stressor.dto';
export declare class StressorService {
    private readonly logger;
    private daemonProcess;
    private readonly configDir;
    private readonly configPath;
    private readonly pidPath;
    private readonly logPath;
    private readonly daemonScript;
    constructor();
    private ensureConfigDir;
    private getDefaultConfig;
    getConfig(): StressorConfigDto;
    saveConfig(config: StressorConfigDto): void;
    private getDaemonPid;
    isRunning(): boolean;
    getStatus(): StressorStatusDto;
    private getLastRunTime;
    start(): Promise<{
        success: boolean;
        message: string;
    }>;
    stop(): Promise<{
        success: boolean;
        message: string;
    }>;
    updateConfig(updates: Partial<StressorConfigDto>): StressorConfigDto;
    addProject(projectPath: string): StressorConfigDto;
    removeProject(projectPath: string): StressorConfigDto;
    getLogs(lines?: number): string;
}
