'use client';

import { useState } from 'react';
import { TicketStatus } from '@/types';
import { useI18n } from '@/lib/i18n/context';
import { acceptTicketAction } from '@/server/actions/tickets';
import { RejectionModal } from './RejectionModal';
import { TransferModal } from './TransferModal';
import { CommunicationAttemptModal } from './CommunicationAttemptModal';
import { CloseTicketModal } from './CloseTicketModal';
import {
  CheckCircle2,
  XCircle,
  PhoneCall,
  Archive,
  ArrowRightLeft,
} from 'lucide-react';

interface TicketActionButtonsProps {
  ticket: {
    id: string;
    ticketNumber: string;
    status: TicketStatus | string;
  };
  teamMembers: Array<{ id: string; name: string; email: string; department?: { name: string } }>;
  canAcceptReject?: boolean;
  canTransfer?: boolean;
}

export function TicketActionButtons({
  ticket,
  teamMembers,
  canAcceptReject = true,
  canTransfer = false,
}: TicketActionButtonsProps) {
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isAttemptOpen, setIsAttemptOpen] = useState(false);
  const [isCloseOpen, setIsCloseOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { t, language } = useI18n();

  // If ticket is closed or rejected, no action buttons should be available
  if (ticket.status === 'CLOSED' || ticket.status === 'REJECTED') {
    return null;
  }

  const handleAccept = async () => {
    setLoading(true);
    await acceptTicketAction(ticket.id);
    setLoading(false);
  };

  const isPendingState = ticket.status === 'PENDING' || ticket.status === 'SEEN' || ticket.status === 'TRANSFERRED';
  const isAcceptedOrActive = ['ACCEPTED', 'IN_PROGRESS', 'UNREACHABLE', 'COMPLETED'].includes(ticket.status);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Log Contact Attempt button (available while active) */}
      <button
        type="button"
        onClick={() => setIsAttemptOpen(true)}
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-brand-500 shadow-sm transition-colors"
      >
        <PhoneCall className="w-3.5 h-3.5 text-brand-600" />
        <span>{t('tickets.logAttempt')}</span>
      </button>

      {/* Before Accept: Accept & Reject */}
      {isPendingState && canAcceptReject && (
        <>
          <button
            type="button"
            onClick={handleAccept}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-500/20 transition-all disabled:opacity-50"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{t('tickets.accept')}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsRejectOpen(true)}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 transition-colors disabled:opacity-50"
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>{t('tickets.reject')}</span>
          </button>
        </>
      )}

      {/* After Accept: Close Ticket */}
      {isAcceptedOrActive && (
        <button
          type="button"
          onClick={() => setIsCloseOpen(true)}
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-black dark:bg-slate-700 dark:hover:bg-slate-600 shadow-md transition-all disabled:opacity-50"
        >
          <Archive className="w-3.5 h-3.5 text-amber-400" />
          <span>{t('tickets.closeTicket')}</span>
        </button>
      )}

      {/* Admin Transfer Override if explicitly allowed */}
      {canTransfer && (
        <button
          type="button"
          onClick={() => setIsTransferOpen(true)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
        >
          <ArrowRightLeft className="w-3.5 h-3.5 text-slate-500" />
          <span>{t('tickets.transfer')}</span>
        </button>
      )}

      {/* Modals */}
      <RejectionModal
        isOpen={isRejectOpen}
        onClose={() => setIsRejectOpen(false)}
        ticketId={ticket.id}
        ticketNumber={ticket.ticketNumber}
      />

      <CloseTicketModal
        isOpen={isCloseOpen}
        onClose={() => setIsCloseOpen(false)}
        ticketId={ticket.id}
        ticketNumber={ticket.ticketNumber}
      />

      <TransferModal
        isOpen={isTransferOpen}
        onClose={() => setIsTransferOpen(false)}
        ticketId={ticket.id}
        ticketNumber={ticket.ticketNumber}
        teamMembers={teamMembers}
      />

      <CommunicationAttemptModal
        isOpen={isAttemptOpen}
        onClose={() => setIsAttemptOpen(false)}
        ticketId={ticket.id}
        ticketNumber={ticket.ticketNumber}
      />
    </div>
  );
}
