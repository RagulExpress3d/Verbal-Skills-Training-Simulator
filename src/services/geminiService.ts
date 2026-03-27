import { GoogleGenAI, LiveServerMessage, Modality, ThinkingLevel } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";

export class GeminiLiveService {
  private ai: GoogleGenAI;
  private session: any = null;
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private stream: MediaStream | null = null;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  }

  private nextStartTime: number = 0;

  private audioWorkletUrl: string | null = null;

  async connect(callbacks: {
    onMessage: (text: string, speaker: string) => void;
    onAudioChunk: (base64: string) => void;
    onInterrupted: () => void;
  }) {
    this.audioContext = new AudioContext({ sampleRate: 24000 });
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    this.nextStartTime = this.audioContext.currentTime;

    this.session = await this.ai.live.connect({
      model: "gemini-3.1-flash-live-preview",
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } },
        },
      },
      callbacks: {
        onmessage: (message: LiveServerMessage) => {
          if (message.serverContent?.modelTurn?.parts) {
            for (const part of message.serverContent.modelTurn.parts) {
              if (part.text) {
                const match = part.text.match(/\[(.*?)\](.*)/);
                if (match && match[1] && match[2]) {
                  callbacks.onMessage(match[2].trim(), match[1].trim());
                } else {
                  callbacks.onMessage(part.text, 'Patient');
                }
              }
              if (part.inlineData?.data) {
                this.playAudioChunk(part.inlineData.data);
                callbacks.onAudioChunk(part.inlineData.data);
              }
            }
          }
          if (message.serverContent?.interrupted) {
            this.stopAudio();
            callbacks.onInterrupted();
          }
        },
      },
    });
  }

  async startAudioInput() {
    if (!this.audioContext || !this.session) return;
    
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = this.audioContext.createMediaStreamSource(this.stream);
      
      // Create AudioWorklet for PCM processing
      const workletCode = `
        class AudioProcessor extends AudioWorkletProcessor {
          process(inputs) {
            const input = inputs[0];
            if (input.length > 0) {
              const channelData = input[0];
              // Convert Float32 to Int16 PCM
              const pcmData = new Int16Array(channelData.length);
              for (let i = 0; i < channelData.length; i++) {
                pcmData[i] = Math.max(-1, Math.min(1, channelData[i])) * 0x7FFF;
              }
              this.port.postMessage(pcmData.buffer, [pcmData.buffer]);
            }
            return true;
          }
        }
        registerProcessor('audio-processor', AudioProcessor);
      `;
      
      this.audioWorkletUrl = URL.createObjectURL(new Blob([workletCode], { type: 'application/javascript' }));
      await this.audioContext.audioWorklet.addModule(this.audioWorkletUrl);
      
      this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-processor');
      this.workletNode.port.onmessage = (event) => {
        const arrayBuffer = event.data;
        const uint8Array = new Uint8Array(arrayBuffer);
        let binary = '';
        const len = uint8Array.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(uint8Array[i]);
        }
        const base64Data = btoa(binary);
        this.session.sendRealtimeInput({
          audio: { data: base64Data, mimeType: 'audio/pcm;rate=24000' }
        });
      };

      source.connect(this.workletNode);
    } catch (error) {
      console.error("Failed to start audio input:", error);
      throw error;
    }
  }

  stopAudioInput() {
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.audioWorkletUrl) {
      URL.revokeObjectURL(this.audioWorkletUrl);
      this.audioWorkletUrl = null;
    }
  }

  private playAudioChunk(base64: string) {
    if (!this.audioContext) return;
    
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    
    // Assuming 16-bit PCM from Gemini Live
    const floatData = new Float32Array(bytes.length / 2);
    for (let i = 0; i < floatData.length; i++) {
      const int = (bytes[i * 2 + 1] << 8) | bytes[i * 2];
      floatData[i] = (int >= 0x8000 ? int - 0x10000 : int) / 0x8000;
    }

    const buffer = this.audioContext.createBuffer(1, floatData.length, 24000);
    buffer.getChannelData(0).set(floatData);
    
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);
    
    const startTime = Math.max(this.nextStartTime, this.audioContext.currentTime);
    source.start(startTime);
    this.nextStartTime = startTime + buffer.duration;
  }

  private stopAudio() {
    // Simple way to stop current playback would be to close and recreate context
    // but for a prototype we'll just let it finish or handle it via nextStartTime
    this.nextStartTime = this.audioContext?.currentTime || 0;
  }

  async sendMessage(text: string) {
    if (this.session) {
      await this.session.sendRealtimeInput({ text });
    }
  }

  disconnect() {
    if (this.session) this.session.close();
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    if (this.audioContext) this.audioContext.close();
  }
}
