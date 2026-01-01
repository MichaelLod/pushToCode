export declare class TranscribeDto {
    language?: string;
    prompt?: string;
}
export declare class TranscribeResponseDto {
    text: string;
    duration?: number;
    language?: string;
}
export type TtsVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
export declare class TextToSpeechDto {
    text: string;
    voice?: TtsVoice;
    speed?: number;
}
