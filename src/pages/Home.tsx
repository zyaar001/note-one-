import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, Sparkles, BrainCircuit } from 'lucide-react';

export default function Home() {
  const { user, signInWithGoogle } = useAuth();

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center max-w-3xl mx-auto">
      <div className="bg-indigo-50 text-indigo-600 rounded-full px-4 py-1.5 text-sm font-medium mb-6 inline-flex items-center gap-2">
        <Sparkles className="w-4 h-4" />
        AI-Powered Note Explanations
      </div>
      <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 mb-6 leading-tight">
        Master complex topics in <span className="text-indigo-600 text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-indigo-600">seconds.</span>
      </h1>
      <p className="text-lg text-slate-600 mb-10 leading-relaxed">
        Upload your class notes, specify a chapter title, or paste a difficult concept. 
        Our AI acts as your personal tutor, breaking down the material into highly pedagogical, 
        easy-to-understand explanations customized for your learning journey.
      </p>
      
      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <button 
          onClick={signInWithGoogle}
          className="bg-indigo-500 hover:bg-indigo-600 text-white px-8 py-3.5 rounded-[10px] text-lg font-semibold transition-all shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)] hover:shadow-md hover:-translate-y-0.5"
        >
          Get Started for Free
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24 text-left">
        <div className="bg-white p-6 rounded-2xl shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)] border border-slate-200">
          <BookOpen className="w-8 h-8 text-indigo-500 mb-4" />
          <h3 className="text-xl font-bold mb-2">Upload Notes</h3>
          <p className="text-slate-600 text-sm">Paste your dense lecture notes or textbook excerpts and let our AI digest them.</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)] border border-slate-200">
          <BrainCircuit className="w-8 h-8 text-indigo-500 mb-4" />
          <h3 className="text-xl font-bold mb-2">Instant Understanding</h3>
          <p className="text-slate-600 text-sm">Receive a friendly, structured explanation that breaks down complex ideas into simple analogies.</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)] border border-slate-200">
          <FileText className="w-8 h-8 text-indigo-500 mb-4" />
          <h3 className="text-xl font-bold mb-2">Save & Review</h3>
          <p className="text-slate-600 text-sm">All your explanations are saved to your account. Review them anytime, anywhere.</p>
        </div>
      </div>
    </div>
  );
}

// Inline definition for missing icon to keep imports clean
function FileText(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}
