import SwiftUI

struct VoiceRecorderView: View {
    @ObservedObject var viewModel: VoiceRecorderViewModel

    var body: some View {
        VStack(spacing: 20) {
            // Audio Visualizer
            audioVisualizer

            // Recording/Transcribing Status
            statusView

            // Transcribed Text
            if !viewModel.transcribedText.isEmpty {
                transcriptionEditor
            }

            // Controls
            controlsView
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .cornerRadius(20)
        .alert("Microphone Access Required", isPresented: $viewModel.showPermissionAlert) {
            Button("Open Settings") {
                if let url = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(url)
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Please enable microphone access in Settings to use voice recording.")
        }
    }

    private var audioVisualizer: some View {
        ZStack {
            // Background circle
            Circle()
                .fill(viewModel.isRecording ? Color.red.opacity(0.2) : Color.gray.opacity(0.1))
                .frame(width: 120, height: 120)

            // Animated rings
            if viewModel.isRecording {
                ForEach(0..<3, id: \.self) { index in
                    Circle()
                        .stroke(Color.red.opacity(0.3), lineWidth: 2)
                        .frame(width: 120 + CGFloat(index) * 20, height: 120 + CGFloat(index) * 20)
                        .scaleEffect(1 + CGFloat(viewModel.audioLevel) * 0.2)
                        .animation(
                            .easeInOut(duration: 0.1),
                            value: viewModel.audioLevel
                        )
                }
            }

            // Microphone icon
            Image(systemName: viewModel.isRecording ? "mic.fill" : "mic")
                .font(.system(size: 40))
                .foregroundColor(viewModel.isRecording ? .red : .gray)
        }
    }

    private var statusView: some View {
        VStack(spacing: 8) {
            if viewModel.isRecording {
                HStack {
                    Circle()
                        .fill(Color.red)
                        .frame(width: 8, height: 8)
                    Text("Recording")
                        .font(.headline)
                        .foregroundColor(.red)
                }

                Text(viewModel.formattedDuration)
                    .font(.system(.title, design: .monospaced))
                    .foregroundColor(.secondary)

            } else if viewModel.isTranscribing {
                HStack {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle())
                    Text("Transcribing...")
                        .font(.headline)
                        .foregroundColor(.blue)
                }
            } else {
                Text("Tap to record")
                    .font(.headline)
                    .foregroundColor(.secondary)
            }
        }
    }

    private var transcriptionEditor: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Transcription")
                .font(.caption)
                .foregroundColor(.secondary)

            TextEditor(text: $viewModel.transcribedText)
                .font(.body)
                .frame(minHeight: 80, maxHeight: 150)
                .padding(8)
                .background(Color(.tertiarySystemBackground))
                .cornerRadius(8)

            HStack {
                Button {
                    viewModel.clearTranscription()
                } label: {
                    Label("Clear", systemImage: "xmark.circle")
                        .font(.callout)
                }
                .foregroundColor(.red)

                Spacer()

                Button {
                    viewModel.sendTranscription()
                } label: {
                    Label("Send", systemImage: "arrow.up.circle.fill")
                        .font(.callout)
                        .fontWeight(.semibold)
                }
                .foregroundColor(.blue)
                .disabled(viewModel.transcribedText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
    }

    private var controlsView: some View {
        HStack(spacing: 40) {
            // Cancel button
            if viewModel.isRecording {
                Button {
                    viewModel.cancelRecording()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 44))
                        .foregroundColor(.gray)
                }
            }

            // Record/Stop button
            Button {
                viewModel.toggleRecording()
            } label: {
                ZStack {
                    Circle()
                        .fill(viewModel.isRecording ? Color.red : Color.blue)
                        .frame(width: 64, height: 64)

                    if viewModel.isRecording {
                        RoundedRectangle(cornerRadius: 4)
                            .fill(Color.white)
                            .frame(width: 24, height: 24)
                    } else {
                        Circle()
                            .fill(Color.white)
                            .frame(width: 24, height: 24)
                    }
                }
            }
            .disabled(viewModel.isTranscribing)

            // Placeholder for symmetry
            if viewModel.isRecording {
                Color.clear
                    .frame(width: 44, height: 44)
            }
        }
    }
}

#Preview {
    VoiceRecorderView(viewModel: VoiceRecorderViewModel())
        .padding()
}
