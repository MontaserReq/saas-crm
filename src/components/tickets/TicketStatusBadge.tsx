'use client';

import { TicketStatus } from '@/types';
import { useI18n } from '@/lib/i18n/context';
import { Badge } from '@/components/ui/Badge';
import { Clock, Eye, CheckCircle2, XCircle, PlayCircle, ArrowRightLeft, PhoneOff, CheckCheck, Archive } from 'lucide-react';

interface TicketStatusBadgeProps {
  status: TicketStatus | string;
  showIcon?: boolean;
}

export function TicketStatusBadge({ status, showIcon = true }: TicketStatusBadgeProps) {
  const { getStatusLabel } = useI18n();

  const getStatusConfig = (s: string) => {
    switch (s) {
      case 'PENDING':
        return { variant: 'warning' as const, icon: Clock };
      case 'SEEN':
        return { variant: 'purple' as const, icon: Eye };
      case 'ACCEPTED':
        return { variant: 'blue' as const, icon: CheckCircle2 };
      case 'IN_PROGRESS':
        return { variant: 'purple' as const, icon: PlayCircle };
      case 'REJECTED':
        return { variant: 'destructive' as const, icon: XCircle };
      case 'TRANSFERRED':
        return { variant: 'secondary' as const, icon: ArrowRightLeft };
      case 'UNREACHABLE':
        return { variant: 'warning' as const, icon: PhoneOff };
      case 'COMPLETED':
        return { variant: 'success' as const, icon: CheckCheck };
      case 'CLOSED':
        return { variant: 'outline' as const, icon: Archive };
      default:
        return { variant: 'secondary' as const, icon: Clock };
    }
  };

  const config = getStatusConfig(status);
  const Icon = config.icon;

  return (
    <Badge variant={config.variant}>
      {showIcon && <Icon className="w-3.5 h-3.5 shrink-0" />}
      <span>{getStatusLabel(status)}</span>
    </Badge>
  );
}
