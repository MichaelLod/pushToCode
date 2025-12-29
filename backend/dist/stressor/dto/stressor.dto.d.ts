export declare class StressorConfigDto {
    enabled: boolean;
    projects: string[];
    intervalMinHours?: number;
    intervalMaxHours?: number;
}
export declare class AddProjectDto {
    path: string;
}
export declare class StressorStatusDto {
    running: boolean;
    enabled: boolean;
    pid: number | null;
    projects: string[];
    intervalMinHours: number;
    intervalMaxHours: number;
    lastRun: string | null;
    nextRun: string | null;
}
