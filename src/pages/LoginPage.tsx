import React, { useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { AmbientBackground } from '@/components/effects/AmbientBackground';
import { useAuth } from '@/context/AuthContext';
import { ShieldCheck, LogIn, Instagram } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';

const LoginPage: React.FC = () => {
  const { login, signUp, instagramUrl } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const success = mode === 'login'
      ? await login(email, password)
      : await signUp(email, password, name);

    setSubmitting(false);

    if (success) {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <AmbientBackground />
      <Navbar />

      <main className="relative z-10 max-w-md mx-auto my-16 px-4">

        <Card className="glass-panel border-aurora text-slate-100 shadow-2xl">
          <CardHeader className="text-center pb-2">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center mx-auto mb-3">
              <ShieldCheck className="h-6 w-6 text-slate-950" />
            </div>
            <CardTitle className="text-2xl font-black">
              {mode === 'login' ? 'Portal Authorization' : 'Create Your Account'}
            </CardTitle>
            <p className="text-xs text-slate-400 mt-1">
              {mode === 'login' ? 'Sign in with your email and password' : 'Sign up to get started with LiveTrading AI'}
            </p>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">

              {mode === 'signup' && (
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Full Name</label>
                  <Input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-slate-100 text-xs font-mono"
                    required
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Email Address</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-slate-100 text-xs font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Password</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-slate-100 text-xs font-mono"
                  required
                  minLength={6}
                />
              </div>

              <Button type="submit" disabled={submitting} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-5">
                <LogIn className="h-4 w-4 mr-2" />
                {submitting ? 'Please wait...' : mode === 'login' ? 'Log In' : 'Sign Up'}
              </Button>

            </form>

            <button
              type="button"
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
              className="w-full text-center text-[11px] text-indigo-400 hover:text-indigo-300 mt-4 font-bold"
            >
              {mode === 'login' ? "Don't have an account? Sign Up" : 'Already have an account? Log In'}
            </button>

            <div className="mt-6 pt-4 border-t border-slate-800 text-center">
              <p className="text-[11px] text-slate-400 mb-2">Need a VIP Subscription?</p>
              <a href={instagramUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="w-full border-pink-500/40 text-pink-400 hover:bg-pink-500/10 text-xs font-bold gap-1.5">
                  <Instagram className="h-4 w-4" /> Message on Instagram (@abdul_kaif12)
                </Button>
              </a>
            </div>

          </CardContent>
        </Card>

      </main>
    </div>
  );
};

export default LoginPage;
