import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, LogOut, FileText, PlusCircle } from 'lucide-react';

export default function Navbar() {
  const { user, signInWithGoogle, logout } = useAuth();

  return (
    <header className="border-b border-gray-200 py-4">
      <div className="flex justify-between items-center">
        <Link to="/" className="flex items-center gap-2 text-xl font-bold tracking-tight text-slate-800 hover:opacity-80">
          <BookOpen className="w-6 h-6 text-indigo-500" />
          <span>Note Explainer</span>
        </Link>
        <nav className="flex items-center gap-4">
          {user ? (
            <>
              <Link to="/dashboard" className="text-slate-500 hover:text-slate-800 flex items-center gap-1 text-sm font-medium">
                <FileText className="w-4 h-4" />
                <span>My Notes</span>
              </Link>
              <Link to="/new" className="text-indigo-500 hover:text-indigo-600 flex items-center gap-1 text-sm font-medium">
                <PlusCircle className="w-4 h-4" />
                <span>New Explanation</span>
              </Link>
              <button 
                onClick={logout}
                className="text-slate-500 hover:text-slate-800 ml-4 flex items-center gap-1 text-sm font-medium"
                title="Log out"
              >
                <LogOut className="w-4 h-4" />
                <span className="sr-only">Log Out</span>
              </button>
            </>
          ) : (
            <button 
              onClick={signInWithGoogle}
              className="bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-2.5 rounded-[10px] text-sm font-semibold transition-colors"
            >
              Sign In
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
