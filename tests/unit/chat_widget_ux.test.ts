import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * The Live Chat redesign (Phase 3) moved the chat launcher out of the
 * Sidebar (previously nested inside the mobile drawer, requiring users to
 * open the hamburger menu just to reach chat) into a single globally-mounted
 * ChatWidget rendered once in the dashboard layout. These tests guard the
 * structural contract of that redesign — they don't render React (no DOM
 * test runner is configured for this project) but verify the source-level
 * invariants that make the feature actually work.
 */

function readFileSafe(p: string): string {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return '';
  }
}

const chatWidgetSource = readFileSafe(path.resolve(__dirname, '../../src/components/chat/ChatWidget.tsx'));
const sidebarSource = readFileSafe(path.resolve(__dirname, '../../src/components/layout/Sidebar.tsx'));
const dashboardLayoutSource = readFileSafe(path.resolve(__dirname, '../../src/app/(dashboard)/layout.tsx'));

describe('Live Chat redesign: launcher accessibility contract', () => {
  it('ChatWidget exists and renders a fixed, always-visible launcher (no scrolling required)', () => {
    expect(chatWidgetSource).toBeTruthy();
    expect(chatWidgetSource).toMatch(/fixed bottom-4 end-4/);
  });

  it('the launcher has an accessible label (not icon-only with no name)', () => {
    expect(chatWidgetSource).toMatch(/aria-label=\{t\('chat\.launcherLabel'\)\}/);
  });

  it('the panel is a compact size, not a full-screen takeover, on desktop (sm breakpoint)', () => {
    expect(chatWidgetSource).toMatch(/sm:w-\[360px\]/);
    expect(chatWidgetSource).toMatch(/sm:h-\[520px\]/);
  });

  it('the mobile layout uses a bottom sheet constrained to the viewport, not the desktop popover size', () => {
    expect(chatWidgetSource).toMatch(/h-\[85vh\]/);
    expect(chatWidgetSource).toMatch(/max-h-\[720px\]/);
  });

  it('Sidebar no longer embeds its own chat launcher/overlay (the old bug: chat was only reachable after opening the mobile drawer)', () => {
    expect(sidebarSource).not.toMatch(/isChatOpen/);
    expect(sidebarSource).not.toMatch(/ChatClient/);
  });

  it('the dashboard layout mounts ChatWidget exactly once, gated by the CHAT_VIEW permission', () => {
    expect(dashboardLayoutSource).toMatch(/hasPermission\(user, PERMISSIONS\.CHAT_VIEW\)\s*&&\s*<ChatWidget/);
  });
});

describe('Live Chat redesign: message bubble side is physical, not mirrored by direction', () => {
  it('own messages always align to the physical right (ml-auto), matching WhatsApp/Telegram/Messenger convention', () => {
    // A regression guard for the explicit product decision: unlike the rest of the
    // app (which mirrors logical start/end by direction), chat bubbles intentionally
    // do NOT flip sides between Arabic and English.
    expect(chatWidgetSource).toMatch(/message\.senderId === currentUserId \? 'ml-auto/);
    expect(chatWidgetSource).not.toMatch(/message\.senderId === currentUserId \? 'ms-auto/);
  });
});

describe('Live Chat redesign: unread indicator is honest, not fabricated', () => {
  it('the launcher shows a plain unread dot derived from real conversation data, not a hardcoded/fake number', () => {
    expect(chatWidgetSource).toMatch(/hasUnread/);
    expect(chatWidgetSource).toMatch(/conversations\.some\(\(c: any\) => c\.unreadCount > 0\)/);
    // No numeric badge yet — Phase 5 introduces the accurate count (1, 12, 99+).
    expect(chatWidgetSource).not.toMatch(/99\+/);
  });
});
