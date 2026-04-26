import { Mic, MicOff, Send, Loader2, Volume2, RotateCcw, BookOpen, Lightbulb, Zap } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { explainConcept, generateSpeech } from './services/gemini';
import { Mode, QuizQuestion } from './types';

// Speech Recognition Type Definitions
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: {
      new (): SpeechRecognition;
    };
    webkitSpeechRecognition: {
      new (): SpeechRecognition;
    };
  }
}

export default function App() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<QuizQuestion[] | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedMode, setSelectedMode] = useState<Mode>('normal');
  const [currentQuizIndex, setCurrentQuizIndex] = useState(-1);
  const [quizResults, setQuizResults] = useState<Record<number, boolean>>({});

  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-KE';

      recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsRecording(false);
      };

      recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error', event.error);
        setIsRecording(false);
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };
    }
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      setInput('');
      recognitionRef.current?.start();
      setIsRecording(true);
    }
  };

  const handleAsk = async (mode: Mode = 'normal') => {
    if (!input.trim()) return;
    
    setLoading(true);
    setExplanation(null);
    setQuiz(null);
    setAudioBase64(null);
    setCurrentQuizIndex(-1);
    setQuizResults({});
    
    try {
      const response = await explainConcept(input, mode);
      setExplanation(response.text);
      if (response.quiz && response.quiz.length > 0) {
        setQuiz(response.quiz);
      }
      
      const audio = await generateSpeech(response.text);
      if (audio) {
        setAudioBase64(audio);
      }
    } catch (error) {
      console.error(error);
      setExplanation("Pole sana, I encountered an error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const playAudio = async () => {
    if (!audioBase64) return;
    
    try {
      const audioContent = atob(audioBase64);
      const buffer = new Uint8Array(audioContent.length);
      for (let i = 0; i < audioContent.length; i++) {
        buffer[i] = audioContent.charCodeAt(i);
      }

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const pcmData = new Int16Array(buffer.buffer);
      const float32Data = new Float32Array(pcmData.length);
      
      for (let i = 0; i < pcmData.length; i++) {
        float32Data[i] = pcmData[i] / 32768.0;
      }

      const audioBuffer = audioContext.createBuffer(1, float32Data.length, 24000);
      audioBuffer.getChannelData(0).set(float32Data);

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.start();
    } catch (e) {
      console.error("Failed to play audio:", e);
    }
  };

  const handleQuizAnswer = (index: number, option: string) => {
    if (quiz) {
      const isCorrect = option === quiz[index].correctAnswer;
      setQuizResults(prev => ({ ...prev, [index]: isCorrect }));
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text font-sans flex flex-col">
      {/* Header Navigation */}
      <nav className="flex justify-between items-center px-6 md:px-10 py-6 border-b border-brand-border bg-white sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-primary rounded-xl flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-xl"><BookOpen size={20} /></span>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Mwalimu AI</h1>
            <p className="text-[10px] uppercase tracking-widest text-brand-muted font-semibold tracking-wider">STEM Voice Tutor</p>
          </div>
        </div>
        <div className="flex items-center gap-4 md:gap-6">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-[10px] uppercase text-brand-muted font-bold">Language Mode</span>
            <span className="text-sm font-medium">English + Sheng + Swahili</span>
          </div>
          <div className="hidden sm:block h-10 w-[1px] bg-brand-border"></div>
          <button 
            onClick={() => {
              setExplanation(null);
              setInput('');
              setAudioBase64(null);
            }}
            className="p-2 hover:bg-brand-bg rounded-full transition-colors text-brand-muted hover:text-brand-text"
          >
            <RotateCcw size={20} />
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col md:flex-row gap-6 md:gap-8 p-4 md:p-10 max-w-7xl mx-auto w-full">
        {/* Sidebar / Stats */}
        <aside className="w-full md:w-64 flex flex-col gap-4">
          <div className="bg-white p-6 rounded-3xl border border-brand-border shadow-brand">
            <h3 className="text-xs font-bold text-brand-muted uppercase mb-4 tracking-wider">Active Learning</h3>
            <p className="text-lg font-bold leading-tight">
              {explanation ? "Ongoing Explanation" : "Ready for questions"}
            </p>
            <div className="mt-4 h-1.5 w-full bg-brand-bg rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-brand-primary rounded-full transition-all duration-1000" 
                animate={{ width: explanation ? '100%' : '5%' }}
              />
            </div>
            <p className="text-[11px] text-brand-muted mt-2">STEM curriculum standards</p>
          </div>

          <div className="bg-brand-primary p-6 rounded-3xl text-white shadow-brand">
            <h3 className="text-xs font-bold opacity-70 uppercase mb-4 tracking-wider">User Credits</h3>
            <p className="text-2xl font-bold">Free Trial Active</p>
            <button className="mt-4 w-full bg-white/20 py-2 rounded-xl text-xs font-bold hover:bg-white/30 transition-all">Daily usage reset in 12h</button>
          </div>

          <div className="hidden md:block space-y-2">
            <p className="text-[10px] uppercase font-bold text-brand-muted px-2">Popular Topics</p>
            {['Newton\'s Laws', 'Photosynthesis', 'Pythagoras', 'Acid & Bases'].map((topic) => (
              <button 
                key={topic}
                onClick={() => setInput(topic)}
                className="w-full text-left px-3 py-2 text-sm rounded-xl hover:bg-brand-accent transition-colors text-brand-muted hover:text-brand-text"
              >
                {topic}
              </button>
            ))}
          </div>
        </aside>

        {/* Chat/Interaction Container */}
        <div className="flex-1 flex flex-col bg-white rounded-[40px] border border-brand-border shadow-brand relative overflow-hidden">
          <div className="flex-1 p-6 md:p-8 overflow-y-auto scrollbar-hide flex flex-col min-h-[400px]">
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div 
                  key="loading"
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  exit={{ opacity: 0 }}
                  className="flex-1 flex flex-col items-center justify-center space-y-4"
                >
                  <Loader2 size={40} className="text-brand-primary animate-spin" />
                  <p className="text-brand-muted font-medium">Mwalimu is thinking...</p>
                </motion.div>
              ) : explanation ? (
                <motion.div 
                  key="content"
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-8"
                >
                  {/* Tutor Message */}
                  <div className="flex gap-4 max-w-full lg:max-w-[90%]">
                    <div className="w-10 h-10 rounded-full bg-brand-accent flex items-center justify-center flex-shrink-0">
                      <BookOpen size={20} className="text-brand-primary" />
                    </div>
                    <div className="bg-brand-accent p-6 rounded-r-[24px] rounded-bl-[24px] prose prose-sm prose-stone max-w-none">
                      <ReactMarkdown>{explanation}</ReactMarkdown>
                      
                      {audioBase64 && (
                        <div className="mt-4 flex gap-2">
                          <button 
                            onClick={playAudio}
                            className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-brand-border text-xs font-bold text-brand-primary shadow-sm hover:shadow-brand transition-all active:scale-95"
                          >
                            <Volume2 size={14} />
                            Listen to Explanation
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Quiz Section */}
                  {quiz && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.2 }}
                      className="bg-brand-bg rounded-3xl p-6 border border-brand-border space-y-6"
                    >
                      <h4 className="font-bold flex items-center gap-2 text-brand-primary">
                        <Zap size={18} />
                        Quick Check!
                      </h4>
                      <div className="space-y-8">
                        {quiz.map((q, i) => (
                          <div key={i} className="space-y-3">
                            <p className="font-semibold text-sm">Q{i+1}: {q.question}</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {q.options.map(opt => {
                                const isSelected = quizResults[i] !== undefined;
                                const isCorrect = opt === q.correctAnswer;
                                return (
                                  <button
                                    key={opt}
                                    disabled={isSelected}
                                    onClick={() => handleQuizAnswer(i, opt)}
                                    className={`p-3 rounded-xl text-left text-xs font-medium border transition-all ${
                                      isSelected
                                        ? isCorrect
                                          ? 'bg-green-100 border-green-300 text-green-700'
                                          : 'bg-red-50 border-red-200 text-red-600 opacity-60'
                                        : 'bg-white border-brand-border hover:border-brand-primary hover:bg-brand-accent'
                                    }`}
                                  >
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>
                            {quizResults[i] !== undefined && (
                              <p className="text-[11px] italic text-brand-muted">
                                {q.explanation}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>

                      {Object.keys(quizResults).length === quiz.length && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="pt-6 border-t border-brand-border text-center"
                        >
                          <div className="text-3xl font-bold text-brand-primary mb-2">
                            {Object.values(quizResults).filter(Boolean).length} / {quiz.length}
                          </div>
                          <p className="text-sm font-semibold text-brand-muted uppercase tracking-widest">
                            {Object.values(quizResults).filter(Boolean).length === quiz.length 
                              ? "Safi sana! You're a pro!" 
                              : "Good effort! Keep learning with Mwalimu."}
                          </p>
                        </motion.div>
                      )}
                    </motion.div>
                  )}

                  {/* Quick Actions Row */}
                  <div className="flex flex-wrap justify-center gap-3 py-4">
                    <button 
                      onClick={() => handleAsk('simplify')}
                      className="bg-brand-bg border border-brand-border px-5 py-2.5 rounded-2xl text-xs font-bold text-brand-text hover:border-brand-primary transition-all flex items-center gap-2 group"
                    >
                      <span className="text-brand-primary group-hover:scale-110 transition-transform">✨</span> Simplify Mode
                    </button>
                    <button 
                      onClick={() => handleAsk('example')}
                      className="bg-brand-bg border border-brand-border px-5 py-2.5 rounded-2xl text-xs font-bold text-brand-text hover:border-brand-primary transition-all flex items-center gap-2 group"
                    >
                      <span className="text-brand-primary group-hover:scale-110 transition-transform">📍</span> Kenyan Example
                    </button>
                    <button 
                      onClick={() => setExplanation(null)}
                      className="bg-brand-bg border border-brand-border px-5 py-2.5 rounded-2xl text-xs font-bold text-brand-text hover:border-brand-primary transition-all"
                    >
                      Ask Something Else
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="welcome"
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }}
                  className="flex-1 flex flex-col items-center justify-center text-center space-y-8"
                >
                  <div className="w-16 h-16 bg-brand-accent rounded-[24px] flex items-center justify-center text-brand-primary">
                    <BookOpen size={32} />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-3xl font-bold tracking-tight">Sasa! I am Mwalimu AI</h2>
                    <p className="text-brand-muted max-w-sm">
                      Explain any STEM concept to me in English, Swahili, or Sheng. Nilikuwa naku-wait!
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 pt-4">
                    {['Explain Gravity', 'Pythagoras ni nini?', 'Organic Chemistry mix', 'Speed vs Velocity'].map(txt => (
                      <button 
                        key={txt}
                        onClick={() => { setInput(txt); handleAsk('normal'); }}
                        className="px-4 py-2 bg-brand-bg border border-brand-border rounded-full text-xs font-medium hover:border-brand-primary hover:text-brand-primary transition-all"
                      >
                        {txt}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Input Bar */}
          <div className="bg-brand-bg border-t border-brand-border px-4 md:px-8 py-6 flex items-center gap-4">
            <button 
              onClick={toggleRecording}
              className={`w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg transition-all active:scale-95 flex-shrink-0 ${
                isRecording ? 'bg-red-500 animate-pulse' : 'bg-brand-primary shadow-brand-primary/20 hover:scale-105'
              }`}
            >
              {isRecording ? <MicOff size={24} /> : <Mic size={24} />}
            </button>
            <div className="flex-1 bg-white border border-brand-border rounded-2xl flex items-center px-4 md:px-6 h-14 shadow-inner">
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAsk(selectedMode)}
                placeholder="Ask Mwalimu anything in English or Sheng..." 
                className="flex-1 bg-transparent border-none outline-none text-sm text-brand-text font-medium"
              />
              <button 
                onClick={() => handleAsk(selectedMode)}
                disabled={!input.trim() || loading}
                className="ml-2 text-brand-primary font-bold text-sm uppercase tracking-wider hover:opacity-80 transition-opacity disabled:opacity-30"
              >
                Ask
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Status */}
      <footer className="px-6 md:px-10 py-4 flex flex-col sm:flex-row justify-between items-center text-[10px] sm:text-[11px] font-bold text-brand-muted uppercase tracking-[0.2em] gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
            <span>Gemini AI Connected</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
            <span>Voice Ready</span>
          </div>
        </div>
        <div>Kenya STEM Learning Context • 2026</div>
      </footer>
    </div>
  );
}
