import React from 'react';
import { Evaluation, TranscriptEntry } from '../types';
import { motion } from 'motion/react';
import { CheckCircle2, AlertCircle, TrendingUp, Award } from 'lucide-react';

interface EvaluationScreenProps {
  evaluation: Evaluation;
  onRestart: () => void;
}

export const EvaluationScreen: React.FC<EvaluationScreenProps> = ({ evaluation, onRestart }) => {
  return (
    <div className="fixed inset-0 bg-slate-900/95 z-50 overflow-y-auto p-8 text-white font-sans">
      <div className="max-w-4xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-bold mb-2">Simulation Complete</h1>
          <p className="text-slate-400">Performance Review & Feedback</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <ScoreCard label="Clarity" score={evaluation.clarityScore} icon={<CheckCircle2 className="text-green-400" />} />
          <ScoreCard label="Empathy" score={evaluation.empathyScore} icon={<Award className="text-purple-400" />} />
          <ScoreCard label="Timing" score={evaluation.timingScore} icon={<TrendingUp className="text-blue-400" />} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <CheckCircle2 className="text-green-400" /> Strengths
            </h2>
            <ul className="space-y-2">
              {evaluation.strengths.map((s, i) => (
                <li key={i} className="text-slate-300">• {s}</li>
              ))}
            </ul>
          </div>
          <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <AlertCircle className="text-amber-400" /> Areas for Improvement
            </h2>
            <ul className="space-y-2">
              {evaluation.improvements.map((s, i) => (
                <li key={i} className="text-slate-300">• {s}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 mb-12">
          <h2 className="text-xl font-semibold mb-4">Transcript Analysis</h2>
          <div className="space-y-4 max-h-96 overflow-y-auto pr-4">
            {evaluation.transcript.map((entry, i) => (
              <div key={i} className="border-l-2 border-slate-700 pl-4 py-1">
                <span className="text-xs font-mono uppercase text-slate-500">{entry.speaker}</span>
                <p className="text-slate-200">{entry.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center pb-12">
          <button 
            onClick={onRestart}
            className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-full font-semibold transition-colors"
          >
            Start New Session
          </button>
        </div>
      </div>
    </div>
  );
};

const ScoreCard = ({ label, score, icon }: { label: string, score: number, icon: React.ReactNode }) => (
  <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 flex flex-col items-center">
    <div className="mb-2">{icon}</div>
    <span className="text-slate-400 text-sm uppercase tracking-wider">{label}</span>
    <span className="text-3xl font-bold">{score}%</span>
    <div className="w-full bg-slate-700 h-2 rounded-full mt-4 overflow-hidden">
      <motion.div 
        initial={{ width: 0 }}
        animate={{ width: `${score}%` }}
        className="bg-blue-500 h-full"
      />
    </div>
  </div>
);
