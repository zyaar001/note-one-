import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { handleFirestoreError } from '../lib/firebaseError';
import { Link } from 'react-router-dom';
import { PlusCircle, FileText, ChevronRight, Clock } from 'lucide-react';

interface Note {
  id: string;
  title: string;
  updatedAt: Timestamp;
  createdAt: Timestamp;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const notesRef = collection(db, 'users', user.uid, 'notes');
    // We add `where` to satisfy `resource.data.ownerId == request.auth.uid` rule.
    // Instead of doing `orderBy` (which needs a composite index), we can sort client-side.
    const q = query(notesRef, where('ownerId', '==', user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedNotes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Note[];
      
      // Sort in memory to avoid needing composite indexes in Firestore
      fetchedNotes.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
      
      setNotes(fetchedNotes);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching notes:", error);
      try {
        handleFirestoreError(error, 'list', `users/${user.uid}/notes`);
      } catch (err: any) {
        console.error("Structured Error:", err.message);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  if (loading) {
    return <div className="text-center py-20 text-gray-500">Loading your notes...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight">My Explanations</h1>
        <Link 
          to="/new"
          className="bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-2.5 rounded-[10px] text-sm font-semibold transition-colors flex items-center gap-2"
        >
          <PlusCircle className="w-4 h-4" />
          New Note
        </Link>
      </div>

      {notes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)]">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold mb-2 text-slate-800">No notes yet</h2>
          <p className="text-slate-500 mb-6 max-w-md mx-auto">
            You haven't generated any explanations yet. Paste some tricky concepts and let's get started.
          </p>
          <Link 
            to="/new"
            className="inline-flex bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 px-6 py-2.5 rounded-[10px] text-sm font-semibold transition-colors items-center gap-2 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)]"
          >
            Create first note
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {notes.map(note => (
            <Link 
              key={note.id} 
              to={`/notes/${note.id}`}
              className="group bg-white rounded-[16px] border border-slate-200 p-6 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05)] hover:shadow-md transition-all hover:border-indigo-500 block"
            >
              <h3 className="text-lg font-bold mb-3 group-hover:text-indigo-500 line-clamp-2 leading-snug text-slate-800">
                {note.title}
              </h3>
              <div className="flex items-center justify-between text-xs text-slate-500 mt-auto">
                <span className="flex items-center gap-1.5 font-medium">
                  <Clock className="w-3.5 h-3.5" />
                  {note.createdAt?.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
