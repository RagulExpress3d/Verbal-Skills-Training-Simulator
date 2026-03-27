export interface Vitals {
  hr: number;
  bp: string;
  spo2: number;
}

export interface ScenarioState {
  patientAnxiety: number; // 0 to 1
  isEscalated: boolean;
  nurseIntervened: boolean;
  startTime: number;
  lastUserInteraction: number;
  missedQuestions: string[];
  askedQuestions: string[];
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
