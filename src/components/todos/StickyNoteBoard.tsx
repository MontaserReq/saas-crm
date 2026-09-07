'use client';

import { useState } from 'react';
import { useI18n } from '@/lib/i18n/context';
import { useDialog } from '@/lib/dialog/context';
import { TodoColor } from '@/types';
import {
  createTodoAction,
  updateTodoAction,
  toggleTodoAction,
  deleteTodoAction,
  changeTodoColorAction,
} from '@/server/actions/todos';
import { formatDate } from '@/lib/utils';
import {
  Plus,
  Check,
  Trash2,
  Edit2,
  Clock,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  Lock,
  Search,
  Palette,
  Calendar,
  Layers,
  StickyNote as StickyIcon,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

interface TodoItem {
  id: string;
  title: string;
  description?: string | null;
  priority: string;
  color: TodoColor | string;
  isCompleted: boolean;
  completedAt?: string | Date | null;
  dueDate?: string | Date | null;
  createdAt: string | Date;
}

interface StickyNoteBoardProps {
  initialTodos: TodoItem[];
}

// Realistic Sticky Note Color Themes (Light & Dark mode calibrated)
const stickyThemes: Record<
  string,
  {
    bg: string;
    darkBg: string;
    border: string;
    tape: string;
    pin: string;
    text: string;
    darkText: string;
    mutedText: string;
    badge: string;
    dotHex: string;
    nameEn: string;
    nameAr: string;
  }
> = {
  yellow: {
    bg: 'bg-[#fef9c3] hover:bg-[#fef08a]',
    darkBg: 'dark:bg-[#423812] dark:hover:bg-[#4e4215]',
    border: 'border-[#fde047]/80 dark:border-[#854d0e]/60',
    tape: 'bg-[#fef08a]/60 dark:bg-[#713f12]/50 border-[#ca8a04]/30',
    pin: 'bg-amber-500',
    text: 'text-[#422006]',
    darkText: 'dark:text-[#fef08a]',
    mutedText: 'text-[#78350f]/80 dark:text-[#fef9c3]/70',
    badge: 'bg-[#fef08a] dark:bg-[#713f12] text-[#854d0e] dark:text-[#fef08a]',
    dotHex: '#facc15',
    nameEn: 'Canary Yellow',
    nameAr: 'أصفر كلاسيكي',
  },
  blue: {
    bg: 'bg-[#e0f2fe] hover:bg-[#bae6fd]',
    darkBg: 'dark:bg-[#0c2f4d] dark:hover:bg-[#0f3b61]',
    border: 'border-[#7dd3fc]/80 dark:border-[#0369a1]/60',
    tape: 'bg-[#bae6fd]/60 dark:bg-[#075985]/50 border-[#0284c7]/30',
    pin: 'bg-sky-500',
    text: 'text-[#082f49]',
    darkText: 'dark:text-[#bae6fd]',
    mutedText: 'text-[#0369a1]/80 dark:text-[#e0f2fe]/70',
    badge: 'bg-[#bae6fd] dark:bg-[#075985] text-[#0369a1] dark:text-[#bae6fd]',
    dotHex: '#38bdf8',
    nameEn: 'Sky Blue',
    nameAr: 'أزرق سماوي',
  },
  green: {
    bg: 'bg-[#dcfce7] hover:bg-[#bbf7d0]',
    darkBg: 'dark:bg-[#0e3b24] dark:hover:bg-[#134e30]',
    border: 'border-[#86efac]/80 dark:border-[#15803d]/60',
    tape: 'bg-[#bbf7d0]/60 dark:bg-[#166534]/50 border-[#16a34a]/30',
    pin: 'bg-emerald-500',
    text: 'text-[#052e16]',
    darkText: 'dark:text-[#bbf7d0]',
    mutedText: 'text-[#166534]/80 dark:text-[#dcfce7]/70',
    badge: 'bg-[#bbf7d0] dark:bg-[#166534] text-[#15803d] dark:text-[#bbf7d0]',
    dotHex: '#4ade80',
    nameEn: 'Mint Green',
    nameAr: 'أخضر نعناعي',
  },
  pink: {
    bg: 'bg-[#fce7f3] hover:bg-[#fbcfe8]',
    darkBg: 'dark:bg-[#4a0e2e] dark:hover:bg-[#5c133a]',
    border: 'border-[#f472b6]/80 dark:border-[#9d174d]/60',
    tape: 'bg-[#fbcfe8]/60 dark:bg-[#831843]/50 border-[#db2777]/30',
    pin: 'bg-pink-500',
    text: 'text-[#500724]',
    darkText: 'dark:text-[#fbcfe8]',
    mutedText: 'text-[#9d174d]/80 dark:text-[#fce7f3]/70',
    badge: 'bg-[#fbcfe8] dark:bg-[#831843] text-[#be185d] dark:text-[#fbcfe8]',
    dotHex: '#f472b6',
    nameEn: 'Rose Pink',
    nameAr: 'وردي لطيف',
  },
  purple: {
    bg: 'bg-[#f3e8ff] hover:bg-[#e9d5ff]',
    darkBg: 'dark:bg-[#3b0764] dark:hover:bg-[#4c0d7d]',
    border: 'border-[#c084fc]/80 dark:border-[#7e22ce]/60',
    tape: 'bg-[#e9d5ff]/60 dark:bg-[#6b21a8]/50 border-[#9333ea]/30',
    pin: 'bg-purple-500',
    text: 'text-[#3b0764]',
    darkText: 'dark:text-[#e9d5ff]',
    mutedText: 'text-[#7e22ce]/80 dark:text-[#f3e8ff]/70',
    badge: 'bg-[#e9d5ff] dark:bg-[#6b21a8] text-[#7e22ce] dark:text-[#e9d5ff]',
    dotHex: '#c084fc',
    nameEn: 'Lavender',
    nameAr: 'لافندر أنيق',
  },
  orange: {
    bg: 'bg-[#ffedd5] hover:bg-[#fed7aa]',
    darkBg: 'dark:bg-[#431407] dark:hover:bg-[#541c0a]',
    border: 'border-[#fb923c]/80 dark:border-[#c2410c]/60',
    tape: 'bg-[#fed7aa]/60 dark:bg-[#9a3412]/50 border-[#ea580c]/30',
    pin: 'bg-orange-500',
    text: 'text-[#431407]',
    darkText: 'dark:text-[#fed7aa]',
    mutedText: 'text-[#9a3412]/80 dark:text-[#ffedd5]/70',
    badge: 'bg-[#fed7aa] dark:bg-[#9a3412] text-[#c2410c] dark:text-[#fed7aa]',
    dotHex: '#fb923c',
    nameEn: 'Warm Peach',
    nameAr: 'خوخي دافئ',
  },
};

// Subtle deterministic natural tilt angles per card
const rotations = [
  'rotate-[-1.2deg] sm:rotate-[-1.5deg]',
  'rotate-[1.1deg] sm:rotate-[1.4deg]',
  'rotate-[-0.8deg] sm:rotate-[-1deg]',
  'rotate-[1.6deg] sm:rotate-[1.8deg]',
  'rotate-[-1.4deg] sm:rotate-[-1.7deg]',
  'rotate-[0.9deg] sm:rotate-[1.2deg]',
];

export function StickyNoteBoard({ initialTodos }: StickyNoteBoardProps) {
  const [todos, setTodos] = useState<TodoItem[]>(initialTodos);
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'notes' | 'completed'>('all');
  const [selectedColorFilter, setSelectedColorFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<TodoItem | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [color, setColor] = useState<TodoColor>('yellow');
  const [dueDate, setDueDate] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { t, language, getPriorityLabel } = useI18n();
  const { confirm } = useDialog();

  const handleOpenCreate = () => {
    setEditingTodo(null);
    setTitle('');
    setDescription('');
    setPriority('MEDIUM');
    setColor('yellow');
    setDueDate('');
    setError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (todo: TodoItem) => {
    setEditingTodo(todo);
    setTitle(todo.title);
    setDescription(todo.description || '');
    setPriority((todo.priority as any) || 'MEDIUM');
    setColor((todo.color as any) || 'yellow');
    setDueDate(todo.dueDate ? new Date(todo.dueDate).toISOString().split('T')[0] : '');
    setError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    setError(null);

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      priority,
      color,
      dueDate: dueDate || null,
    };

    if (editingTodo) {
      const res = await updateTodoAction(editingTodo.id, payload);
      setLoading(false);
      if (res.success && res.todo) {
        setTodos((prev) => prev.map((item) => (item.id === editingTodo.id ? res.todo : item)));
        setIsModalOpen(false);
      } else {
        setError(res.error || t('common.error'));
      }
    } else {
      const res = await createTodoAction(payload);
      setLoading(false);
      if (res.success && res.todo) {
        setTodos((prev) => [res.todo, ...prev]);
        setIsModalOpen(false);
      } else {
        setError(res.error || t('common.error'));
      }
    }
  };

  const handleToggle = async (id: string) => {
    setTodos((prev) =>
      prev.map((tItem) => (tItem.id === id ? { ...tItem, isCompleted: !tItem.isCompleted, completedAt: !tItem.isCompleted ? new Date() : null } : tItem))
    );
    await toggleTodoAction(id);
  };

  const handleChangeColor = async (id: string, newColor: TodoColor) => {
    setTodos((prev) =>
      prev.map((tItem) => (tItem.id === id ? { ...tItem, color: newColor } : tItem))
    );
    await changeTodoColorAction(id, newColor);
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: t('todos.deleteTodo'),
      message: t('todos.deleteConfirm'),
      variant: 'confirmation',
      isDestructive: true,
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
    });

    if (!ok) return;
    setTodos((prev) => prev.filter((tItem) => tItem.id !== id));
    await deleteTodoAction(id);
  };

  // Filtering Logic
  const filteredTodos = todos.filter((todo) => {
    const matchesSearch =
      todo.title.toLowerCase().includes(search.toLowerCase()) ||
      (todo.description && todo.description.toLowerCase().includes(search.toLowerCase()));
    if (!matchesSearch) return false;

    if (selectedColorFilter !== 'ALL' && todo.color !== selectedColorFilter) {
      return false;
    }

    if (activeTab === 'active') return !todo.isCompleted;
    if (activeTab === 'completed') return todo.isCompleted;
    if (activeTab === 'notes') return !todo.isCompleted && !todo.dueDate;
    return true;
  });

  const activeCount = todos.filter((tItem) => !tItem.isCompleted).length;
  const completedCount = todos.filter((tItem) => tItem.isCompleted).length;
  const quickNotesCount = todos.filter((tItem) => !tItem.isCompleted && !tItem.dueDate).length;

  return (
    <div className="space-y-6 font-sans">
      {/* Privacy Guarantee Header Banner */}
      <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-gradient-to-r from-purple-900/90 via-brand-800 to-indigo-900 text-white shadow-md relative overflow-hidden">
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold tracking-tight">
                {t('todos.title')}
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold border border-emerald-400/30">
                100% Confidential
              </span>
            </div>
            <p className="text-xs text-purple-200 mt-0.5">
              {t('todos.subtitle')}
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-brand-900 bg-amber-300 hover:bg-amber-200 transition-all shadow-md shrink-0 relative z-10"
        >
          <Plus className="w-4 h-4" />
          <span>{t('todos.addTodo')}</span>
        </button>

        <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Control Bar: Tabs, Search & Color Filters */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 overflow-x-auto">
            <button
              onClick={() => setActiveTab('all')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                activeTab === 'all'
                  ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{t('todos.filterAll')}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700">
                {todos.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('active')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                activeTab === 'active'
                  ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t('todos.filterActive')}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                {activeCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('notes')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                activeTab === 'notes'
                  ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <StickyIcon className="w-3.5 h-3.5" />
              <span>{t('todos.filterNotes')}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300">
                {quickNotesCount}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('completed')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                activeTab === 'completed'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{t('todos.filterCompleted')}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                {completedCount}
              </span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('todos.searchPlaceholder')}
              className="w-full pl-8 pr-3 rtl:pl-3 rtl:pr-8 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>

        {/* Color Filter Palette */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <span className="text-slate-400 font-semibold flex items-center gap-1">
            <Palette className="w-3.5 h-3.5" />
            <span>{t('todos.colorFilter')}</span>
          </span>

          <button
            onClick={() => setSelectedColorFilter('ALL')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${
              selectedColorFilter === 'ALL'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            {t('todos.allColors')}
          </button>

          {Object.entries(stickyThemes).map(([colorKey, theme]) => {
            const themeLabel = language === 'ar' ? theme.nameAr : theme.nameEn;
            return (
              <button
                key={colorKey}
                onClick={() => setSelectedColorFilter(colorKey)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-all ${
                  selectedColorFilter === colorKey
                    ? 'ring-2 ring-brand-500 shadow-sm font-bold scale-105'
                    : 'opacity-80 hover:opacity-100'
                }`}
                style={{
                  backgroundColor: theme.dotHex + '22',
                  borderColor: theme.dotHex,
                }}
                title={themeLabel}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: theme.dotHex }} />
                <span className="text-[11px] hidden sm:inline text-slate-700 dark:text-slate-200 font-medium">
                  {themeLabel}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Realistic Sticky Notes Board Canvas */}
      {filteredTodos.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
            <StickyIcon className="w-7 h-7" />
          </div>
          <h3 className="font-bold text-base text-slate-800 dark:text-slate-200">
            {t('todos.noTodos')}
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {t('todos.subtitle')}
          </p>
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 transition-colors inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('todos.addFirst')}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 pt-2 pb-8">
          {filteredTodos.map((todo, idx) => {
            const theme = stickyThemes[todo.color] || stickyThemes['yellow'];
            const rotClass = rotations[idx % rotations.length];

            return (
              <div
                key={todo.id}
                className={`group relative flex flex-col justify-between p-5 rounded-2xl border ${theme.bg} ${theme.darkBg} ${theme.border} ${theme.text} ${theme.darkText} ${rotClass} hover:rotate-0 hover:scale-[1.03] transition-all duration-300 ease-out cursor-default shadow-[0_8px_20px_-4px_rgba(0,0,0,0.12),0_3px_6px_-2px_rgba(0,0,0,0.06)] dark:shadow-[0_10px_25px_-5px_rgba(0,0,0,0.6)] min-h-[220px] max-w-full overflow-hidden select-text`}
              >
                {/* Realistic Tape Top Strip */}
                <div
                  className={`absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1.5 w-16 h-3.5 rounded-xs ${theme.tape} backdrop-blur-sm border shadow-xs pointer-events-none transform -rotate-1`}
                />

                {/* Main Card Content */}
                <div className="space-y-2.5 pt-1">
                  {/* Top Bar inside note: Priority, Color Pallet on Hover, Edit/Delete */}
                  <div className="flex items-center justify-between gap-1 pb-2 border-b border-black/10 dark:border-white/10">
                    <span
                      className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${theme.badge}`}
                    >
                      {getPriorityLabel(todo.priority)}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(todo)}
                        className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-slate-700 dark:text-slate-200"
                        title={t('common.edit')}
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(todo.id)}
                        className="p-1 rounded-md hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition-colors"
                        title={t('common.delete')}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Title with strike-through when completed */}
                  <h4
                    className={`font-black text-sm sm:text-base leading-snug break-words ${
                      todo.isCompleted
                        ? 'line-through opacity-60 italic'
                        : ''
                    }`}
                  >
                    {todo.title}
                  </h4>

                  {/* Description body */}
                  {todo.description && (
                    <p
                      className={`text-xs leading-relaxed whitespace-pre-wrap line-clamp-5 ${theme.mutedText} ${
                        todo.isCompleted ? 'line-through opacity-50' : ''
                      }`}
                    >
                      {todo.description}
                    </p>
                  )}
                </div>

                {/* Footer Section: Date, Color Palette Selector & Toggle Done */}
                <div className="pt-3 mt-4 border-t border-black/10 dark:border-white/10 flex flex-col gap-2">
                  {/* Quick Color Palette Dots on Hover/Focus */}
                  <div className="flex items-center justify-between opacity-70 group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-1">
                      {(['yellow', 'blue', 'green', 'pink', 'purple', 'orange'] as TodoColor[]).map((cKey) => {
                        const themeName = language === 'ar' ? stickyThemes[cKey].nameAr : stickyThemes[cKey].nameEn;
                        return (
                          <button
                            key={cKey}
                            type="button"
                            onClick={() => handleChangeColor(todo.id, cKey)}
                            className={`w-3.5 h-3.5 rounded-full border transition-transform ${
                              todo.color === cKey
                                ? 'scale-125 ring-1 ring-black/40 dark:ring-white/80 border-white'
                                : 'hover:scale-110 border-black/20'
                            }`}
                            style={{ backgroundColor: stickyThemes[cKey].dotHex }}
                            title={themeName}
                          />
                        );
                      })}
                    </div>

                    {/* Due Date or Creation Date */}
                    <span className={`text-[10px] font-semibold ${theme.mutedText} flex items-center gap-1`}>
                      {todo.dueDate ? (
                        <>
                          <Calendar className="w-3 h-3 shrink-0" />
                          <span>{formatDate(todo.dueDate, language)}</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-3 h-3 shrink-0" />
                          <span>{formatDate(todo.createdAt, language)}</span>
                        </>
                      )}
                    </span>
                  </div>

                  {/* Complete/Reopen Button */}
                  <button
                    type="button"
                    onClick={() => handleToggle(todo.id)}
                    className={`w-full py-1.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all ${
                      todo.isCompleted
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                        : 'bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 text-inherit'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>
                      {todo.isCompleted
                        ? t('todos.markUndone')
                        : t('todos.markDone')}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Note Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTodo ? t('todos.editTodo') : t('todos.addTodo')}
        description={t('todos.subtitle')}
      >
        <form onSubmit={handleSave} className="space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t('todos.todoTitle')} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('todos.todoTitlePlaceholder')}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {t('todos.todoContent')}
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('todos.todoContentPlaceholder')}
              className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>

          {/* Color Picker with Real Pastel Swatches */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              {t('todos.todoColor')}
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {(Object.keys(stickyThemes) as TodoColor[]).map((cKey) => {
                const item = stickyThemes[cKey];
                const isSelected = color === cKey;
                const itemLabel = language === 'ar' ? item.nameAr : item.nameEn;
                return (
                  <button
                    key={cKey}
                    type="button"
                    onClick={() => setColor(cKey)}
                    className={`flex items-center gap-1.5 p-2 rounded-xl border text-left rtl:text-right transition-all ${
                      isSelected
                        ? 'ring-2 ring-brand-600 dark:ring-white border-transparent shadow-sm scale-105 font-bold'
                        : 'border-slate-200 dark:border-slate-700 hover:border-brand-400'
                    }`}
                    style={{ backgroundColor: item.dotHex + '25' }}
                  >
                    <span className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: item.dotHex }} />
                    <span className="text-[11px] text-slate-800 dark:text-slate-200 truncate">
                      {itemLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {t('todos.todoPriority')}
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:border-brand-500 focus:outline-none"
              >
                <option value="LOW">{t('tickets.priorityLow')}</option>
                <option value="MEDIUM">{t('tickets.priorityMedium')}</option>
                <option value="HIGH">{t('tickets.priorityHigh')}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {t('todos.todoDueDate')}
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              disabled={loading}
              className="px-4 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 transition-colors disabled:opacity-50"
            >
              {loading
                ? t('common.saving')
                : editingTodo
                ? t('todos.updateNote')
                : t('todos.saveNote')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
