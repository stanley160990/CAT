import React from 'react';
import { User } from '../types/cat.ts';
import { clearAuthUser } from '../lib/api.ts';
import { ShieldCheck, UserCheck, Monitor, LogOut } from 'lucide-react';

interface NavbarProps {
  currentUser: User | null;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentUser, onLogout }) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand & Logo */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-[#FF006E] flex items-center justify-center shadow-lg shadow-[#FF006E]/30 text-white font-black tracking-wider text-xl border border-white/20">
            CAT
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-lg tracking-tight text-white">
                CAT ONLINE
              </span>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#d1e7dd] text-[#0f5132] border border-[#badbcc]">
                Seleksi Terpadu
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Sistem Seleksi Terpadu
            </p>
          </div>
        </div>

        {/* User Info & Actions */}
        {currentUser && (
          <div className="flex items-center space-x-3 sm:space-x-4">
            {/* Role Badge */}
            <div className="hidden md:flex flex-col text-right">
              <span className="text-sm font-semibold text-slate-200">{currentUser.name}</span>
              <div className="flex items-center justify-end space-x-1.5 text-xs">
                {currentUser.role === 'admin' && (
                  <span className="inline-flex items-center text-[#FF006E] font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Admin Keseluruhan
                  </span>
                )}
                {currentUser.role === 'operator' && (
                  <span className="inline-flex items-center text-[#0f5132] bg-[#d1e7dd] px-2 py-0.5 rounded font-semibold border border-[#badbcc]">
                    <Monitor className="w-3.5 h-3.5 mr-1" /> Admin Ruangan ({currentUser.room?.name || 'Ruang CBT'})
                  </span>
                )}
                {currentUser.role === 'peserta' && (
                  <span className="inline-flex items-center text-sky-300 font-medium">
                    <UserCheck className="w-3.5 h-3.5 mr-1" /> No. Peserta: {currentUser.username}
                  </span>
                )}
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={() => {
                clearAuthUser();
                onLogout();
              }}
              className="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-rose-600/20 text-rose-300 hover:bg-[#FF006E] hover:text-white border border-rose-500/30 transition shadow-sm cursor-pointer"
              title="Keluar dari akun"
            >
              <LogOut className="w-3.5 h-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
