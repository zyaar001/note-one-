import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import Markdown from 'react-markdown';
import { ArrowLeft, Trash2, Clock, BookOpen, Mic, Loader2, Square, MessageSquare, Send } from 'lucide-react';
import { generateAudioExplanation, chatAboutNote } from '../lib/gemini';

interface NoteData {
  title: string;
  originalContent: string;
  explanation: string;
  createdAt: any;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
}

export default function NoteDetail() {
  const { noteId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [note, setNote] = useState<NoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  // Audio state
  const [audioStatus, setAudioStatus] = useState<'idle' | 'loading' | 'playing'>('idle');
  const [voicePreference, setVoicePreference] = useState('GenZ Mix of English, Hindi & Urdu');
  const [audioSource, setAudioSource] = useState<AudioBufferSourceNode | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const abortAudioRef = useRef<AbortController | null>(null);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatting, setChatting] = useState(false);
  const abortChatRef = useRef<AbortController | null>(null);

  useEffect(() => {
    async function fetchNoteAndProfile() {
      if (!user || !noteId) return;
      try {
        // Fetch User Profile for Preferences
        const profileRef = doc(db, 'users', user.uid);
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
           const data = profileSnap.data();
           if (data.voicePreference) {
               setVoicePreference(data.voicePreference);
           }
        }

        // Fetch Note Data
        const docRef = doc(db, 'users', user.uid, 'notes', noteId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setNote(docSnap.data() as NoteData);
        } else {
          console.error("Note not found");
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchNoteAndProfile();
  }, [noteId, user]);

  const savePreference = async (newPref: string) => {
      if (!user) return;
      try {
          const profileRef = doc(db, 'users', user.uid);
          await setDoc(profileRef, {
              voicePreference: newPref,
              updatedAt: serverTimestamp()
          }, { merge: true });
      } catch (err) {
          console.error("Error saving preferences:", err);
      }
  };

  const handleDelete = async () => {
    if (!user || !noteId) return;
    if (!window.confirm("Are you sure you want to delete this note?")) return;
    
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'notes', noteId));
      navigate('/dashboard');
    } catch (err) {
      console.error("Error deleting note", err);
      setDeleting(false);
    }
  };

  const handleSpeak = async () => {
    // ... logic remains
    if (!note) return;
    
    if (audioStatus === 'playing') {
      audioSource?.stop();
      setAudioStatus('idle');
      return;
    }
    
    if (audioStatus === 'loading') {
      if (abortAudioRef.current) abortAudioRef.current.abort();
      setAudioStatus('idle');
      return;
    }
    
    setAudioStatus('loading');
    abortAudioRef.current = new AbortController();
    const currentSignal = abortAudioRef.current.signal;

    try {
      const base64Audio = await generateAudioExplanation(note.title, note.originalContent, voicePreference);
      if (currentSignal.aborted) throw new Error("AbortError");
      
      const binary = atob(base64Audio);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      
      const ctx = audioContext || new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      if (!audioContext) setAudioContext(ctx);
      
      const int16Array = new Int16Array(bytes.buffer);
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }
      
      const buffer = ctx.createBuffer(1, float32Array.length, 24000);
      buffer.copyToChannel(float32Array, 0);
      if (currentSignal.aborted) throw new Error("AbortError");
      
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = () => setAudioStatus('idle');
      
      source.start();
      setAudioSource(source);
      setAudioStatus('playing');
      
    } catch (err: any) {
      if (err.message === "AbortError") {
         console.log("Audio generation cancelled.");
         return;
      }
      console.error("Audio generation failed:", err);
      setAudioStatus('idle');
      alert("Audio generation failed. Please see console.");
    }
  };

  const handleChatSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !note) return;
    
    const userMsg = chatInput.trim();
    setChatInput('');
    const newMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: userMsg };
    setMessages(prev => [...prev, newMsg]);
    setChatting(true);

    abortChatRef.current = new AbortController();
    const currentSignal = abortChatRef.current.signal;

    try {
       const historyForApi = messages.map(m => ({ role: m.role, text: m.text }));
       const reply = await chatAboutNote(note.title, note.originalContent, note.explanation, historyForApi, userMsg);
       
       if (currentSignal.aborted) throw new Error("AbortError");
       setMessages(prev => [...prev, { id: Date.now().toString()+'_reply', role: 'model', text: reply }]);
    } catch (err: any) {
       if (err.message === "AbortError") {
         console.log("Chat aborted.");
         return;
       }
       console.error("Chat failure:", err);
       alert("Chat failed. See console.");
    } finally {
       setChatting(false);
    }
  };

  const handleStopChat = () => {
     if (abortChatRef.current) {
        abortChatRef.current.abort();
     }
  };

  if (loading) {
    return <div className="text-center py-20 text-gray-500">Loading explanation...</div>;
  }

  if (!note) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold mb-4">Note not found</h2>
        <Link to="/dashboard" className="text-blue-600 hover:underline">Return to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="mb-6">
        <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Notes
        </Link>
      </div>

      <div className="bg-white rounded-[16px] border border-slate-200 overflow-hidden shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)]">
        {/* Header Content */}
        <div className="border-b border-slate-200 bg-white p-8 md:p-10">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
            <div>
              <div className="text-[0.75rem] bg-slate-100 text-slate-500 px-2.5 py-1 rounded-[20px] font-semibold uppercase tracking-wider inline-block mb-3">
                GenAI Explanation
              </div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-800 mb-3">
                {note.title}
              </h1>
              <div className="flex items-center text-sm text-slate-500 gap-2 font-medium">
                <Clock className="w-4 h-4" />
                {note.createdAt?.toDate().toLocaleString()}
              </div>
            </div>
            
            <button 
              onClick={handleDelete}
              disabled={deleting}
              className="text-red-500 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-[10px] text-sm font-semibold transition-colors self-start flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>
        
        {/* Audio Control Section */}
        <div className="bg-indigo-50 border-y border-indigo-100 p-6 md:px-10 flex flex-col sm:flex-row gap-5 items-center justify-between">
          <div className="flex-1 w-full">
            <h4 className="font-semibold text-slate-800 text-[0.85rem] mb-1.5 flex items-center gap-2 uppercase tracking-wide">
              <Mic className="w-4 h-4 text-indigo-500" />
              Custom AI Voice Explainer
            </h4>
            <p className="text-xs text-slate-600 mb-3">
              A Grok-like persona that breaks this down for you. Adjust slang or languages below.
            </p>
            <input 
              type="text" 
              value={voicePreference} 
              onChange={(e) => setVoicePreference(e.target.value)}
              onBlur={(e) => savePreference(e.target.value)}
              className="w-full text-sm rounded-[8px] border-indigo-200 outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 px-3 py-2 bg-white"
              placeholder="e.g. GenZ Hinglish, formal Urdu..."
              disabled={audioStatus !== 'idle'}
            />
          </div>
          <button 
            onClick={handleSpeak}
            className={`w-full sm:w-auto px-6 py-2.5 rounded-[10px] text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-[0_2px_4px_-1px_rgba(0,0,0,0.05)]
              ${(audioStatus === 'playing' || audioStatus === 'loading') ? 'bg-red-500 hover:bg-red-600 text-white' : 
                'bg-indigo-500 hover:bg-indigo-600 text-white disabled:bg-indigo-300'}`}
          >
            {audioStatus === 'playing' ? (
              <>
                <Square className="w-4 h-4" /> Stop Playing
              </>
            ) : audioStatus === 'loading' ? (
              <>
                <Square className="w-4 h-4" /> Cancel Generation
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" /> Speak
              </>
            )}
          </button>
        </div>
        
        {/* Main Content */}
        <div className="p-8 md:p-10">
          <div className="markdown-body prose prose-blue max-w-none text-gray-800 leading-relaxed">
            <Markdown>{note.explanation}</Markdown>
          </div>
        </div>

        {/* Original Note Section */}
        <div className="border-t border-slate-200 bg-slate-50 p-8 md:px-10 py-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[0.75rem] font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> 
              Original Input
            </h3>
            {(note as any).pdfUrl && (
              <a 
                href={(note as any).pdfUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full transition-colors flex items-center gap-1.5 border border-indigo-100"
              >
                View PDF File
              </a>
            )}
          </div>
          <div className="bg-white border border-slate-200 rounded-[10px] p-5 text-[0.9rem] text-slate-600 font-mono whitespace-pre-wrap max-h-64 overflow-y-auto">
            {note.originalContent}
          </div>
        </div>
        
        {/* Chat Section */}
        <div className="border-t border-slate-200 p-8 md:px-10 bg-white">
          <h3 className="text-[0.75rem] font-semibold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-indigo-500" /> 
            Multilingual Follow-up Chat
          </h3>
          
          <div className="bg-slate-50 border border-slate-200 rounded-[12px] h-[350px] flex flex-col overflow-hidden">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center text-slate-500 text-sm mt-8 opacity-70">
                  Ask any question about this topic in English, Hindi, or Urdu!<br/>
                  Our Grok-style tutor is ready.
                </div>
              ) : (
                messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-[12px] px-4 py-2.5 text-[0.9rem] shadow-[0_2px_4px_-1px_rgba(0,0,0,0.05)] ${
                      msg.role === 'user' 
                        ? 'bg-indigo-500 text-white rounded-br-none' 
                        : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none'
                    }`}>
                      <div className="markdown-body prose-sm max-w-none [&>p]:mb-0 [&>p]:leading-normal">
                        <Markdown>{msg.text}</Markdown>
                      </div>
                    </div>
                  </div>
                ))
              )}
              {chatting && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-200 text-slate-500 rounded-[12px] rounded-bl-none px-4 py-2.5 text-sm shadow-[0_2px_4px_-1px_rgba(0,0,0,0.05)] flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Thinking...
                    </div>
                    <button 
                      onClick={handleStopChat}
                      className="ml-2 text-xs font-semibold text-red-500 hover:text-red-600 transition-colors bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-md flex items-center gap-1"
                    >
                      <Square className="w-3 h-3" /> Stop
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Input Form */}
            <form onSubmit={handleChatSend} className="border-t border-slate-200 bg-white p-3 flex gap-2">
              <input 
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                disabled={chatting}
                placeholder="Type your question..."
                className="flex-1 bg-slate-50 border border-slate-200 rounded-[8px] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
              <button 
                type="submit" 
                disabled={chatting || !chatInput.trim()}
                className="bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-300 text-white p-2 w-11 text-center rounded-[8px] transition-colors flex items-center justify-center shrink-0 shadow-[0_2px_4px_-1px_rgba(0,0,0,0.05)]"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
