'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n/context';
import { updateUserProfileAction } from '@/server/actions/users';
import { User, Phone, Mail, Shield, Building2, CheckCircle2, Image as ImageIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ProfileClientViewProps {
  user: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    avatar?: string | null;
    role: string;
    roleDisplayName?: string;
    departmentName?: string;
  };
}

export function ProfileClientView({ user }: ProfileClientViewProps) {
  const { t, getRoleLabel } = useI18n();
  const router = useRouter();

  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone || '');
  const [avatar, setAvatar] = useState(user.avatar || '');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    const res = await updateUserProfileAction({
      name: name.trim(),
      phone: phone.trim() || undefined,
      avatar: avatar.trim() || undefined,
    });

    setLoading(false);

    if (res.success) {
      setSuccess(true);
      router.refresh();
      setTimeout(() => setSuccess(false), 4000);
    } else {
      setError(res.error || t('common.error'));
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <User className="w-5 h-5 text-brand-600" />
          <span>{t('profile.title')}</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('profile.subtitle')}</p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        {/* Avatar Display */}
        <div className="flex items-center gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-600 to-purple-800 text-white font-black text-xl flex items-center justify-center shadow-lg shadow-brand-500/20">
            {avatar ? (
              <img src={avatar} alt={name} className="w-full h-full object-cover rounded-2xl" />
            ) : (
              name.charAt(0)
            )}
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">{name}</h3>
            <p className="text-xs text-slate-500">{user.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950 text-brand-700 dark:text-brand-300 text-[10px] font-bold border border-purple-200/60 dark:border-purple-800/60">
                <Shield className="w-3 h-3" />
                <span>{getRoleLabel(user.role)}</span>
              </span>
              {user.departmentName && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold border border-slate-200 dark:border-slate-700">
                  <Building2 className="w-3 h-3" />
                  <span>{user.departmentName}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Edit Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {success && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{t('profile.profileUpdated')}</span>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                <User className="w-3 h-3 text-brand-600" />
                <span>{t('profile.fullName')} *</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                <Phone className="w-3 h-3 text-brand-600" />
                <span>{t('profile.phone')}</span>
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+962 7 9000 0000"
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
              <Mail className="w-3 h-3 text-slate-400" />
              <span>{t('profile.email')}</span>
            </label>
            <input
              type="email"
              disabled
              value={user.email}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-500 dark:text-slate-400 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
              <ImageIcon className="w-3 h-3 text-brand-600" />
              <span>{t('profile.avatar')}</span>
            </label>
            <input
              type="url"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              placeholder="https://..."
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 transition-all shadow-md shadow-brand-500/10 flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{loading ? t('common.loading') : t('profile.saveProfile')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
