import fs from 'node:fs/promises';
import path from 'node:path';
import nodemailer from 'nodemailer';

const intervalMs = Math.max(15, Number(process.env.MONITOR_INTERVAL_SECONDS || 60)) * 1000;
const timeoutMs = Math.max(2_000, Number(process.env.MONITOR_TIMEOUT_MS || 10_000));
const failureThreshold = Math.max(1, Number(process.env.MONITOR_FAILURE_THRESHOLD || 1));
const recoveryThreshold = Math.max(1, Number(process.env.MONITOR_RECOVERY_THRESHOLD || 1));
const stateFile = process.env.MONITOR_STATE_FILE || '/var/lib/satrcrm-monitor/state.json';
const recipient = process.env.ALERT_EMAIL_TO || '';
const monitorUrls = (process.env.MONITOR_URLS || 'https://satrcrm.com/api/health,https://satrcrm.com/,https://app.satrcrm.com/')
  .split(',').map((entry) => entry.trim()).filter(Boolean).map((entry) => {
    const [url, label] = entry.split('|', 2);
    return { url, label: label || url };
  });

const smtpPort = Number(process.env.SMTP_PORT || 587);
const transporter = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD
  ? nodemailer.createTransport({ host: process.env.SMTP_HOST, port: smtpPort, secure: smtpPort === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } })
  : null;

async function loadState() {
  try { return JSON.parse(await fs.readFile(stateFile, 'utf8')); } catch { return {}; }
}

async function saveState(state) {
  await fs.mkdir(path.dirname(stateFile), { recursive: true });
  await fs.writeFile(stateFile, JSON.stringify(state, null, 2));
}

async function checkTarget(target) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const response = await fetch(target.url, { signal: controller.signal, redirect: 'follow', headers: { 'user-agent': 'SatrCRM-Uptime-Monitor/1.0' } });
    const body = target.url.endsWith('/api/health') ? await response.text() : '';
    const healthy = response.ok && (!target.url.endsWith('/api/health') || body.includes('"status":"ok"'));
    return { healthy, status: response.status, durationMs: Date.now() - started, error: healthy ? '' : `HTTP ${response.status}` };
  } catch (error) {
    return { healthy: false, status: 0, durationMs: Date.now() - started, error: error instanceof Error ? error.message : String(error) };
  } finally { clearTimeout(timeout); }
}

async function sendAlert(subject, results) {
  if (!transporter || !recipient) { console.error('[monitor] SMTP or ALERT_EMAIL_TO is not configured', subject); return; }
  const lines = results.map((result) => `${result.label}: ${result.healthy ? 'OK' : `DOWN (${result.error})`} [${result.durationMs}ms]`);
  await transporter.sendMail({ from: process.env.EMAIL_FROM || process.env.SMTP_USER, to: recipient, subject, text: ['SatrCRM uptime monitor', '', ...lines].join('\n') });
}

async function runOnce() {
  const state = await loadState();
  for (const target of monitorUrls) {
    const result = await checkTarget(target);
    const previous = state[target.url] || { down: false, failures: 0, successes: 0 };
    const next = { ...previous, label: target.label, ...result };
    if (result.healthy) {
      next.failures = 0;
      next.successes = (previous.successes || 0) + 1;
      if (previous.down && next.successes >= recoveryThreshold) { next.down = false; await sendAlert(`[SatrCRM] Service recovered: ${target.label}`, [{ label: target.label, ...result }]); }
    } else {
      next.successes = 0;
      next.failures = (previous.failures || 0) + 1;
      if (!previous.down && next.failures >= failureThreshold) { next.down = true; await sendAlert(`[SatrCRM] Service down: ${target.label}`, [{ label: target.label, ...result }]); }
    }
    state[target.url] = next;
    console.log(new Date().toISOString(), `${target.label}=${result.healthy ? 'ok' : 'down'}`);
  }
  await saveState(state);
}

if (!monitorUrls.length) throw new Error('MONITOR_URLS must contain at least one URL');
for (;;) {
  try { await runOnce(); } catch (error) { console.error('[monitor] check failed', error); }
  await new Promise((resolve) => setTimeout(resolve, intervalMs));
}
