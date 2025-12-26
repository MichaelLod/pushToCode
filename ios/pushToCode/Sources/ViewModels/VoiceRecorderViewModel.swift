import Foundation
import Combine
import UIKit

@MainActor
final class VoiceRecorderViewModel: ObservableObject {
    @Published var transcribedText: String = ""
    @Published var isRecording = false
    @Published var isTranscribing = false
    @Published var recordingDuration: TimeInterval = 0
    @Published var audioLevel: Float = 0
    @Published var errorMessage: String?
    @Published var showPermissionAlert = false

    private let audioRecorder = AudioRecorderService.shared
    private let transcriptionService = TranscriptionService.shared
    private var cancellables = Set<AnyCancellable>()

    var onTranscriptionComplete: ((String) -> Void)?

    init() {
        setupBindings()
    }

    private func setupBindings() {
        audioRecorder.$isRecording
            .receive(on: DispatchQueue.main)
            .assign(to: &$isRecording)

        audioRecorder.$recordingDuration
            .receive(on: DispatchQueue.main)
            .assign(to: &$recordingDuration)

        audioRecorder.$audioLevel
            .receive(on: DispatchQueue.main)
            .assign(to: &$audioLevel)

        transcriptionService.$isTranscribing
            .receive(on: DispatchQueue.main)
            .assign(to: &$isTranscribing)
    }

    // MARK: - Recording

    func toggleRecording() {
        if isRecording {
            stopRecording()
        } else {
            startRecording()
        }
    }

    func startRecording() {
        guard !isRecording else { return }

        Task {
            // Check permission
            guard audioRecorder.hasPermission else {
                let granted = await audioRecorder.requestPermission()
                if !granted {
                    showPermissionAlert = true
                    return
                }
            }

            do {
                try audioRecorder.startRecording()
                transcribedText = "" // Clear previous transcription
                errorMessage = nil
            } catch {
                errorMessage = error.localizedDescription
                triggerHapticFeedback(.error)
            }
        }
    }

    func stopRecording() {
        guard isRecording else { return }

        audioRecorder.stopRecording()
        transcribeRecording()
    }

    func cancelRecording() {
        audioRecorder.cancelRecording()
        transcribedText = ""
    }

    // MARK: - Transcription

    private func transcribeRecording() {
        Task {
            do {
                let audioData = try audioRecorder.getRecordingData()
                let text = try await transcriptionService.transcribe(audioData: audioData)

                transcribedText = text
                triggerHapticFeedback(.success)

                // Clean up the recording file
                audioRecorder.deleteCurrentRecording()

            } catch {
                errorMessage = error.localizedDescription
                triggerHapticFeedback(.error)
            }
        }
    }

    // MARK: - Actions

    func sendTranscription() {
        guard !transcribedText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        onTranscriptionComplete?(transcribedText)
        transcribedText = ""
    }

    func clearTranscription() {
        transcribedText = ""
    }

    // MARK: - Haptics

    private func triggerHapticFeedback(_ type: UINotificationFeedbackGenerator.FeedbackType) {
        let generator = UINotificationFeedbackGenerator()
        generator.prepare()
        generator.notificationOccurred(type)
    }

    // MARK: - Formatting

    var formattedDuration: String {
        let minutes = Int(recordingDuration) / 60
        let seconds = Int(recordingDuration) % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
}
