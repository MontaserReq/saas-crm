export const managedIntegrationProviders = ['SLACK', 'CANVA', 'GOOGLE', 'MICROSOFT'] as const;
export type ManagedIntegrationProvider = typeof managedIntegrationProviders[number];

export const managedIntegrationCatalog: Array<{
  provider: ManagedIntegrationProvider;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
}> = [
  { provider: 'SLACK', nameEn: 'Slack', nameAr: 'Slack', descriptionEn: 'CRM alerts and team notifications', descriptionAr: 'تنبيهات CRM وإشعارات الفريق' },
  { provider: 'CANVA', nameEn: 'Canva', nameAr: 'Canva', descriptionEn: 'Designs and exports from CRM', descriptionAr: 'التصاميم والتصدير من CRM' },
  { provider: 'GOOGLE', nameEn: 'Google', nameAr: 'Google', descriptionEn: 'Google email and calendar', descriptionAr: 'بريد وتقويم Google' },
  { provider: 'MICROSOFT', nameEn: 'Microsoft', nameAr: 'Microsoft', descriptionEn: 'Microsoft email and calendar', descriptionAr: 'بريد وتقويم Microsoft' },
];

export function normalizeManagedIntegrationProvider(value: string): ManagedIntegrationProvider | null {
  const normalized = value.trim().toUpperCase();
  return (managedIntegrationProviders as readonly string[]).includes(normalized)
    ? normalized as ManagedIntegrationProvider
    : null;
}
