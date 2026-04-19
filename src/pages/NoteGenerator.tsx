import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Sparkles, Loader2, FileUp, X, Square, Mic, Volume2 } from 'lucide-react';
import { explainNote, generateEnhancedVoiceExplainer } from '../lib/gemini';

export default function NoteGenerator() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Voice explainer states
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voicePlaying, setVoicePlaying] = useState(false);
  const [audioSource, setAudioSource] = useState<AudioBufferSourceNode | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const abortVoiceRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (audioSource) audioSource.stop();
      if (audioContext) audioContext.close();
    }
  }, [audioSource, audioContext]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.type === 'application/pdf') {
        setPdfFile(file);
        setError(null);
      } else {
        setError('Please upload a valid PDF file.');
      }
    }
  };

  const removeFile = () => {
    setPdfFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCancelCommand = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setGenerating(false);
  };

  const handleVoiceExplanation = async () => {
    if (!title.trim() && !notes.trim() && !pdfFile) {
        setError("Please provide a topic, notes, or PDF first.");
        return;
    }

    if (voicePlaying) {
         audioSource?.stop();
         setVoicePlaying(false);
         return;
    }
    if (voiceLoading) {
         if (abortVoiceRef.current) abortVoiceRef.current.abort();
         setVoiceLoading(false);
         return;
    }

    setVoiceLoading(true);
    setError(null);
    abortVoiceRef.current = new AbortController();
    const currentSignal = abortVoiceRef.current.signal;

    try {
       let fileData = undefined;
       if (pdfFile) {
            const base64Str = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve((reader.result as string).split(',')[1]);
              reader.onerror = reject;
              reader.readAsDataURL(pdfFile);
            });
            if (currentSignal.aborted) throw new Error("AbortError");
            fileData = { base64: base64Str, mimeType: pdfFile.type };
       }

       const base64Audio = await generateEnhancedVoiceExplainer(title, notes, fileData);
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
       source.onended = () => {
           setVoicePlaying(false);
       };
       
       source.start();
       setAudioSource(source);
       setVoicePlaying(true);
       setVoiceLoading(false);
    } catch (err: any) {
       if (err.message === "AbortError" || err.name === "AbortError") {
          console.log("Voice aborted");
          return;
       }
       console.error("Voice explainer failed:", err);
       setError("Voice generation failed. Please check the specific file or size.");
       setVoiceLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (generating) return;
    
    if (!title.trim() || (!notes.trim() && !pdfFile)) {
      setError("Please provide a title and either notes or a PDF document.");
      return;
    }

    if (!user) {
        setError("You must be logged in to generate notes.");
        return;
    }

    setGenerating(true);
    setError(null);
    
    abortControllerRef.current = new AbortController();
    const currentSignal = abortControllerRef.current.signal;

    try {
      let fileData = undefined;
      let pdfUrl = undefined;
      let pdfName = undefined;
      let explanation = "";

      if (pdfFile) {
        // Read file to base64
        const base64Str = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(pdfFile);
        });
        
        if (currentSignal.aborted) throw new Error("AbortError");

        fileData = {
          base64: base64Str,
          mimeType: pdfFile.type
        };

        // We run Gemini text extraction and Firebase storage upload in parallel to speed up operation execution substantially
        const storageUploadPromise = (async () => {
           const storageRef = ref(storage, `users/${user.uid}/pdfs/${Date.now()}_${pdfFile.name}`);
           await uploadBytes(storageRef, pdfFile);
           if (currentSignal.aborted) throw new Error("AbortError");
           const url = await getDownloadURL(storageRef);
           return { url, name: pdfFile.name };
        })();
        
        // 1. Generate explanation via Gemini
        const explanationPromise = explainNote(title, notes, fileData);

        const [storageResult, expl] = await Promise.all([
          storageUploadPromise.catch(err => {
            if (err.message === "AbortError") throw err;
             console.error("Storage upload failed:", err);
             return null;
          }),
          explanationPromise
        ]);

        if (currentSignal.aborted) throw new Error("AbortError");
        
        explanation = expl;
        if (storageResult) {
           pdfUrl = storageResult.url;
           pdfName = storageResult.name;
        }
      } else {
        // No PDF, just await explainNote
        explanation = await explainNote(title, notes, undefined);
        if (currentSignal.aborted) throw new Error("AbortError");
      }

      // 2. Save to Firestore
      const notesRef = collection(db, 'users', user.uid, 'notes');
      const newNote: any = {
        title,
        originalContent: notes || `PDF Document attached: ${pdfFile?.name}`,
        explanation,
        ownerId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      if (pdfUrl) newNote.pdfUrl = pdfUrl;
      if (pdfName) newNote.pdfName = pdfName;
      
      const docRef = await addDoc(notesRef, newNote);
      
      if (currentSignal.aborted) throw new Error("AbortError");

      // 3. Navigate to detail page
      navigate(`/notes/${docRef.id}`);
    } catch (err: any) {
      if (err.message === "AbortError" || err.name === "AbortError") {
        console.log("Generation cancelled by user.");
        return;
      }
      console.error(err);
      setError("Failed to generate explanation. Please try again.");
      setGenerating(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2 text-slate-800">New Note Explanation</h1>
        <p className="text-slate-500">Provide the topic name and the raw notes or text you want to understand.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 sm:p-8 rounded-[16px] border border-slate-200 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)]">
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm border border-red-100">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="title" className="block text-sm font-semibold text-slate-800 mb-1.5">
            Topic or Chapter Title
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-[10px] border border-slate-200 px-4 py-3 text-[0.95rem] focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
            placeholder="e.g. Thermodynamics, Cellular Respiration..."
            disabled={generating}
          />
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-semibold text-slate-800 mb-1.5">
            Original Notes / Text to Explain
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={5}
            className="w-full rounded-[10px] border border-slate-200 px-4 py-3 text-[0.95rem] focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors resize-y mb-3"
            placeholder="Paste your dense lecture notes or textbook excerpt here..."
            disabled={generating}
          />
          
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                ref={fileInputRef}
                className="hidden"
                id="pdf-upload"
                disabled={generating}
              />
              <label 
                htmlFor="pdf-upload" 
                className={`flex items-center justify-center gap-2 w-full border-2 border-dashed border-slate-300 rounded-[10px] p-4 cursor-pointer transition-colors hover:border-indigo-400 hover:bg-slate-50 ${generating ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <FileUp className="w-5 h-5 text-indigo-500" />
                <span className="text-sm font-medium text-slate-600">
                  Or attach a PDF Document
                </span>
              </label>
            </div>
          </div>
          
          {pdfFile && (
            <div className="mt-3 flex items-center justify-between bg-indigo-50/50 border border-indigo-100 rounded-[8px] p-3">
              <div className="flex items-center gap-2 truncate">
                <FileUp className="w-4 h-4 text-indigo-500 shrink-0" />
                <span className="text-sm text-slate-700 font-medium truncate">{pdfFile.name}</span>
                <span className="text-xs text-slate-400">({(pdfFile.size / 1024 / 1024).toFixed(2)} MB)</span>
              </div>
              <button
                type="button"
                onClick={removeFile}
                disabled={generating}
                className="text-slate-400 hover:text-red-500 transition-colors p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <div className="pt-2 flex gap-3">
          {generating && (
            <button
              type="button"
              onClick={handleCancelCommand}
              className="px-6 py-3 bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded-[10px] flex items-center justify-center gap-2 transition-colors border border-red-200"
            >
              <Square className="w-5 h-5" />
              Stop
            </button>
          )}
          <button
            type="submit"
            disabled={generating}
            className="flex-1 bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-300 text-white font-semibold py-3 px-6 rounded-[10px] flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            {generating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating Explanation...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Explain this to me
              </>
            )}
          </button>
        </div>

        <div className="mt-6 border-t border-slate-200 pt-6">
          <div className="bg-indigo-50/50 rounded-[12px] p-5 border border-indigo-100 flex flex-col sm:flex-row items-center gap-4 justify-between">
             <div className="flex-1">
                 <h3 className="text-[0.9rem] font-semibold text-slate-800 flex items-center gap-2">
                   <Mic className="w-4 h-4 text-indigo-500" />
                   Enhanced Voice Explainer
                 </h3>
                 <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                   Don't want to read? Get a conversational, natural audio breakdown using relatable everyday analogies instantly. 
                 </p>
             </div>
             
             <button 
               type="button"
               disabled={generating}
               onClick={handleVoiceExplanation}
               className={`whitespace-nowrap ${voicePlaying || voiceLoading ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100' : 'bg-white border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700'} border px-5 py-2.5 rounded-[10px] shadow-[0_2px_4px_-1px_rgba(0,0,0,0.05)] font-semibold text-sm transition-colors flex items-center justify-center gap-2 w-full sm:w-auto shrink-0 disabled:opacity-50`}
             >
                {voicePlaying ? (
                  <>
                    <Square className="w-4 h-4" /> Stop Audio
                  </>
                ) : voiceLoading ? (
                  <>
                    <Square className="w-4 h-4" /> Cancel Gen
                  </>
                ) : (
                  <>
                    <Volume2 className="w-4 h-4" /> Play Audio
                  </>
                )}
             </button>
          </div>
        </div>

      </form>
    </div>
  );
}
