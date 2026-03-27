import React, { useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Send, LogOut, Activity, User, ClipboardList, AlertTriangle } from 'lucide-react';
import { ERRoom, Avatar } from './components/Scene';
import { EvaluationScreen } from './components/EvaluationScreen';
import { GeminiLiveService } from './services/geminiService';
import { TranscriptEntry, ScenarioState, Evaluation, Vitals } from './types';
import { INITIAL_VITALS } from './constants';
import { cn } from './lib/utils';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 text-white p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Something went wrong.</h1>
          <p className="text-slate-400 mb-8">The application encountered an unexpected error.</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-blue-600 px-6 py-2 rounded-lg"
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [isStarted, setIsStarted] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [vitals, setVitals] = useState<Vitals>(INITIAL_VITALS);
  const [currentSpeaker, setCurrentSpeaker] = useState<string | null>(null);
  const [subtitle, setSubtitle] = useState<string>("");
  const [userInput, setUserInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [scenario, setScenario] = useState<ScenarioState>({
    patientAnxiety: 0.7,
    isEscalated: false,
    nurseIntervened: false,
    startTime: Date.now(),
    lastUserInteraction: Date.now(),
    missedQuestions: [],
    askedQuestions: [],
    mode: 'standard',
    timer: 30,
    liveScore: 0,
    guidancePrompt: "Introduce yourself to the patient and ask about their pain.",
  });

  const geminiRef = useRef<GeminiLiveService | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcript]);

  useEffect(() => {
    if (!isStarted || isEvaluating) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastInteraction = now - scenario.lastUserInteraction;
      const timeSinceStart = now - scenario.startTime;
      
      // Timer logic for guided/training mode
      if (scenario.mode !== 'standard' && isStarted && !isEvaluating) {
        setScenario(prev => {
          const newTimer = Math.max(0, prev.timer - 3);
          let newGuidance = prev.guidancePrompt;
          
          if (newTimer === 0 && !prev.nurseIntervened) {
            handleGeminiMessage("[Nurse] Doctor, we need to act. Should we get an EKG or start some oxygen?");
            return { ...prev, timer: 30, nurseIntervened: true, guidancePrompt: "Respond to the nurse's suggestion." };
          }
          
          return { ...prev, timer: newTimer };
        });
      }

      // Nurse intervention after 20 seconds of silence in standard mode
      if (scenario.mode === 'standard' && timeSinceLastInteraction > 20000 && !scenario.nurseIntervened) {
        handleGeminiMessage("[Nurse] Doctor, the patient seems to be getting more anxious. Should we start him on some oxygen or get that EKG?");
        setScenario(prev => ({ ...prev, nurseIntervened: true, lastUserInteraction: now }));
      }

      // Dynamic Anxiety Logic
      setScenario(prev => {
        let newAnxiety = prev.patientAnxiety;
        
        // Anxiety increases if user is silent
        if (timeSinceLastInteraction > 15000) {
          newAnxiety = Math.min(1, newAnxiety + 0.05);
        }
        
        // Anxiety decreases if attending is present
        if (prev.isEscalated) {
          newAnxiety = Math.max(0.3, newAnxiety - 0.02);
        }

        // Anxiety decreases over time if user has interacted recently
        if (timeSinceLastInteraction < 10000) {
          newAnxiety = Math.max(0.2, newAnxiety - 0.01);
        }

        return { ...prev, patientAnxiety: newAnxiety };
      });

      // Dynamic Vitals Calculation
      setVitals(prev => {
        const anxietyFactor = scenario.patientAnxiety;
        
        // HR: Base 90 + (anxiety * 40) + random fluctuation
        const targetHr = 90 + Math.floor(anxietyFactor * 40);
        const newHr = targetHr + (Math.floor(Math.random() * 5) - 2);

        // BP: Base 130/85 + (anxiety * 40/20)
        const sys = 130 + Math.floor(anxietyFactor * 40) + (Math.floor(Math.random() * 4) - 2);
        const dia = 85 + Math.floor(anxietyFactor * 20) + (Math.floor(Math.random() * 4) - 2);
        const newBp = `${sys}/${dia}`;

        // SpO2: Base 98 - (anxiety * 4). If oxygen mentioned, stays high.
        const hasOxygen = transcript.some(t => t.text.toLowerCase().includes('oxygen'));
        let newSpo2 = hasOxygen ? 98 + (Math.floor(Math.random() * 2)) : 98 - Math.floor(anxietyFactor * 5);
        newSpo2 = Math.min(100, Math.max(88, newSpo2));

        return {
          hr: newHr,
          bp: newBp,
          spo2: newSpo2,
        };
      });
    }, 3000); // Update every 3 seconds for better responsiveness

    return () => clearInterval(interval);
  }, [isStarted, isEvaluating, scenario.lastUserInteraction, scenario.nurseIntervened, scenario.patientAnxiety, scenario.isEscalated, transcript]);

  const handleGeminiMessage = (msg: string, forcedSpeaker?: string) => {
    const match = msg.match(/\[(.*?)\](.*)/);
    const speaker = forcedSpeaker || ((match && match[1]) ? match[1] : 'Patient');
    const text = (match && match[2]) ? match[2].trim() : msg;
    
    setTranscript(prev => {
      // If the last message was from the same speaker, update it instead of adding a new one
      // This allows for real-time streaming updates
      if (prev.length > 0 && prev[prev.length - 1].speaker === speaker.toLowerCase()) {
        const newTranscript = [...prev];
        newTranscript[newTranscript.length - 1] = {
          ...newTranscript[newTranscript.length - 1],
          text: text,
          timestamp: Date.now()
        };
        return newTranscript;
      }
      return [...prev, { speaker: speaker.toLowerCase() as any, text, timestamp: Date.now() }];
    });
    setCurrentSpeaker(speaker);
    setSubtitle(text);
    setScenario(prev => {
      // Live scoring logic
      const lowerText = text.toLowerCase();
      let scoreBoost = 0;
      let newGuidance = prev.guidancePrompt;

      if (speaker.toLowerCase() === 'user') {
        if (lowerText.includes('ekg') || lowerText.includes('electrocardiogram')) {
          scoreBoost += 20;
          newGuidance = "Great. Now ask about the quality of the pain (crushing, sharp, etc.)";
        }
        if (lowerText.includes('oxygen')) {
          scoreBoost += 15;
          newGuidance = "Good. Monitor his SpO2 levels.";
        }
        if (lowerText.includes('aspirin') || lowerText.includes('nitro')) {
          scoreBoost += 25;
          newGuidance = "Medication ordered. Keep talking to the patient to keep him calm.";
        }
        if (lowerText.includes('family') || lowerText.includes('history')) {
          scoreBoost += 10;
        }
      }

      return { 
        ...prev, 
        lastUserInteraction: Date.now(),
        timer: 30, // Reset timer on interaction
        liveScore: Math.min(100, prev.liveScore + scoreBoost),
        guidancePrompt: newGuidance
      };
    });
  };

  const startSimulation = async (mode: any = 'standard') => {
    try {
      setIsStarted(true);
      setScenario(prev => ({ ...prev, mode, startTime: Date.now(), lastUserInteraction: Date.now() }));
      
      geminiRef.current = new GeminiLiveService();
      await geminiRef.current.connect({
        onMessage: (text, speaker) => {
          handleGeminiMessage(text, speaker);
        },
        onAudioChunk: () => {},
        onInterrupted: () => {
          setSubtitle("");
          setCurrentSpeaker(null);
        }
      });

      // Initial trigger to make AI speak immediately
      await geminiRef.current.sendMessage(`[System] The simulation has started in ${mode} mode. You are the patient (Mr. Henderson, 58, chest pain) and occasionally the Nurse. Start the conversation by describing your pain and asking what's happening.`);
      
    } catch (error) {
      console.error("Failed to start simulation:", error);
      alert("Failed to connect to AI service. Please check your API key.");
      setIsStarted(false);
    }
  };

  const toggleListening = async () => {
    if (!isStarted || !geminiRef.current) return;

    try {
      if (!isListening) {
        await geminiRef.current.startAudioInput();
        setIsListening(true);
      } else {
        geminiRef.current.stopAudioInput();
        setIsListening(false);
      }
    } catch (error) {
      console.error("Microphone error:", error);
      alert("Could not access microphone. Please check permissions.");
      setIsListening(false);
    }
  };

  const handleSendMessage = async () => {
    if (!userInput.trim()) return;
    
    const entry: TranscriptEntry = { speaker: 'user', text: userInput, timestamp: Date.now() };
    setTranscript(prev => [...prev, entry]);
    setScenario(prev => ({ ...prev, lastUserInteraction: Date.now() }));
    
    if (geminiRef.current) {
      await geminiRef.current.sendMessage(userInput);
    }

    // Track asked questions for evaluation
    const lowerInput = userInput.toLowerCase();
    if (lowerInput.includes('pain') || lowerInput.includes('feel')) {
      setScenario(prev => ({ ...prev, askedQuestions: [...prev.askedQuestions, 'pain_assessment'] }));
    }
    if (lowerInput.includes('history') || lowerInput.includes('before')) {
      setScenario(prev => ({ ...prev, askedQuestions: [...prev.askedQuestions, 'medical_history'] }));
    }
    if (lowerInput.includes('doctor') || lowerInput.includes('attending') || lowerInput.includes('help')) {
      setScenario(prev => ({ ...prev, isEscalated: true }));
    }
    
    setUserInput("");
  };

  const endSimulation = () => {
    setIsEvaluating(true);
    if (geminiRef.current) geminiRef.current.disconnect();
  };

  const resetSimulation = () => {
    setIsStarted(false);
    setIsEvaluating(false);
    setTranscript([]);
    setVitals(INITIAL_VITALS);
    setSubtitle("");
    setCurrentSpeaker(null);
    setScenario(prev => ({
      ...prev,
      patientAnxiety: 0.7,
      isEscalated: false,
      nurseIntervened: false,
      startTime: Date.now(),
      lastUserInteraction: Date.now(),
      missedQuestions: [],
      askedQuestions: [],
      mode: 'standard',
      timer: 30,
      liveScore: 0,
      guidancePrompt: "Introduce yourself to the patient and ask about their pain.",
    }));
  };

  const calculateEvaluation = (): Evaluation => {
    const askedCount = scenario.askedQuestions.length;
    const hasEscalated = scenario.isEscalated;
    const nurseIntervened = scenario.nurseIntervened;
    
    const clarityScore = Math.max(scenario.liveScore, Math.min(100, 60 + (askedCount * 20)));
    const empathyScore = Math.max(0, Math.min(100, 100 - (scenario.patientAnxiety * 50)));
    const timingScore = nurseIntervened ? 65 : 95;

    const strengths = [];
    if (askedCount >= 2) strengths.push("Thorough patient assessment");
    if (hasEscalated) strengths.push("Timely escalation to attending");
    if (!nurseIntervened) strengths.push("Proactive management without nurse prompting");
    if (strengths.length === 0) strengths.push("Followed basic ER protocol");

    const improvements = [];
    if (askedCount < 2) improvements.push("Gather more detailed patient history");
    if (!hasEscalated) improvements.push("Consider earlier escalation for acute chest pain");
    if (nurseIntervened) improvements.push("Respond more quickly to patient distress cues");
    if (scenario.patientAnxiety > 0.5) improvements.push("Use more empathetic language to calm the patient");

    return {
      clarityScore,
      empathyScore,
      timingScore,
      strengths: strengths.slice(0, 3),
      improvements: improvements.slice(0, 3),
      transcript: transcript
    };
  };

  if (isEvaluating) {
    return <EvaluationScreen evaluation={calculateEvaluation()} onRestart={resetSimulation} />;
  }

  return (
    <ErrorBoundary>
      <div className="h-screen w-screen bg-slate-950 overflow-hidden flex flex-col font-sans text-slate-200">
      {/* Header */}
      <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="bg-red-500 p-2 rounded-lg">
            <Activity className="text-white w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-none">ER Simulator</h1>
            <p className="text-xs text-slate-500 uppercase tracking-widest mt-1">Training Prototype</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Guided Mode Info */}
          {scenario.mode !== 'standard' && isStarted && (
            <div className="flex items-center gap-6 px-4 py-2 bg-slate-800/50 rounded-full border border-slate-700">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-400" />
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Score</span>
                <span className="text-sm font-bold text-blue-400">{scenario.liveScore}%</span>
              </div>
              <div className="w-px h-4 bg-slate-700" />
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-amber-400" />
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Time</span>
                <span className={cn(
                  "text-sm font-bold",
                  scenario.timer < 10 ? "text-red-500 animate-pulse" : "text-amber-400"
                )}>{scenario.timer}s</span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 bg-slate-800/50 px-4 py-2 rounded-full border border-slate-700">
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-slate-500 uppercase">HR</span>
              <span className={cn("font-mono font-bold", vitals.hr > 100 ? "text-red-400" : "text-green-400")}>{vitals.hr}</span>
            </div>
            <div className="w-px h-6 bg-slate-700" />
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-slate-500 uppercase">BP</span>
              <span className={cn(
                "font-mono font-bold",
                (parseInt(vitals.bp.split('/')[0]) > 160 || parseInt(vitals.bp.split('/')[1]) > 100) ? "text-red-400" : "text-blue-400"
              )}>{vitals.bp}</span>
            </div>
            <div className="w-px h-6 bg-slate-700" />
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-slate-500 uppercase">SpO2</span>
              <span className={cn(
                "font-mono font-bold",
                vitals.spo2 < 92 ? "text-red-400" : "text-emerald-400"
              )}>{vitals.spo2}%</span>
            </div>
          </div>

          {isStarted && (
            <button 
              onClick={endSimulation}
              className="flex items-center gap-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 px-4 py-2 rounded-full border border-red-500/30 transition-colors text-sm font-semibold"
            >
              <LogOut size={16} /> End Session
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative">
        {/* 3D Viewport */}
        <div className="flex-1 relative bg-slate-900">
          {!isStarted ? (
            <div className="absolute inset-0 flex items-center justify-center z-20 bg-slate-900/80 backdrop-blur-sm">
              <div className="max-w-4xl text-center p-8 bg-slate-800 rounded-3xl border border-slate-700 shadow-2xl">
                <div className="w-20 h-20 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <User className="text-blue-500 w-10 h-10" />
                </div>
                <h2 className="text-2xl font-bold mb-4">Start Training Session</h2>
                
                {/* Patient Case History */}
                <div className="bg-slate-900/50 border border-slate-700 rounded-2xl p-6 mb-8 text-left">
                  <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <ClipboardList size={14} /> Patient Case History
                  </h3>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block mb-1">Patient</span>
                      <p className="text-sm font-medium">Arthur Henderson, 58</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block mb-1">Profession</span>
                      <p className="text-sm font-medium">Retired High School Teacher</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[10px] text-slate-500 uppercase block mb-1">Chief Complaint</span>
                      <p className="text-sm font-medium text-red-400">Acute "crushing" chest pain (10/10) for 30 minutes.</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[10px] text-slate-500 uppercase block mb-1">Situation</span>
                      <p className="text-sm text-slate-300 leading-relaxed">
                        Sudden onset while gardening. Pain radiates to left jaw and arm. 
                        Patient is diaphoretic (sweating) and highly anxious.
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block mb-1">Medical History</span>
                      <p className="text-sm text-slate-300">Hypertension, Smoker (1 pack/day)</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block mb-1">Initial Vitals</span>
                      <p className="text-sm text-slate-300 font-mono">HR 102, BP 150/95, SpO2 96%</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-400/10 p-3 rounded-xl mb-8 border border-amber-400/20">
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>This app requires microphone access for conversational training.</span>
                </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl mb-8">
            <button 
              onClick={() => startSimulation('standard')}
              className="group p-6 bg-slate-900/80 border border-slate-800 hover:border-blue-500 rounded-2xl transition-all text-left"
            >
              <Activity className="w-8 h-8 text-blue-500 mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-lg font-bold mb-2">Standard Mode</h3>
              <p className="text-sm text-slate-400">Open-ended simulation with no guidance. Best for experienced trainees.</p>
            </button>
            <button 
              onClick={() => startSimulation('guided')}
              className="group p-6 bg-slate-900/80 border border-slate-800 hover:border-amber-500 rounded-2xl transition-all text-left"
            >
              <ClipboardList className="w-8 h-8 text-amber-500 mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-lg font-bold mb-2">Guided Mode</h3>
              <p className="text-sm text-slate-400">Includes clinical prompts, a live score, and a response timer.</p>
            </button>
            <button 
              onClick={() => startSimulation('training')}
              className="group p-6 bg-slate-900/80 border border-slate-800 hover:border-red-500 rounded-2xl transition-all text-left"
            >
              <Mic className="w-8 h-8 text-red-500 mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-lg font-bold mb-2">Training Mode</h3>
              <p className="text-sm text-slate-400">Voice-only interaction. Hides text input to force verbal communication.</p>
            </button>
          </div>
              </div>
            </div>
          ) : null}

          <Canvas shadows>
            <PerspectiveCamera makeDefault position={[0, 1.7, 3]} fov={50} />
            <OrbitControls 
              target={[2, 1, -2]} 
              enablePan={false} 
              maxPolarAngle={Math.PI / 1.8}
              minDistance={1}
              maxDistance={6}
            />
            
            <ERRoom />
            
            {/* Patient */}
            <Avatar 
              label="Mr. Henderson (Patient)"
              position={[2, 0.6, -2]} 
              rotation={[0, -Math.PI / 4, 0]} 
              color="#3b82f6" 
              type="patient"
              isSpeaking={currentSpeaker?.toLowerCase() === 'patient'}
              isDistressed={scenario.patientAnxiety > 0.5}
            />

            {/* Nurse */}
            <Avatar 
              label="Nurse Sarah"
              position={[0.5, 0, -1.5]} 
              rotation={[0, Math.PI / 4, 0]} 
              color="#10b981" 
              type="nurse"
              isSpeaking={currentSpeaker?.toLowerCase() === 'nurse'}
            />

            {/* Attending (only if escalated) */}
            {scenario.isEscalated && (
              <Avatar 
                label="Dr. Miller (Attending)"
                position={[3.5, 0, 0]} 
                rotation={[0, -Math.PI / 2, 0]} 
                color="#8b5cf6" 
                type="attending"
                isSpeaking={currentSpeaker?.toLowerCase() === 'attending'}
              />
            )}
          </Canvas>

          {/* Subtitles */}
          <AnimatePresence>
            {subtitle && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute bottom-12 left-1/2 -translate-x-1/2 max-w-2xl w-full px-6 z-10"
              >
                <div className="bg-black/80 backdrop-blur-md p-4 rounded-2xl border border-white/10 text-center shadow-2xl">
                  <span className="text-[10px] uppercase tracking-widest text-blue-400 font-bold mb-1 block">
                    {currentSpeaker}
                  </span>
                  <p className="text-lg font-medium leading-relaxed">{subtitle}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sidebar */}
        <aside className="w-96 border-l border-slate-800 bg-slate-900/50 flex flex-col">
          {/* Status Panel */}
          <div className="p-6 border-b border-slate-800">
            {/* Guidance Panel */}
            {scenario.mode !== 'standard' && isStarted && (
              <div className="mb-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <ClipboardList className="w-4 h-4 text-blue-400" />
                  <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Clinical Guidance</span>
                </div>
                <p className="text-sm text-blue-100 italic leading-relaxed">"{scenario.guidancePrompt}"</p>
              </div>
            )}

            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
              <ClipboardList size={14} /> Scenario Status
            </h3>
            <div className="space-y-4">
              <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-slate-400">Patient Anxiety</span>
                  <span className="text-amber-400">High</span>
                </div>
                <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-amber-500 h-full w-3/4" />
                </div>
              </div>
              
              <div className="flex items-center gap-3 text-sm">
                <div className={cn("w-2 h-2 rounded-full", scenario.isEscalated ? "bg-green-500" : "bg-slate-600")} />
                <span className={scenario.isEscalated ? "text-slate-200" : "text-slate-500"}>Attending Notified</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className={cn("w-2 h-2 rounded-full", transcript.some(t => t.text.toLowerCase().includes('ekg')) ? "bg-green-500" : "bg-slate-600")} />
                <span className={transcript.some(t => t.text.toLowerCase().includes('ekg')) ? "text-slate-200" : "text-slate-500"}>EKG Ordered</span>
              </div>
            </div>
          </div>

          {/* Transcript */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin scrollbar-thumb-slate-700">
            {transcript.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 text-center">
                <AlertTriangle className="mb-2 opacity-20" size={48} />
                <p className="text-sm">Transcript will appear here once simulation starts.</p>
              </div>
            ) : (
              transcript.map((entry, i) => (
                <div key={i} className={cn(
                  "flex flex-col",
                  entry.speaker === 'user' ? "items-end" : "items-start"
                )}>
                  <span className="text-[9px] uppercase tracking-tighter text-slate-500 mb-1">
                    {entry.speaker}
                  </span>
                  <div className={cn(
                    "max-w-[85%] p-3 rounded-2xl text-sm",
                    entry.speaker === 'user' 
                      ? "bg-blue-600 text-white rounded-tr-none" 
                      : "bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700"
                  )}>
                    {entry.text}
                  </div>
                </div>
              ))
            )}
            <div ref={transcriptEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-6 bg-slate-900 border-t border-slate-800">
            {scenario.mode === 'training' && isStarted ? (
              <div className="flex flex-col items-center justify-center py-4 space-y-4">
                <div className="flex items-center gap-2 text-amber-400 bg-amber-400/10 px-3 py-1.5 rounded-full border border-amber-400/20">
                  <AlertTriangle size={12} />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Voice Training Mode</span>
                </div>
                <p className="text-[10px] text-slate-500 text-center max-w-[200px]">Text input disabled. Use your voice to communicate under pressure.</p>
                <button
                  onClick={toggleListening}
                  className={cn(
                    "w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300",
                    isListening 
                      ? "bg-red-600 shadow-[0_0_25px_rgba(220,38,38,0.5)] scale-110" 
                      : "bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-900/20"
                  )}
                >
                  {isListening ? <Mic size={32} className="text-white" /> : <MicOff size={32} className="text-white/50" />}
                </button>
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest animate-pulse">
                  {isListening ? "Listening..." : "Click to Speak"}
                </span>
              </div>
            ) : (
              <div className="relative">
                <input 
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type your response..."
                  disabled={!isStarted}
                  className="w-full bg-slate-800 border border-slate-700 rounded-2xl py-4 pl-4 pr-24 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button 
                    onClick={toggleListening}
                    disabled={!isStarted}
                    className={cn(
                      "p-2 rounded-xl transition-colors",
                      isListening ? "bg-red-500 text-white animate-pulse" : "text-slate-400 hover:text-white"
                    )}
                  >
                    {isListening ? <Mic size={20} /> : <MicOff size={20} />}
                  </button>
                  <button 
                    onClick={handleSendMessage}
                    disabled={!isStarted || !userInput.trim()}
                    className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-500 disabled:opacity-50"
                  >
                    <Send size={20} />
                  </button>
                </div>
              </div>
            )}
            <p className="text-[10px] text-slate-600 mt-3 text-center uppercase tracking-widest">
              {scenario.mode === 'training' ? "Voice Only" : "Press Enter to send • Voice input enabled"}
            </p>
          </div>
        </aside>
      </main>
    </div>
    </ErrorBoundary>
  );
}
