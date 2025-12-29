"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var StressorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StressorService = void 0;
const common_1 = require("@nestjs/common");
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
let StressorService = StressorService_1 = class StressorService {
    logger = new common_1.Logger(StressorService_1.name);
    daemonProcess = null;
    configDir = process.env.STRESSOR_CONFIG_DIR || '/repos/.stressor';
    configPath = path.join(this.configDir, 'config.json');
    pidPath = path.join(this.configDir, 'daemon.pid');
    logPath = path.join(this.configDir, 'daemon.log');
    daemonScript = process.env.STRESSOR_DAEMON_SCRIPT || '/app/stressor-daemon.sh';
    constructor() {
        this.ensureConfigDir();
    }
    ensureConfigDir() {
        if (!fs.existsSync(this.configDir)) {
            fs.mkdirSync(this.configDir, { recursive: true });
        }
    }
    getDefaultConfig() {
        return {
            enabled: false,
            projects: [],
            intervalMinHours: 4,
            intervalMaxHours: 8,
        };
    }
    getConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const content = fs.readFileSync(this.configPath, 'utf-8');
                return { ...this.getDefaultConfig(), ...JSON.parse(content) };
            }
        }
        catch (error) {
            this.logger.warn('Failed to read stressor config', error);
        }
        return this.getDefaultConfig();
    }
    saveConfig(config) {
        this.ensureConfigDir();
        fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
        this.logger.log('Stressor config saved');
    }
    getDaemonPid() {
        try {
            if (fs.existsSync(this.pidPath)) {
                const pid = parseInt(fs.readFileSync(this.pidPath, 'utf-8').trim(), 10);
                try {
                    process.kill(pid, 0);
                    return pid;
                }
                catch {
                    fs.unlinkSync(this.pidPath);
                }
            }
        }
        catch (error) {
            this.logger.warn('Failed to check daemon PID', error);
        }
        return null;
    }
    isRunning() {
        return this.getDaemonPid() !== null;
    }
    getStatus() {
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
            nextRun: null,
        };
    }
    getLastRunTime() {
        try {
            if (fs.existsSync(this.logPath)) {
                const content = fs.readFileSync(this.logPath, 'utf-8');
                const lines = content.split('\n').filter(l => l.includes('Running @stressor scan'));
                if (lines.length > 0) {
                    const lastLine = lines[lines.length - 1];
                    const match = lastLine.match(/\[([\d-]+\s[\d:]+)\]/);
                    if (match)
                        return match[1];
                }
            }
        }
        catch {
        }
        return null;
    }
    async start() {
        if (this.isRunning()) {
            return { success: false, message: 'Daemon is already running' };
        }
        const config = this.getConfig();
        if (!config.enabled) {
            config.enabled = true;
            this.saveConfig(config);
        }
        try {
            this.daemonProcess = (0, child_process_1.spawn)('bash', [this.daemonScript, this.configPath], {
                detached: true,
                stdio: 'ignore',
                env: { ...process.env },
            });
            this.daemonProcess.unref();
            this.logger.log(`Stressor daemon started with PID ${this.daemonProcess.pid}`);
            return { success: true, message: `Daemon started with PID ${this.daemonProcess.pid}` };
        }
        catch (error) {
            this.logger.error('Failed to start stressor daemon', error);
            return { success: false, message: `Failed to start daemon: ${error.message}` };
        }
    }
    async stop() {
        const pid = this.getDaemonPid();
        if (!pid) {
            return { success: false, message: 'Daemon is not running' };
        }
        try {
            process.kill(pid, 'SIGTERM');
            this.logger.log(`Stressor daemon stopped (PID ${pid})`);
            const config = this.getConfig();
            config.enabled = false;
            this.saveConfig(config);
            return { success: true, message: 'Daemon stopped' };
        }
        catch (error) {
            this.logger.error('Failed to stop stressor daemon', error);
            return { success: false, message: `Failed to stop daemon: ${error.message}` };
        }
    }
    updateConfig(updates) {
        const config = { ...this.getConfig(), ...updates };
        this.saveConfig(config);
        return config;
    }
    addProject(projectPath) {
        const config = this.getConfig();
        if (!config.projects.includes(projectPath)) {
            config.projects.push(projectPath);
            this.saveConfig(config);
        }
        return config;
    }
    removeProject(projectPath) {
        const config = this.getConfig();
        config.projects = config.projects.filter(p => p !== projectPath);
        this.saveConfig(config);
        return config;
    }
    getLogs(lines = 100) {
        try {
            if (fs.existsSync(this.logPath)) {
                const content = fs.readFileSync(this.logPath, 'utf-8');
                const allLines = content.split('\n');
                return allLines.slice(-lines).join('\n');
            }
        }
        catch {
        }
        return '';
    }
};
exports.StressorService = StressorService;
exports.StressorService = StressorService = StressorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], StressorService);
//# sourceMappingURL=stressor.service.js.map