'use client';

import { TicketPriority } from '@/types';
import { useI18n } from '@/lib/i18n/context';
import { Badge } from '@/components/ui/Badge';
import { AlertCircle, AlertTriangle, ArrowDown, ArrowUp } from 'lucide-react';

export function PriorityBadge({ priority }: { priority: TicketPriority | string }) {
  const { getStatusLabel } = useI18n();

  const getConfig = (p: string) => {
    switch (p) {
      case 'URGENT':
        return { variant: 'destructive' as const, icon: AlertTriangle };
      case 'HIGH':
        return { variant: 'warning' as const, icon: ArrowUp };
      case 'MEDIUM':
        return { variant: 'blue' as const, icon: AlertCircle };
      case 'LOW':
        return { variant: 'secondary' as const, icon: ArrowDown };
      default:
        return { variant: 'secondary' as const, icon: ArrowDown };
    }
  };

  const config = getConfig(priority);
  const Icon = config.icon;

  return (
    <Badge variant={config.variant}>
      <Icon className="w-3 h-3" />
      <span>{getStatusLabel(priority)}</span>
    </Badge>
  );
}
