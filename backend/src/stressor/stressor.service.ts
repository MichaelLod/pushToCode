import { Injectable, Logger } from '@nestjs/common';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { StressorConfigDto, StressorStatusDto } from './dto/stressor.dto';

@Injectable()
export class StressorService {
  private readonly logger = new Logger(StressorService.name);
  private daemonProcess: ChildProcess | null = null;

  private readonly configDir = process.env.STRESSOR_CONFIG_DIR || '/repos/.stressor';
  private readonly configPath = path.join(this.configDir, 'config.json');
  private readonly pidPath = path.join(this.configDir, 'daemon.pid');
  private readonly logPath = path.join(this.configDir, 'daemon.log');
  private readonly daemonScript = process.env.STRESSOR_DAEMON_SCRIPT || '/app/stressor-daemon.sh';

  constructor() {
    this.ensureConfigDir();
  }

  private ensureConfigDir(): void {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }

  private getDefaultConfig(): StressorConfigDto {
    return {
      enabled: false,
      projects: [],
      intervalMinHours: 4,
      intervalMaxHours: 8,
    };
  }

  getConfig(): StressorConfigDto {
    try {
      if (fs.existsSync(this.configPath)) {
        const content = fs.readFileSync(this.configPath, 'utf-8');
        return { ...this.getDefaultConfig(), ...JSON.parse(content) };
      }
    } catch (error) {
      this.logger.warn('Failed to read stressor config', error);
    }
    return this.getDefaultConfig();
  }

  saveConfig(config: StressorConfigDto): void {
    this.ensureConfigDir();
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    this.logger.log('Stressor config saved');
  }

  private getDaemonPid(): number | null {
    try {
      if (fs.existsSync(this.pidPath)) {
        const pid = parseInt(fs.readFileSync(this.pidPath, 'utf-8').trim(), 10);
        // Check if process is actually running
        try {
          process.kill(pid, 0);
          return pid;
        } catch {
          // Process not running, clean up stale PID file
          fs.unlinkSync(this.pidPath);
        }
      }
    } catch (error) {
      this.logger.warn('Failed to check daemon PID', error);
    }
    return null;
  }

  isRunning(): boolean {
    return this.getDaemonPid() !== null;
  }

  getStatus(): StressorStatusDto {
    const config = this.getConfig();
    const pid = this.getDaemonPid();

    return {
      running: pid !== null,
      enabled: config.enabled,
      pid,
      projects: config.projects,
      intervalMinHours: config.intervalMinHours || 4,
      intervalMaxHours: config.intervalMaxHours || 8,
      lastRun: this.getLastRunTime(),
      nextRun: null, // Would need to parse log or track separately
    };
  }

  private getLastRunTime(): string | null {
    try {
      if (fs.existsSync(this.logPath)) {
        const content = fs.readFileSync(this.logPath, 'utf-8');
        const lines = content.split('\n').filter(l => l.includes('Running @stressor scan'));
        if (lines.length > 0) {
          const lastLine = lines[lines.length - 1];
          const match = lastLine.match(/\[([\d-]+\s[\d:]+)\]/);
          if (match) return match[1];
        }
      }
    } catch {
      // Ignore errors
    }
    return null;
  }

  async start(): Promise<{ success: boolean; message: string }> {
    if (this.isRunning()) {
      return { success: false, message: 'Daemon is already running' };
    }

    const config = this.getConfig();
    if (!config.enabled) {
      // Auto-enable when starting
      config.enabled = true;
      this.saveConfig(config);
    }

    try {
      this.daemonProcess = spawn('bash', [this.daemonScript, this.configPath], {
        detached: true,
        stdio: 'ignore',
        env: { ...process.env },
      });

      this.daemonProcess.unref();
      this.logger.log(`Stressor daemon started with PID ${this.daemonProcess.pid}`);

      return { success: true, message: `Daemon started with PID ${this.daemonProcess.pid}` };
    } catch (error) {
      this.logger.error('Failed to start stressor daemon', error);
      return { success: false, message: `Failed to start daemon: ${error.message}` };
    }
  }

  async stop(): Promise<{ success: boolean; message: string }> {
    const pid = this.getDaemonPid();

    if (!pid) {
      return { success: false, message: 'Daemon is not running' };
    }

    try {
      process.kill(pid, 'SIGTERM');
      this.logger.log(`Stressor daemon stopped (PID ${pid})`);

      // Update config to disabled
      const config = this.getConfig();
      config.enabled = false;
      this.saveConfig(config);

      return { success: true, message: 'Daemon stopped' };
    } catch (error) {
      this.logger.error('Failed to stop stressor daemon', error);
      return { success: false, message: `Failed to stop daemon: ${error.message}` };
    }
  }

  updateConfig(updates: Partial<StressorConfigDto>): StressorConfigDto {
    const config = { ...this.getConfig(), ...updates };
    this.saveConfig(config);
    return config;
  }

  addProject(projectPath: string): StressorConfigDto {
    const config = this.getConfig();
    if (!config.projects.includes(projectPath)) {
      config.projects.push(projectPath);
      this.saveConfig(config);
    }
    return config;
  }

  removeProject(projectPath: string): StressorConfigDto {
    const config = this.getConfig();
    config.projects = config.projects.filter(p => p !== projectPath);
    this.saveConfig(config);
    return config;
  }

  getLogs(lines: number = 100): string {
    try {
      if (fs.existsSync(this.logPath)) {
        const content = fs.readFileSync(this.logPath, 'utf-8');
        const allLines = content.split('\n');
        return allLines.slice(-lines).join('\n');
      }
    } catch {
      // Ignore errors
    }
    return '';
  }
}
