import React, { useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { useAuth } from '@/context/AuthContext';
import { ShieldCheck, LogIn, KeyRound, Instagram } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';

const LoginPage: React.FC = () => {
  const { login, instagramUrl } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState<string>('luffyhales1@gmail.com');
  const [password, setPassword] = useState<string>('yahoo789');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const success = login(email, password);
    if (success) {
      navigate(email.toLowerCase() === 'luffyhales1@gmail.com' ? '/admin' : '/');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <Navbar />

      <main className="max-w-md mx-auto my-16 px-4">
        
        <Card className="bg-slate-900 border-slate-800 text-slate-100 shadow-2xl">
          <CardHeader className="text-center pb-2">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center mx-auto mb-3">
              <ShieldCheck className="h-6 w-6 text-slate-950" />
            </div>
            <CardTitle className="text-2xl font-black">Portal Authorization</CardTitle>
            <p className="text-xs text-slate-400 mt-1">Sign in with user or Master Admin credentials</p>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              
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
                />
              </div>

              <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-5">
                <LogIn className="h-4 w-4 mr-2" /> Log In
              </Button>

            </form>

            <div className="mt-6 pt-4 border-t border-slate-800 text-center">
              <p className="text-[11px] text-slate-400 mb-2">Need a VIP Subscription or Instagram Key?</p>
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