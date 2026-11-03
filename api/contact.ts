import { hasErrors, validateContactForm, type ContactValues } from '../src/js/lib/validation';

/**
 * `POST /api/contact` — Vercel Function that delivers the inquiry by email.
 *
 * Why this exists: the contact page used to hand the finished message to the
 * visitor's mail app with a `mailto:` link. Many browsers and phones have no
 * mail app configured, so those inquiries were silently lost. The form now
 * POSTs JSON here and this function sends the mail server-side through Resend.
 *
 * Environment variables (set them in Vercel → Project → Settings → Environment
 * Variables, never in the repo):
 *   RESEND_API_KEY      required — API key from https://resend.com/api-keys
 *   CONTACT_FROM_EMAIL  optional — verified sender, e.g. "BuiltByAri <hello@web.asteinberg.me>"
 *   CONTACT_TO_EMAIL    optional — where inquiries land (defaults to the studio inbox)
 *
 * Until a domain is verified in Resend, sending from `onboarding@resend.dev`
 * works but only delivers to the Resend account owner's own address.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const MAX_BODY_BYTES = 16_000;
const DEFAULT_FROM = 'BuiltByAri <onboarding@resend.dev>';
const DEFAULT_TO = 'aristeinberg@icloud.com';

export interface ContactPayload extends ContactValues {
  /** Honeypot: hidden input that only automated submissions fill in. */
  botcheck: string;
}

export interface ContactEmail {
  subject: string;
  text: string;
}

/** JSON response, never cached — form results are per-request. */
function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function asString(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

/** Normalise whatever arrived into the shape the shared validator expects. */
export function readPayload(input: unknown): ContactPayload {
  const data = (input ?? {}) as Record<string, unknown>;

  return {
    name: asString(data.name, 200),
    email: asString(data.email, 320),
    phone: asString(data.phone, 40),
    business: asString(data.business, 200),
    project: asString(data.project, 80),
    message: asString(data.message, 2500),
    consent: data.consent === true,
    botcheck: asString(data.botcheck, 200),
  };
}

/** Plain-text notification email. Text only: nothing to escape, nothing to inject. */
export function buildEmail(values: ContactValues): ContactEmail {
  const who = values.business.trim() || values.name.trim();
  const subject = `Website inquiry — ${who}`.slice(0, 120);

  const lines = [
    `Name: ${values.name.trim()}`,
    `Email: ${values.email.trim()}`,
    values.phone.trim() ? `Phone: ${values.phone.trim()}` : null,
    values.business.trim() ? `Business: ${values.business.trim()}` : null,
    values.project ? `Project: ${values.project}` : null,
    '',
    values.message.trim(),
  ].filter((line): line is string => line !== null);

  return { subject, text: lines.join('\n') };
}

export async function POST(request: Request): Promise<Response> {
  const raw = await request.text();

  if (raw.length > MAX_BODY_BYTES) {
    return json(413, { ok: false, message: 'That message is too long to send.' });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return json(400, { ok: false, message: 'That submission could not be read.' });
  }

  const values = readPayload(parsed);

  // Honeypot hit: answer 200 so bots believe they succeeded, drop the message.
  if (values.botcheck.trim()) {
    return json(200, { ok: true });
  }

  // Re-validate here too: the browser check is a convenience, not a guarantee.
  const errors = validateContactForm(values);
  if (hasErrors(errors)) {
    return json(400, {
      ok: false,
      message: 'Please check the highlighted fields and try again.',
      errors,
    });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('contact: RESEND_API_KEY is not set — cannot deliver the inquiry');
    return json(500, { ok: false, message: 'Email delivery is not configured yet.' });
  }

  const { subject, text } = buildEmail(values);

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.CONTACT_FROM_EMAIL ?? DEFAULT_FROM,
        to: [process.env.CONTACT_TO_EMAIL ?? DEFAULT_TO],
        reply_to: values.email.trim(),
        subject,
        text,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error('contact: Resend rejected the message', response.status, detail.slice(0, 300));
      return json(502, { ok: false, message: 'The message could not be sent right now.' });
    }
  } catch (error) {
    console.error('contact: Resend request failed', error);
    return json(502, { ok: false, message: 'The message could not be sent right now.' });
  }

  return json(200, { ok: true });
}
