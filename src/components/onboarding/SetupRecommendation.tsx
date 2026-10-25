'use client';

import React from 'react';
import { useI18n } from '@/lib/i18n/context';
import { industries, moduleLabels, recommendWorkspace, setupModuleIds, type SetupAnswers, type SetupModule } from '@/lib/onboarding/templates';

const control = 'mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-950 focus:outline-purple-600 dark:border-slate-600 dark:bg-slate-900 dark:text-white';
const button = 'rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold focus-visible:outline-purple-600 disabled:opacity-50 dark:border-slate-600';

export function SetupRecommendation({ answers, standard, review, update }: { answers: SetupAnswers; standard: boolean; review: boolean; update: (patch: Partial<SetupAnswers>, standard?: boolean) => void }) {
  const { language } = useI18n();
  const text = (en: string, ar: string) => language === 'ar' ? ar : en;
  // Invalid edits remain in their controls; only validated defaults power preview.
  const config = recommendWorkspace({ ...answers, workspace: answers.workspace.trim().length >= 2 ? answers.workspace : 'My workspace', pipelineStages: undefined }, standard);
  const names = answers.pipelineStages ?? config.stages.filter(stage => stage.type === 'OPEN').map(stage => stage.name[language]);
  function toggle(id: SetupModule, checked: boolean) {
    const modules = new Set(config.modules);
    if (checked) modules.add(id); else modules.delete(id);
    if (id === 'deals' || id === 'pipelines') for (const related of ['deals', 'pipelines'] as const) { if (checked) modules.add(related); else modules.delete(related); }
    update({ modules: [...modules] });
  }
  const choice = (id: SetupModule) => <label key={id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700"><input type="checkbox" checked={config.modules.includes(id)} disabled={id === 'dashboard' || standard} onChange={event => toggle(id, event.target.checked)} className="h-4 w-4 shrink-0 accent-purple-700" />{moduleLabels[id][language]}</label>;
  return <>
    <div className="rounded-2xl bg-purple-50 p-5 dark:bg-purple-950/40"><p className="break-words font-extrabold">{answers.workspace}</p><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{standard ? text('Standard CRM setup', 'إعداد إدارة العملاء العام') : industries[answers.industry].title[language]} · {answers.teamSize === '1' ? text('Just me', 'أنا فقط') : <bdi dir="ltr">{answers.teamSize}</bdi>}</p></div>
    {review ? <div><h3 className="font-bold">{text('Your workspace includes', 'تتضمن مساحة عملك')}</h3><ul className="mt-3 flex flex-wrap gap-2">{config.modules.map(id => <li key={id} className="rounded-full border border-purple-200 px-3 py-1.5 text-sm dark:border-purple-700">{moduleLabels[id][language]}</li>)}</ul></div> : <>
      <fieldset className="space-y-3"><legend className="font-bold">{text('Ready in your menu', 'جاهز في قائمتك')}</legend><p className="text-sm text-slate-600 dark:text-slate-300">{text('Keep our suggestions or choose the sections you need.', 'احتفظ بالمقترحات أو اختر الأقسام التي تحتاجها.')}</p><div className="grid gap-3 sm:grid-cols-2">{setupModuleIds.slice(0, 9).map(choice)}</div><details><summary className="cursor-pointer text-sm font-semibold">{text('More sections', 'المزيد من الأقسام')}</summary><div className="mt-3 grid gap-3 sm:grid-cols-2">{setupModuleIds.slice(9).map(choice)}</div></details></fieldset>
      <button type="button" className="text-sm font-semibold text-purple-700 dark:text-purple-300" onClick={() => update({ modules: undefined, pipelineStages: undefined }, false)}>{text('Reset to recommendations', 'استعادة المقترحات')}</button>
    </>}
    {config.stages.length > 0 && <div><h3 className="font-bold">{text('Suggested sales stages', 'مراحل البيع المقترحة')}</h3><ol className="mt-3 flex flex-wrap gap-2 text-sm">{[...(standard ? config.stages.filter(stage => stage.type === 'OPEN').map(stage => stage.name[language]) : names), text('Won', 'ناجحة'), text('Lost', 'غير ناجحة')].map((name, index) => <li key={index} className="min-w-0 max-w-full break-words rounded-lg bg-slate-100 px-3 py-2 dark:bg-slate-800">{name || text('Unnamed stage', 'مرحلة دون اسم')}</li>)}</ol>
      {!review && !standard && <details className="mt-4"><summary className="cursor-pointer text-sm font-semibold">{text('Adjust stages (optional)', 'تعديل المراحل (اختياري)')}</summary><div className="mt-3 space-y-3">{names.map((name, index) => <div key={index} className="flex items-end gap-2"><label className="min-w-0 flex-1 text-sm font-semibold">{text(`Stage ${index + 1}`, `المرحلة ${index + 1}`)}<input maxLength={80} value={name} onChange={event => update({ pipelineStages: names.map((item, i) => i === index ? event.target.value : item) })} className={control} /></label><button type="button" disabled={names.length === 1} aria-label={text(`Remove stage ${index + 1}`, `حذف المرحلة ${index + 1}`)} onClick={() => update({ pipelineStages: names.filter((_, i) => i !== index) })} className={button}>×</button></div>)}<button type="button" disabled={names.length >= 8} onClick={() => update({ pipelineStages: [...names, text(`New stage ${names.length + 1}`, `مرحلة جديدة ${names.length + 1}`)] })} className={button}>{text('Add stage', 'إضافة مرحلة')}</button><p className="text-xs text-slate-600 dark:text-slate-300">{text('Won and lost outcomes stay in place. Existing pipelines are preserved.', 'تبقى نتائج النجاح والخسارة. تُحفظ المسارات الموجودة.')}</p></div></details>}
    </div>}
    {config.fields.length > 0 && <div><h3 className="font-bold">{text('Useful information on potential customers', 'بيانات مفيدة للعملاء المحتملين')}</h3><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{[...config.builtInFields.map(field => field[language]), ...config.fields.map(field => field.label[language])].join(' · ')}</p><p className="mt-2 text-xs text-slate-600 dark:text-slate-300">{text('Extra fields are optional. Add more in Settings later.', 'الحقول الإضافية اختيارية. أضف المزيد من الإعدادات لاحقاً.')}</p></div>}
    {config.note && <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:bg-amber-950 dark:text-amber-100">{config.note[language]}</p>}
    <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{review ? text('Create your workspace and start working. Customers, teammates, and integrations can wait.', 'أنشئ مساحتك وابدأ العمل. يمكنك إضافة العملاء والفريق وربط الأدوات لاحقاً.') : text('Your choices organize the menu. You can change the setup later.', 'اختياراتك تنظّم القائمة. يمكنك تعديل الإعداد لاحقاً.')}</p>
  </>;
}
