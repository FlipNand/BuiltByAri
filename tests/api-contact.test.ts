// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildEmail, POST, readPayload } from '../api/contact';
import { VALID_VALUES } from './helpers/contact-form-fixture';

const ENV_KEYS = ['RESEND_API_KEY', 'CONTACT_FROM_EMAIL', 'CONTACT_TO_EMAIL'] as const;

function payload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...VALID_VALUES, botcheck: '', ...overrides };
}

function post(body: unknown, init: RequestInit = {}): Promise<Response> {
  return POST(
    new Request('https://web.asteinberg.me/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
      ...init,
    }),
  );
}

function resendMock(response: Partial<Response> = { ok: true, status: 200 }) {
  return vi.fn().mockResolvedValue(response);
}

beforeEach(() => {
  process.env.RESEND_API_KEY = 'test-key';
  delete process.env.CONTACT_FROM_EMAIL;
  delete process.env.CONTACT_TO_EMAIL;
});

afterEach(() => {
  ENV_KEYS.forEach((key) => delete process.env[key]);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('readPayload', () => {
  it('keeps strings and coerces everything else to empty', () => {
    const values = readPayload({ name: 'Ari', consent: 'yes', message: 42 });

    expect(values.name).toBe('Ari');
    expect(values.consent).toBe(false);
    expect(values.message).toBe('');
    expect(values.botcheck).toBe('');
  });

  it('caps very long input so the request body stays bounded', () => {
    expect(readPayload({ message: 'x'.repeat(5000) }).message).toHaveLength(2500);
  });

  it('survives a null body', () => {
    expect(readPayload(null).name).toBe('');
  });
});

describe('buildEmail', () => {
  it('uses the business name in the subject when there is one', () => {
    const { subject } = buildEmail({ ...VALID_VALUES, consent: true });
    expect(subject).toBe('Website inquiry — Bloor Bakery');
  });

  it('falls back to the person’s name', () => {
    const { subject } = buildEmail({ ...VALID_VALUES, business: '' });
    expect(subject).toBe('Website inquiry — Ari Steinberg');
  });

  it('writes a plain-text body with only the fields that were filled in', () => {
    const { text } = buildEmail({ ...VALID_VALUES, phone: '', business: '', project: '' });

    expect(text).toContain('Name: Ari Steinberg');
    expect(text).toContain('Email: ari@web.asteinberg.me');
    expect(text).toContain('We need a five page site');
    expect(text).not.toContain('Phone:');
    expect(text).not.toContain('Business:');
    expect(text).not.toContain('Project:');
  });
});

describe('POST /api/contact', () => {
  it('delivers a valid inquiry through Resend', async () => {
    const fetchMock = resendMock();
    vi.stubGlobal('fetch', fetchMock);

    const response = await post(payload());
    const body = (await response.json()) as { ok: boolean };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-key');

    const sent = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(sent).toMatchObject({
      from: 'BuiltByAri <onboarding@resend.dev>',
      to: ['aristeinberg@icloud.com'],
      reply_to: 'ari@web.asteinberg.me',
      subject: 'Website inquiry — Bloor Bakery',
    });
    expect(String(sent.text)).toContain('Bloor Bakery');
  });

  it('honours sender and recipient overrides from the environment', async () => {
    process.env.CONTACT_FROM_EMAIL = 'BuiltByAri <hello@web.asteinberg.me>';
    process.env.CONTACT_TO_EMAIL = 'inbox@web.asteinberg.me';
    const fetchMock = resendMock();
    vi.stubGlobal('fetch', fetchMock);

    await post(payload());

    const sent = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body));
    expect(sent.from).toBe('BuiltByAri <hello@web.asteinberg.me>');
    expect(sent.to).toEqual(['inbox@web.asteinberg.me']);
  });

  it('sets a no-store cache header on every response', async () => {
    vi.stubGlobal('fetch', resendMock());
    const response = await post(payload());
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('silently accepts and drops a honeypot submission', async () => {
    const fetchMock = resendMock();
    vi.stubGlobal('fetch', fetchMock);

    const response = await post(payload({ botcheck: 'https://spam.example' }));

    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an invalid submission before calling Resend', async () => {
    const fetchMock = resendMock();
    vi.stubGlobal('fetch', fetchMock);

    const response = await post(payload({ email: 'not-an-email', message: 'too short' }));
    const body = (await response.json()) as { ok: boolean; errors: Record<string, string> };

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.errors.email).toBeTruthy();
    expect(body.errors.message).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requires consent', async () => {
    const fetchMock = resendMock();
    vi.stubGlobal('fetch', fetchMock);

    const response = await post(payload({ consent: false }));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('answers 400 for a body that is not JSON', async () => {
    const response = await post('name=Ari');
    expect(response.status).toBe(400);
  });

  it('answers 413 when the body is oversized', async () => {
    const fetchMock = resendMock();
    vi.stubGlobal('fetch', fetchMock);

    const response = await post(payload({ message: 'x'.repeat(17_000) }));

    expect(response.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails loudly at runtime when the API key is missing', async () => {
    delete process.env.RESEND_API_KEY;
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchMock = resendMock();
    vi.stubGlobal('fetch', fetchMock);

    const response = await post(payload());

    expect(response.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
  });

  it('reports a gateway error when Resend refuses the message', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 422, text: async () => 'domain not verified' }),
    );

    const response = await post(payload());

    expect(response.status).toBe(502);
    expect(error).toHaveBeenCalled();
  });

  it('reports a gateway error when the network throws', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    const response = await post(payload());

    expect(response.status).toBe(502);
  });
});
