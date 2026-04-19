import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import NoteGenerator from './pages/NoteGenerator';
import NoteDetail from './pages/NoteDetail';
import Navbar from './components/Navbar';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }
  
  return user ? <>{children}</> : <Navigate to="/" />;
}

function AppRoutes() {
  return (
    <div className="min-h-screen flex flex-col w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <Navbar />
      <main className="flex-grow py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          } />
          <Route path="/new" element={
            <PrivateRoute>
              <NoteGenerator />
            </PrivateRoute>
          } />
          <Route path="/notes/:noteId" element={
            <PrivateRoute>
              <NoteDetail />
            </PrivateRoute>
          } />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
