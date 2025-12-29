import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Rocket, Zap, Brain, Globe, MessageSquare, X, Send, 
  ChevronRight, Cpu, Activity, Wifi, Battery, Terminal, Shield, 
  ArrowUpRight, AlertTriangle, Key
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence } from "framer-motion";

// --- Types & Constants ---
interface Message {
  role: 'user' | 'model';
  text: string;
}

const CLUSTERS = [
  { id: 'mars', title: "MARS ARCHITECTURE", description: "Starship HLS integration complete. Population target: 1,000,000.", icon: <Rocket className="text-red-500" /> },
  { id: 'energy', title: "SOLAR MAXIMUM", description: "Tesla Energy deployment across Earth-Luna axis. Efficiency: 99.8%.", icon: <Zap className="text-yellow-400" /> },
  { id: 'neural', title: "BEYOND HUMAN", description: "Neuralink Telepathy v5. High-bandwidth telekinesis enabled.", icon: <Brain className="text-purple-500" /> },
  { id: 'ai', title: "GROK SENTIENCE", description: "Real-time truth engine. Universe logic: DECODED.", icon: <Cpu className="text-blue-400" /> },
  { id: 'internet', title: "VOID CONNECT", description: "Starlink deep-space relay. 100 Pbps cross-planetary mesh.", icon: <Globe className="text-cyan-400" /> },
  { id: 'transit', title: "SUB-ORBITAL LOOP", description: "London to Tokyo: 22 minutes. G-Force optimization: PASS.", icon: <ArrowUpRight className="text-green-400" /> }
];

// Fallback high-tech SVG for the GOAT
const FallbackAvatar = () => (
  <svg viewBox="0 0 100 100" className="w-full h-full text-cyan-500 p-4">
    <path d="M50 10 L85 35 L85 75 L50 95 L15 75 L15 35 Z" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M30 40 Q50 20 70 40" stroke="currentColor" strokeWidth="4" fill="none" />
    <circle cx="40" cy="50" r="3" fill="currentColor" />
    <circle cx="60" cy="50" r="3" fill="currentColor" />
    <path d="M20 30 L10 15 M80 30 L90 15" stroke="currentColor" strokeWidth="3" />
    <path d="M40 70 Q50 80 60 70" stroke="currentColor" strokeWidth="2" fill="none" />
  </svg>
);

// --- API Helper ---
const checkKey = async () => {
  if (typeof window !== 'undefined' && (window as any).aistudio?.hasSelectedApiKey) {
    return await (window as any).aistudio.hasSelectedApiKey();
  }
  return true; // Fallback for environments without the helper
};

const openKeyDialog = async () => {
  if (typeof window !== 'undefined' && (window as any).aistudio?.openSelectKey) {
    await (window as any).aistudio.openSelectKey();
  }
};

// --- Components ---
const CyberAvatar = ({ src, size = 60, loading = false }: { src?: string; size?: number; loading?: boolean }) => (
  <div className="relative group" style={{ width: size, height: size }}>
    <div className={`absolute inset-0 bg-cyan-500/10 sci-fi-panel ${loading ? 'animate-pulse' : ''}`}></div>
    <div className="relative z-10 w-full h-full overflow-hidden sci-fi-panel border-cyan-500/30 flex items-center justify-center bg-black">
      {src ? (
        <img src={src} alt="Cyber Elon" className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700 scale-110" />
      ) : (
        <FallbackAvatar />
      )}
    </div>
    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-red-600 rounded-full border-2 border-black flex items-center justify-center z-20">
      <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></div>
    </div>
  </div>
);

const BootSequence = ({ onComplete, onAvatarGenerated }: { onComplete: () => void; onAvatarGenerated: (url: string) => void }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<'key_needed' | 'generating' | 'ready'>('generating');
  
  useEffect(() => {
    const init = async () => {
      const hasKey = await checkKey();
      if (!hasKey) {
        setStatus('key_needed');
        return;
      }

      setStatus('generating');
      setLogs(["UPLINKING TO NEURAL_NET...", "ACCESSING GEMINI_IMAGE_PRO..."]);

      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
          model: 'gemini-3-pro-image-preview',
          contents: [{ parts: [{ text: "Stylized portrait of Elon Musk as a futuristic cybernetic GOAT, sleek carbon fiber horns, glowing neon cyan circuitry patterns on face, high-tech SpaceX suit, cinematic lighting, 8k resolution, photorealistic digital art, dark sci-fi background." }] }],
        });

        const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
        if (part?.inlineData) {
          onAvatarGenerated(`data:image/png;base64,${part.inlineData.data}`);
        }
      } catch (e) {
        console.warn("Avatar Gen failed, using fallback.", e);
        setLogs(prev => [...prev, "GEN_FAILURE: USING CACHED_IDENTITY."]);
      } finally {
        setLogs(prev => [...prev, "IDENTITY_SYNC_COMPLETE.", "BOOTING ELONGOAT.IO..."]);
        setTimeout(onComplete, 1500);
      }
    };

    init();
  }, [onComplete, onAvatarGenerated]);

  if (status === 'key_needed') {
    return (
      <div className="fixed inset-0 z-[1000] bg-black flex flex-col items-center justify-center p-10 font-mono">
        <div className="sci-fi-panel p-12 max-w-md w-full border-red-500/50 bg-red-950/10 text-center">
          <AlertTriangle className="mx-auto text-red-500 mb-6" size={48} />
          <h2 className="font-orbitron text-xl mb-4 text-white">API_KEY_REQUIRED</h2>
          <p className="text-white/40 text-xs mb-8">Access to high-fidelity neural image generation requires a valid API key from a paid GCP project.</p>
          <button 
            onClick={async () => {
              await openKeyDialog();
              window.location.reload();
            }}
            className="w-full py-4 bg-red-600 text-white font-orbitron text-xs sci-fi-panel hover:bg-red-500 flex items-center justify-center gap-3 transition-all"
          >
            <Key size={16} /> SELECT_API_KEY
          </button>
          <p className="mt-6 text-[9px] text-white/20">Refer to: ai.google.dev/gemini-api/docs/billing</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[1000] bg-black flex flex-col items-center justify-center font-mono p-10">
      <motion.div animate={{ scale: [1, 1.05, 1], opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 2 }} className="mb-16">
        <div className="w-32 h-32 sci-fi-panel border-cyan-500/40 flex items-center justify-center">
          <