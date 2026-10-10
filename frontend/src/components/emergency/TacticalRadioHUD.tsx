import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  Radio,
  ChevronDown,
  Send,
  Volume2,
  Sparkles,
} from 'lucide-react';
import { soundFx } from '../../utils/soundFx';

interface RadioTransmission {
  id: string;
  sender: string;
  role: 'DISPATCH_HQ' | 'AMBULANCE' | 'RESCUE_BOAT';
  channel: string;
  message: string;
  timestamp: string;
}

const CHANNELS = [
  { id: 'CH1', name: 'CH 1 • 154.280 MHz', label: 'Tactical Flood Dispatch' },
  { id: 'CH2', name: 'CH 2 • 155.340 MHz', label: 'Medevac & Hospital Triage' },
  { id: 'CH3', name: 'CH 3 • 151.625 MHz', label: 'NDRF Boat & Air Ops' },
];

const INITIAL_TRANSMISSIONS: RadioTransmission[] = [
  {
    id: 'tx-1',
    sender: 'DISPATCH HQ',
    role: 'DISPATCH_HQ',
    channel: 'CH 1 • 154.280 MHz',
    message: 'All units, Karve Road underpass is submerged >0.6m. Proceed via Senapati Bapat road.',
    timestamp: '14:02',
  },
  {
    id: 'tx-2',
    sender: 'AMB-01 (ALS)',
    role: 'AMBULANCE',
    channel: 'CH 1 • 154.280 MHz',
    message: 'Copy HQ. Diverting approach towards Deccan Gymkhana. ETA 4 minutes.',
    timestamp: '14:03',
  },
];

interface TacticalRadioHUDProps {
  userRole?: 'ADMIN' | 'AMBULANCE';
  callsign?: string;
}

