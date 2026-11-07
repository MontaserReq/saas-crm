import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center dark:bg-slate-950">
      <div className="max-w-md space-y-4">
        <p className="text-sm font-bold text-brand-600">404</p>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">الصفحة غير موجودة</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">تعذر العثور على الصفحة المطلوبة.</p>
        <Link href="/dashboard" className="inline-flex rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-700">العودة إلى لوحة التحكم</Link>
      </div>
    </main>
  );
}
