import type { ValidatedCommercialInterest } from './interest-validate.js';

const RESEND_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'behaviortrees.com <onboarding@resend.dev>';
const TIMEOUT_MS = 5000;

export function formatInterestEmail(
  interest: ValidatedCommercialInterest,
  isNew: boolean
): { subject: string; text: string } {
  const email = interest.email.trim().toLowerCase();
  const subject = `${isNew ? 'New' : 'Updated'} early-access request: ${email} (${interest.plan})`;
  const text = [
    `Email:    ${email}`,
    `Plan:     ${interest.plan}`,
    `Runtime:  ${interest.runtime}`,
    `Team:     ${interest.usageMode}`,
    `Obstacle: ${interest.obstacle}`,
    `Source:   ${interest.sourcePath}`,
    '',
    interest.obstacleDetail ? `Details:\n${interest.obstacleDetail}` : 'No details given.',
    '',
    'Dashboard: https://www.behaviortrees.com/admin',
  ].join('\n');
  return { subject, text };
}

// Best effort: a failed notification never fails the request, since the row
// is already stored and visible on the admin dashboard.
export async function notifyCommercialInterest(
  interest: ValidatedCommercialInterest,
  isNew: boolean
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.INTEREST_NOTIFY_EMAIL;
  if (!apiKey || !to) return;

  const { subject, text } = formatInterestEmail(interest, isNew);
  try {
    const response = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.INTEREST_NOTIFY_FROM || DEFAULT_FROM,
        to: to.split(',').map((address) => address.trim()).filter(Boolean),
        reply_to: interest.email.trim(),
        subject,
        text,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error('Interest notification failed', response.status, await response.text());
    }
  } catch (error) {
    console.error('Interest notification failed', error);
  }
}
