import React, { useState } from 'react';
import { apiRequest, saveAuthUser } from '../lib/api.ts';
import { User } from '../types/cat.ts';
import { Lock, User as UserIcon, Shield, AlertCircle, ArrowRight } from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMessage('Silakan masukkan Username / Nomor Peserta dan Kata Sandi.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await apiRequest<{ success: boolean; user: User; error?: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      if (res.success && res.user) {
        saveAuthUser(res.user);
        onLoginSuccess(res.user);
      } else {
        setErrorMessage(res.error || 'Autentikasi gagal. Silakan periksa kembali data Anda.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal terhubung ke server database.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Subtle decorative background elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-[#d1e7dd]/30 to-transparent pointer-events-none -z-10" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Shield Logo */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-[#FF006E] p-1 shadow-xl shadow-[#FF006E]/20 flex items-center justify-center">
            <div className="w-full h-full bg-white rounded-[12px] flex items-center justify-center">
              <Shield className="w-8 h-8 text-[#FF006E]" />
            </div>
          </div>
        </div>

        <h1 className="mt-4 text-center text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          PORTAL SELEKSI CAT ONLINE
        </h1>
        <div className="mt-2 flex justify-center">
          <span className="text-xs font-bold px-3.5 py-1 rounded-full bg-[#d1e7dd] text-[#0f5132] border border-[#badbcc]">
            Sistem Seleksi Terpadu
          </span>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 sm:px-10 shadow-xl shadow-slate-200/60 rounded-3xl border border-slate-200">
          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start space-x-2.5 text-rose-700 text-xs sm:text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-500 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Username / Nomor Peserta
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <UserIcon className="w-4 h-4 text-slate-500" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan Username atau Nomor Peserta"
                  className="w-full pl-10 pr-3.5 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FF006E] focus:border-[#FF006E] focus:bg-white text-sm font-medium transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Kata Sandi (Password)
              </label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4 text-slate-500" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan kata sandi akun Anda"
                  className="w-full pl-10 pr-3.5 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FF006E] focus:border-[#FF006E] focus:bg-white text-sm font-medium transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex justify-center items-center py-3 px-4 rounded-xl shadow-lg shadow-[#FF006E]/25 text-sm font-bold text-white bg-[#FF006E] hover:bg-[#e00062] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#FF006E] disabled:opacity-50 transition cursor-pointer"
            >
              {loading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Memverifikasi Akun...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1.5">
                  <span>Login</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              )}
            </button>
          </form>
        </div>

        <div className="mt-4 text-center text-xs text-slate-500">
          Tata tertib ujian dan pengerjaan soal akan ditampilkan setelah login berhasil.
        </div>
      </div>
    </div>
  );
};
