import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initContactForm } from '../src/js/modules/contact-form';
import { MESSAGES } from '../src/js/lib/validation';
import { fillForm, mountContactForm, VALID_VALUES } from './helpers/contact-form-fixture';

let cleanup: (() => void) | undefined;

function submit(form: HTMLFormElement): void {
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

function errorFor(field: string): HTMLElement {
  const node = document.querySelector<HTMLElement>(`[data-error-for="${field}"]`);
  if (!node) throw new Error(`No error node for ${field}`);
  return node;
}

function control(field: string): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  const node = document.querySelector<HTMLInputElement>(`[name="${field}"]`);
  if (!node) throw new Error(`No control for ${field}`);
  return node;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('initContactForm — validation', () => {
  it('blocks an empty submission and explains every missing field', () => {
    const form = mountContactForm();
    cleanup = initContactForm(form);

    submit(form);

    expect(errorFor('name').hidden).toBe(false);
    expect(errorFor('email').hidden).toBe(false);
    expect(errorFor('message').hidden).toBe(false);
    expect(errorFor('consent').hidden).toBe(false);
    expect(control('name').getAttribute('aria-invalid')).toBe('true');
    expect(errorFor('name').textContent).toContain(MESSAGES.nameRequired);
    expect(control('name').closest('.field')?.classList.contains('field--invalid')).toBe(true);
  });

  it('moves focus to the first invalid field in form order', () => {
    const form = mountContactForm();
    cleanup = initContactForm(form);

    submit(form);

    expect(document.activeElement).toBe(control('name'));
  });

  it('focuses the message field when the name and email are valid', () => {
    const form = mountContactForm();
    cleanup = initContactForm(form);

    fillForm(form, { ...VALID_VALUES, message: '', consent: false });
    submit(form);

    expect(document.activeElement).toBe(control('message'));
  });

  it('keeps optional fields free of errors', () => {
    const form = mountContactForm();
    cleanup = initContactForm(form, { post: vi.fn().mockResolvedValue(true) });

    fillForm(form, { ...VALID_VALUES, phone: '', business: '', project: '' });
    submit(form);

    expect(errorFor('phone').hidden).toBe(true);
    expect(errorFor('business').hidden).toBe(true);
    expect(errorFor('project').hidden).toBe(true);
  });

  it('rejects a phone number that is too short', () => {
    const form = mountContactForm();
    cleanup = initContactForm(form, { post: vi.fn().mockResolvedValue(true) });

    fillForm(form, { ...VALID_VALUES, phone: '416' });
    submit(form);

    expect(errorFor('phone').hidden).toBe(false);
    expect(errorFor('phone').textContent).toContain(MESSAGES.phoneInvalid);
  });

  it('clears an error as soon as the field is corrected', () => {
    const form = mountContactForm();
    cleanup = initContactForm(form, { post: vi.fn().mockResolvedValue(true) });

    submit(form);
    expect(errorFor('name').hidden).toBe(false);

    const name = control('name');
    name.value = 'Ari';
    name.dispatchEvent(new Event('input', { bubbles: true }));

    expect(errorFor('name').hidden).toBe(true);
    expect(name.hasAttribute('aria-invalid')).toBe(false);
  });

  it('clears an error on change for select and checkbox controls', () => {
    const form = mountContactForm();
    cleanup = initContactForm(form, { post: vi.fn().mockResolvedValue(true) });

    submit(form);
    const consent = document.querySelector<HTMLInputElement>('[name="consent"]');
    if (!consent) throw new Error('missing consent control');
    consent.checked = true;
    consent.dispatchEvent(new Event('change', { bubbles: true }));

    expect(errorFor('consent').hidden).toBe(true);
  });

  it('ignores input events from fields that were never submitted', () => {
    const form = mountContactForm();
    cleanup = initContactForm(form, { post: vi.fn().mockResolvedValue(true) });

    const email = control('email');
    email.value = 'not-an-email';
    email.dispatchEvent(new Event('input', { bubbles: true }));

    expect(errorFor('email').hidden).toBe(true);
  });
});

describe('initContactForm — submission', () => {
  it('posts to the default endpoint when the markup names none', async () => {
    const form = mountContactForm();
    const post = vi.fn().mockResolvedValue(true);
    cleanup = initContactForm(form, { post });

    fillForm(form);
    submit(form);

    await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0]?.[0]).toBe('/api/contact');
    expect(post.mock.calls[0]?.[1]).toMatchObject({ botcheck: '' });
  });

  it('sends the honeypot value untouched so the server can judge it', async () => {
    const form = mountContactForm();
    const post = vi.fn().mockResolvedValue(true);
    cleanup = initContactForm(form, { post });

    const honeypot = form.elements.namedItem('botcheck');
    if (!(honeypot instanceof HTMLInputElement)) throw new Error('missing honeypot');
    honeypot.value = 'https://spam.example';

    fillForm(form);
    submit(form);

    await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0]?.[1]).toMatchObject({ botcheck: 'https://spam.example' });
  });

  it('posts with fetch when only an endpoint is configured', async () => {
    const form = mountContactForm();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    cleanup = initContactForm(form, { endpoint: '/api/inquiry' });

    fillForm(form);
    submit(form);

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/inquiry');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toMatchObject({ name: 'Ari Steinberg' });
    await vi.waitFor(() =>
      expect(document.querySelector('[data-form-status]')?.hasAttribute('hidden')).toBe(false),
    );
  });

  it('reports a failure when the network request throws', async () => {
    const form = mountContactForm();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    cleanup = initContactForm(form, { endpoint: '/api/inquiry' });

    fillForm(form);
    submit(form);

    const status = document.querySelector<HTMLElement>('[data-form-status]');
    await vi.waitFor(() => expect(status?.classList.contains('form-status--error')).toBe(true));
    expect(status?.textContent).toContain('Message not sent');
  });

  it('shows the success state, announces it and resets the form', async () => {
    const form = mountContactForm();
    cleanup = initContactForm(form, { post: vi.fn().mockResolvedValue(true) });

    fillForm(form);
    submit(form);

    const status = document.querySelector<HTMLElement>('[data-form-status]');
    await vi.waitFor(() => expect(status?.hidden).toBe(false));

    expect(status?.textContent).toContain('Thanks — message received.');
    expect(status?.textContent).toContain('reply within one business day');
    expect(status?.classList.contains('form-status--error')).toBe(false);
    expect(document.activeElement).toBe(status);
    expect(control('name').value).toBe('');
    expect(document.querySelector('use')?.getAttribute('href')).toBe('/icons.svg#check-circle');
  });

  it('posts to the endpoint when one is configured', async () => {
    const form = mountContactForm();
    const post = vi.fn().mockResolvedValue(true);
    cleanup = initContactForm(form, { endpoint: '/api/inquiry', post });

    fillForm(form);
    submit(form);

    await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0]?.[0]).toBe('/api/inquiry');
    expect(post.mock.calls[0]?.[1]).toMatchObject({
      name: 'Ari Steinberg',
      email: 'ari@web.asteinberg.me',
      business: 'Bloor Bakery',
      project: 'New website',
      consent: true,
    });
  });

  it('shows a failure state when the endpoint rejects the submission', async () => {
    const form = mountContactForm();
    cleanup = initContactForm(form, {
      endpoint: '/api/inquiry',
      post: vi.fn().mockResolvedValue(false),
    });

    fillForm(form);
    submit(form);

    const status = document.querySelector<HTMLElement>('[data-form-status]');
    await vi.waitFor(() => expect(status?.hidden).toBe(false));

    expect(status?.classList.contains('form-status--error')).toBe(true);
    expect(status?.textContent).toContain('Message not sent');
    expect(document.querySelector('use')?.getAttribute('href')).toBe('/icons.svg#alert-circle');
    // The form keeps the visitor's answers so they can retry.
    expect(control('name').value).toBe('Ari Steinberg');
  });

  it('disables the button and reports busy while sending', async () => {
    const form = mountContactForm();
    let resolve: (value: boolean) => void = () => {};
    const post = vi.fn(
      () =>
        new Promise<boolean>((done) => {
          resolve = done;
        }),
    );

    cleanup = initContactForm(form, { endpoint: '/api/inquiry', post });
    fillForm(form);
    submit(form);

    const button = document.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(button?.disabled).toBe(true);
    expect(button?.getAttribute('aria-busy')).toBe('true');
    expect(document.querySelector('[data-submit-label]')?.textContent).toBe('Sending…');

    resolve(true);
    await vi.waitFor(() => expect(button?.disabled).toBe(false));
    expect(button?.getAttribute('aria-busy')).toBe('false');
    expect(document.querySelector('[data-submit-label]')?.textContent).toBe('Send message');
  });

  it('ignores a second submit while the first is in flight', async () => {
    const form = mountContactForm();
    const post = vi.fn().mockResolvedValue(true);
    cleanup = initContactForm(form, { endpoint: '/api/inquiry', post });

    fillForm(form);
    submit(form);
    submit(form);

    await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('never posts when the form has errors', () => {
    const form = mountContactForm();
    const post = vi.fn().mockResolvedValue(true);
    cleanup = initContactForm(form, { post });

    submit(form);

    expect(post).not.toHaveBeenCalled();
  });

  it('prefers a data-endpoint attribute on the form', async () => {
    const form = mountContactForm();
    form.dataset.endpoint = '/from-markup';
    const post = vi.fn().mockResolvedValue(true);
    cleanup = initContactForm(form, { post });

    fillForm(form);
    submit(form);

    await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0]?.[0]).toBe('/from-markup');
  });

  it('detaches every listener on dispose', () => {
    const form = mountContactForm();
    const dispose = initContactForm(form, { post: vi.fn().mockResolvedValue(true) });
    dispose();

    submit(form);

    expect(errorFor('name').hidden).toBe(true);
  });
});
