import Foundation
import AVFoundation
import UIKit

enum AudioRecorderError: Error, LocalizedError {
    case permissionDenied
    case recordingFailed(String)
    case noRecording
    case exportFailed(String)

    var errorDescription: String? {
        switch self {
        case .permissionDenied:
            return "Microphone permission denied"
        case .recordingFailed(let reason):
            return "Recording failed: \(reason)"
        case .noRecording:
            return "No recording available"
        case .exportFailed(let reason):
            return "Export failed: \(reason)"
        }
    }
}

final class AudioRecorderService: NSObject, ObservableObject {
    static let shared = AudioRecorderService()

    @Published private(set) var isRecording = false
    @Published private(set) var recordingDuration: TimeInterval = 0
    @Published private(set) var audioLevel: Float = 0

    private var audioRecorder: AVAudioRecorder?
    private var levelTimer: Timer?
    private var durationTimer: Timer?
    private var currentRecordingURL: URL?

    private let audioSettings: [String: Any] = [
        AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
        AVSampleRateKey: 16000,  // Whisper compatible
        AVNumberOfChannelsKey: 1,
        AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue
    ]

    override init() {
        super.init()
        setupAudioSession()
    }

    // MARK: - Audio Session

    private func setupAudioSession() {
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker, .allowBluetooth])
            try session.setActive(true)
        } catch {
            print("Failed to setup audio session: \(error)")
        }
    }

    // MARK: - Permissions

    func requestPermission() async -> Bool {
        return await withCheckedContinuation { continuation in
            AVAudioSession.sharedInstance().requestRecordPermission { granted in
                continuation.resume(returning: granted)
            }
        }
    }

    var hasPermission: Bool {
        AVAudioSession.sharedInstance().recordPermission == .granted
    }

    // MARK: - Recording

    func startRecording() throws {
        guard hasPermission else {
            throw AudioRecorderError.permissionDenied
        }

        // Create temp file for recording
        let tempDir = FileManager.default.temporaryDirectory
        let fileName = "recording_\(UUID().uuidString).m4a"
        let fileURL = tempDir.appendingPathComponent(fileName)

        // Clean up any existing recording
        stopRecording()

        do {
            audioRecorder = try AVAudioRecorder(url: fileURL, settings: audioSettings)
            audioRecorder?.delegate = self
            audioRecorder?.isMeteringEnabled = true
            audioRecorder?.prepareToRecord()

            if audioRecorder?.record() == true {
                currentRecordingURL = fileURL
                isRecording = true
                recordingDuration = 0
                startTimers()

                // Haptic feedback on start
                triggerHapticFeedback(.medium)
            } else {
                throw AudioRecorderError.recordingFailed("Failed to start recording")
            }
        } catch {
            throw AudioRecorderError.recordingFailed(error.localizedDescription)
        }
    }

    func stopRecording() {
        guard isRecording else { return }

        audioRecorder?.stop()
        stopTimers()
        isRecording = false

        // Haptic feedback on stop
        triggerHapticFeedback(.light)
    }

    func cancelRecording() {
        stopRecording()
        deleteCurrentRecording()
    }

    // MARK: - Audio Data

    func getRecordingData() throws -> Data {
        guard let url = currentRecordingURL else {
            throw AudioRecorderError.noRecording
        }

        do {
            return try Data(contentsOf: url)
        } catch {
            throw AudioRecorderError.exportFailed(error.localizedDescription)
        }
    }

    func getRecordingURL() -> URL? {
        return currentRecordingURL
    }

    func deleteCurrentRecording() {
        guard let url = currentRecordingURL else { return }

        try? FileManager.default.removeItem(at: url)
        currentRecordingURL = nil
    }

    // MARK: - Timers

    private func startTimers() {
        levelTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            self?.updateAudioLevel()
        }

        durationTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            self?.updateDuration()
        }
    }

    private func stopTimers() {
        levelTimer?.invalidate()
        levelTimer = nil
        durationTimer?.invalidate()
        durationTimer = nil
    }

    private func updateAudioLevel() {
        guard let recorder = audioRecorder, recorder.isRecording else { return }
        recorder.updateMeters()
        let level = recorder.averagePower(forChannel: 0)
        // Normalize from dB (-160 to 0) to 0-1 range
        audioLevel = max(0, min(1, (level + 50) / 50))
    }

    private func updateDuration() {
        guard let recorder = audioRecorder else { return }
        recordingDuration = recorder.currentTime
    }

    // MARK: - Haptics

    private func triggerHapticFeedback(_ style: UIImpactFeedbackGenerator.FeedbackStyle) {
        let generator = UIImpactFeedbackGenerator(style: style)
        generator.prepare()
        generator.impactOccurred()
    }
}

// MARK: - AVAudioRecorderDelegate

extension AudioRecorderService: AVAudioRecorderDelegate {
    func audioRecorderDidFinishRecording(_ recorder: AVAudioRecorder, successfully flag: Bool) {
        if !flag {
            print("Recording finished unsuccessfully")
            deleteCurrentRecording()
        }
    }

    func audioRecorderEncodeErrorDidOccur(_ recorder: AVAudioRecorder, error: Error?) {
        print("Recording encode error: \(error?.localizedDescription ?? "unknown")")
        stopRecording()
        deleteCurrentRecording()
    }
}
