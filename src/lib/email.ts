import nodemailer from 'nodemailer';

export async function sendTransactionalEmail(input: { to: string; subject: string; text: string; html: string }) {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.EMAIL_FROM || user;
  if (!host || !user || !password || !from) throw new Error('SMTP email is not configured');
  const port = Number(process.env.SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass: password } });
  await transporter.sendMail({ from: process.env.EMAIL_FROM_NAME ? `"${process.env.EMAIL_FROM_NAME}" <${from}>` : from, to: input.to, subject: input.subject, text: input.text, html: input.html });
}
