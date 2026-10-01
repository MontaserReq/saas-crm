'use client';

import { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';

const ASSISTANT_ID = 'e63f621e-f052-4b1b-a4a8-66eddc36709f';
const WIDGET_SCRIPT_ID = 'codeline-hosted-assistant-widget';
const WIDGET_SCRIPT_URL = '/api/chatbot/widget';

function findHostedLauncher(currentLauncher: HTMLButtonElement | null): HTMLElement | null {
  // widget.js renders its launcher inside an open Shadow DOM. Do not use
  // offsetParent here: fixed-position elements inside Shadow DOM can report
  // null even while they are clickable.
  const widgetHosts = document.querySelectorAll<HTMLElement>('[data-codeline-widget="true"]');
  for (const widgetHost of widgetHosts) {
    const shadowLauncher = widgetHost.shadowRoot?.querySelector<HTMLElement>('.launcher');
    if (shadowLauncher && shadowLauncher !== currentLauncher) return shadowLauncher;
  }

  // Do not search ordinary document buttons: the CRM has a separate
  // “Team chat” button, which must never be triggered by the Assistant.
  return null;
}

/** Entry point for the hosted AI assistant widget. */
export function AiAssistantWidget() {
  const { t } = useI18n();
  const launcherRef = useRef<HTMLButtonElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const existing = document.getElementById(WIDGET_SCRIPT_ID);
    if (existing) {
      setIsLoading(false);
      return;
    }

    const script = document.createElement('script');
    script.id = WIDGET_SCRIPT_ID;
    script.src = WIDGET_SCRIPT_URL;
    script.async = true;
    script.dataset.assistant = ASSISTANT_ID;
    script.onload = () => setIsLoading(false);
    script.onerror = () => setIsLoading(false);
    document.body.appendChild(script);
  }, []);

  const openHostedAssistant = () => {
    window.dispatchEvent(new CustomEvent('assistant:open', { detail: { assistant: ASSISTANT_ID } }));
    window.dispatchEvent(new CustomEvent('chatbot:open', { detail: { assistant: ASSISTANT_ID } }));

    // The hosted script may render its own launcher asynchronously. Give it a
    // short window to mount, then trigger it; never open the old CRM panel.
    let attempts = 0;
    const trigger = () => {
      const hostedLauncher = findHostedLauncher(launcherRef.current);
      if (hostedLauncher) {
        hostedLauncher.click();
        return;
      }
      if (attempts++ < 20) window.setTimeout(trigger, 100);
    };
    trigger();
  };

  useEffect(() => {
    const handleMenuOpen = () => openHostedAssistant();
    window.addEventListener('codeline:open-hosted-assistant', handleMenuOpen);
    return () => window.removeEventListener('codeline:open-hosted-assistant', handleMenuOpen);
  }, [openHostedAssistant]);

  return (
    <button
      ref={launcherRef}
      type="button"
      onClick={openHostedAssistant}
      data-codeline-assistant-launcher
      aria-label={t('aiAssistant.launcherLabel')}
      aria-busy={isLoading}
      className="fixed bottom-4 start-4 z-40 flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-tr from-brand-700 to-brand-500 hover:from-brand-600 hover:to-brand-400 text-white shadow-lg shadow-brand-500/30 transition-all active:scale-95"
    >
      <Sparkles className="w-6 h-6" />
    </button>
  );
}
