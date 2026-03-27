export interface Vitals {
  hr: number;
  bp: string;
  spo2: number;
}

export type SimulationMode = 'standard' | 'guided' | 'training';

export interface ScenarioState {
  patientAnxiety: number; // 0 to 1
  isEscalated: boolean;
  nurseIntervened: boolean;
  startTime: number;
  lastUserInteraction: number;
  missedQuestions: string[];
  askedQuestions: string[];
  mode: SimulationMode;
  timer: number; // seconds remaining
  liveScore: number; // 0 to 100
  guidancePrompt: string;
}

export type CharacterType = 'patient' | 'nurse' | 'attending' | 'user';

export interface TranscriptEntry {
  speaker: CharacterType;
  text: string;
  timestamp: number;
}

export interface Evaluation {
  clarityScore: number;
  empathyScore: number;
  timingScore: number;
  strengths: string[];
  improvements: string[];
  transcript: TranscriptEntry[];
}