export const TacticalRadioHUD: React.FC<TacticalRadioHUDProps> = ({
  userRole = 'ADMIN',
  callsign = userRole === 'ADMIN' ? 'DISPATCH HQ' : 'AMB-01',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState(CHANNELS[0]);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [typedMsg, setTypedMsg] = useState('');
  const [audioLevel, setAudioLevel] = useState(0); // 0 to 100% volume
  const [micState, setMicState] = useState<'IDLE' | 'ACTIVE' | 'DENIED'>('IDLE');
  const [transmissions, setTransmissions] = useState<RadioTransmission[]>(INITIAL_TRANSMISSIONS);

  const radioChannelRef = useRef<BroadcastChannel | null>(null);
  const recognitionRef = useRef<any>(null);
  const activeTranscriptRef = useRef('');
  const isTransmittingRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Text-To-Speech audio readout
  const speakTransmission = (text: string) => {
    if (!('speechSynthesis' in window) || !text) return;
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 0.95;
      utterance.volume = 1.0;
      const voices = window.speechSynthesis.getVoices();
      const voice = voices.find((v) => v.lang.startsWith('en')) || voices[0];
      if (voice) utterance.voice = voice;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('SpeechSynthesis error:', e);
    }
  };

  // Cross-tab broadcast channel receiver
  useEffect(() => {
    try {
      const bc = new BroadcastChannel('hc05_tactical_radio');
      radioChannelRef.current = bc;
      bc.onmessage = (event) => {
        if (event.data && event.data.type === 'NEW_TRANSMISSION') {
          const tx = event.data.transmission;
          setTransmissions((prev) => [tx, ...prev.slice(0, 19)]);
          soundFx.playRogerBeep();

          // Auto-play audio voice readout on receiving dashboard!
          setTimeout(() => {
            speakTransmission(tx.message);
          }, 350);
        }
      };
    } catch {}

    return () => {
      if (radioChannelRef.current) radioChannelRef.current.close();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      stopAudioAnalyser();
    };
  }, []);

  // Real Hardware Audio Analyser for live mic volume levels
  const startAudioAnalyser = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      setMicState('ACTIVE');

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const checkVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
        animFrameRef.current = requestAnimationFrame(checkVolume);
      };
      checkVolume();
    } catch {
      setMicState('DENIED');
    }
  };

  const stopAudioAnalyser = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
  };

  // Request mic permission manually
  const handleRequestMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicState('ACTIVE');
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      setMicState('DENIED');
    }
  };

  // START TRANSMITTING (HOLD BUTTON / SPACEBAR)
  const handleStartTransmitting = () => {
    if (isTransmittingRef.current) return;
    isTransmittingRef.current = true;
    setIsTransmitting(true);
    activeTranscriptRef.current = '';
    setLiveTranscript('');

    soundFx.playSquelchBurst();
    startAudioAnalyser();

    // Start Web Speech Recognition
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = navigator.language || 'en-US';

        rec.onstart = () => {
          setMicState('ACTIVE');
        };

        rec.onresult = (ev: any) => {
          let interim = '';
          let final = '';
          for (let i = 0; i < ev.results.length; ++i) {
            if (ev.results[i].isFinal) {
              final += ev.results[i][0].transcript + ' ';
            } else {
              interim += ev.results[i][0].transcript;
            }
          }
          const fullText = (final + interim).trim();
          if (fullText) {
            activeTranscriptRef.current = fullText;
            setLiveTranscript(fullText);
          }
        };

        rec.onerror = (err: any) => {
          if (err?.error === 'not-allowed') {
            setMicState('DENIED');
          }
        };

        rec.start();
        recognitionRef.current = rec;
      } catch (e) {
        console.warn('SpeechRecognition failed to start:', e);
      }
    }
  };

  // STOP TRANSMITTING (RELEASE BUTTON / SPACEBAR)
  const handleStopTransmitting = (manualText?: string) => {
    if (!isTransmittingRef.current) return;
    isTransmittingRef.current = false;
    setIsTransmitting(false);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    stopAudioAnalyser();

    soundFx.playRogerBeep();

    const spokenVoice = activeTranscriptRef.current.trim();
    const typed = typedMsg.trim();

    let finalMessage = manualText || spokenVoice || typed;

    // Smart fallback if mic was silent or text empty
    if (!finalMessage) {
      finalMessage =
        userRole === 'ADMIN'
          ? 'Dispatch HQ: Road RD-0828 flooded >0.5m. Diverting all units via Bund Garden.'
          : `${callsign}: Copy HQ. Proceeding via safe corridor, ETA 3 minutes.`;
    }

    const newTx: RadioTransmission = {
      id: `tx-${Date.now()}`,
      sender: callsign,
      role: userRole === 'ADMIN' ? 'DISPATCH_HQ' : 'AMBULANCE',
      channel: selectedChannel.name,
      message: finalMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setTransmissions((prev) => [newTx, ...prev.slice(0, 19)]);
    setTypedMsg('');
    setLiveTranscript('');
    activeTranscriptRef.current = '';

    if (radioChannelRef.current) {
      radioChannelRef.current.postMessage({
        type: 'NEW_TRANSMISSION',
        transmission: newTx,
      });
    }
  };

  // Spacebar hold shortcut (with repeat guard)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.code === 'Space' &&
        (e.target as HTMLElement).tagName !== 'INPUT' &&
        (e.target as HTMLElement).tagName !== 'TEXTAREA' &&
        isExpanded
      ) {
        if (e.repeat) return;
        e.preventDefault();
        handleStartTransmitting();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (
        e.code === 'Space' &&
        (e.target as HTMLElement).tagName !== 'INPUT' &&
        (e.target as HTMLElement).tagName !== 'TEXTAREA' &&
        isExpanded
      ) {
        e.preventDefault();
        handleStopTransmitting();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isExpanded]);

  return (
    <div className="fixed bottom-4 right-4 z-40 select-none">
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="w-84 sm:w-96 bg-slate-950/95 backdrop-blur-2xl text-white rounded-3xl shadow-2xl border border-slate-800 p-5 mb-3 overflow-hidden"
          >
            {/* Top Tactical Radio Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
                  <Radio className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-extrabold text-xs tracking-wider uppercase text-slate-200">
                    Tactical Radio PTT
                  </h4>
                  <span className="text-[10px] font-mono text-amber-400 font-bold">
                    {selectedChannel.name}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {micState === 'DENIED' ? (
                  <button
                    onClick={handleRequestMic}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 font-bold flex items-center gap-1 cursor-pointer"
                    title="Microphone blocked. Click to grant browser access."
                  >
                    <MicOff className="w-3 h-3 text-red-400" />
                    Mic Blocked
                  </button>
                ) : (
                  <button
                    onClick={handleRequestMic}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-bold flex items-center gap-1 cursor-pointer"
                    title="Click to verify physical microphone device"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    MIC LIVE
                  </button>
                )}

                <button
                  onClick={() => setIsExpanded(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Channel Selector Pills */}
            <div className="grid grid-cols-3 gap-1.5 my-3">
              {CHANNELS.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => setSelectedChannel(ch)}
                  className={`py-1.5 px-2 rounded-xl text-[10px] font-bold text-center transition-all truncate cursor-pointer ${
                    selectedChannel.id === ch.id
                      ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
                  }`}
                  title={ch.label}
                >
                  {ch.id} • {ch.label.split(' ')[0]}
                </button>
              ))}
            </div>

            {/* Radio Log Stream with Voice Playback */}
            <div className="h-36 overflow-y-auto space-y-2 p-2 bg-slate-900/80 rounded-2xl border border-slate-800 text-xs font-mono my-3">
              {transmissions.map((tx) => (
                <div key={tx.id} className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] group">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                    <span className="font-bold text-amber-400">{tx.sender}</span>
                    <div className="flex items-center gap-2">
                      <span>{tx.timestamp}</span>
                      <button
                        onClick={() => speakTransmission(tx.message)}
                        className="text-slate-400 hover:text-amber-300 p-0.5 rounded transition-colors cursor-pointer"
                        title="Read transmission aloud via vehicle speaker"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-slate-200 font-sans text-xs leading-relaxed">{tx.message}</p>
                </div>
              ))}
            </div>

            {/* LIVE VOICE & AUDIO WAVEFORM FEEDBACK */}
            {isTransmitting && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-400/40 text-xs text-amber-300 space-y-1.5"
              >
                <div className="flex items-center justify-between text-[10px] uppercase font-bold text-amber-400">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                    Transmitting Radio Frequency...
                  </span>
                  <span className="font-mono text-emerald-400">Mic Vol: {audioLevel}%</span>
                </div>

                {/* Real physical audio volume wave meter */}
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-emerald-500 via-amber-400 to-red-500 h-full transition-all duration-75"
                    style={{ width: `${Math.max(8, audioLevel)}%` }}
                  />
                </div>

                {/* Recognized text preview */}
                <div className="font-medium text-white truncate">
                  {liveTranscript ? (
                    <span className="text-emerald-300 font-bold">"{liveTranscript}"</span>
                  ) : (
                    <span className="text-slate-400 italic">Listening... Speak into microphone</span>
                  )}
                </div>
              </motion.div>
            )}

            {/* PTT HOLD-TO-TRANSMIT BUTTON */}
            <div className="space-y-2">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onMouseDown={handleStartTransmitting}
                onMouseUp={() => handleStopTransmitting()}
                onTouchStart={handleStartTransmitting}
                onTouchEnd={() => handleStopTransmitting()}
                className={`w-full py-4 rounded-2xl font-black text-xs tracking-wider uppercase transition-all shadow-xl flex items-center justify-center gap-2 cursor-pointer ${
                  isTransmitting
                    ? 'bg-red-600 text-white ring-4 ring-red-500/40 animate-pulse'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                }`}
              >
                <Mic className={`w-4 h-4 ${isTransmitting ? 'text-white' : 'text-slate-950'}`} />
                <span>
                  {isTransmitting ? 'TRANSMITTING (RELEASE TO SEND)' : 'HOLD TO TRANSMIT (OR SPACEBAR)'}
                </span>
              </motion.button>

              {/* Quick Preset Buttons for Instant Testing */}
              <div className="flex items-center gap-1 pt-1 overflow-x-auto text-[10px] text-slate-400">
                <span className="shrink-0 flex items-center gap-1 text-[9px] font-bold text-slate-500">
                  <Sparkles className="w-2.5 h-2.5 text-amber-400" /> Quick Callout:
                </span>
                {[
                  'Road flooded >0.6m. Diverting.',
                  'Patient loaded. En route hospital.',
                  'Grid impassable. Requesting NDRF boat.',
                ].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => handleStopTransmitting(preset)}
                    className="shrink-0 px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 truncate max-w-[140px] cursor-pointer"
                    title={preset}
                  >
                    {preset.split('.')[0]}
                  </button>
                ))}
              </div>

              {/* Text Backup Callout */}
              <div className="relative mt-2">
                <input
                  type="text"
                  value={typedMsg}
                  onChange={(e) => setTypedMsg(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleStopTransmitting(typedMsg);
                    }
                  }}
                  placeholder="Or type radio callout and hit Enter..."
                  className="w-full pl-3 pr-9 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans"
                />
                <button
                  onClick={() => handleStopTransmitting(typedMsg)}
                  className="absolute right-2 top-2 p-1 text-amber-400 hover:text-amber-300 cursor-pointer"
                  title="Send callout"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsed Pill Button */}
      <motion.button
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 px-4 py-2.5 bg-slate-950/90 backdrop-blur-xl border border-slate-800 text-white rounded-full shadow-2xl hover:border-amber-400/50 transition-all cursor-pointer group"
      >
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
        <Radio className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-xs font-black tracking-wide">RADIO PTT</span>
        <span className="text-[10px] font-mono text-amber-400">({selectedChannel.id})</span>
      </motion.button>
    </div>
  );
};
