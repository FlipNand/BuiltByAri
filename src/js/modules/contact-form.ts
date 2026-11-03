import {
  FIELD_ORDER,
  hasErrors,
  validateContactForm,
  validateField,
  type ContactErrors,
  type ContactField,
  type ContactValues,
} from '../lib/validation';

/**
 * Contact form controller.
 *
 * - Validates on submit, then re-validates a field as soon as the visitor
 *   edits one that is already flagged, so errors clear as they are fixed.
 * - Renders one error style everywhere: red rule, red text, `aria-invalid`.
 * - Announces the result in a single `role="status"` region and moves focus
 *   to it, so screen-reader users hear the outcome without hunting for it.
 * - POSTs the inquiry as JSON to `data-endpoint` (default `/api/contact`,
 *   the Vercel function in `api/contact.ts`). Nothing is handed off to the
 *   visitor's mail app.
 */

/** Where the form posts when the markup does not name an endpoint. */
export const DEFAULT_ENDPOINT = '/api/contact';

export interface ContactPayload extends ContactValues {
  /** Honeypot: humans never see this field, so only bots fill it in. */
  botcheck: string;
}

export interface ContactFormDeps {
  /** POST destination. */
  endpoint: string;
  /** Resolves true when the endpoint accepted the submission. */
  post: (url: string, values: ContactPayload) => Promise<boolean>;
}

export type StatusKind = 'success' | 'error';

const STATUS_ICON: Record<StatusKind, string> = {
  success: '/icons.svg#check-circle',
  error: '/icons.svg#alert-circle',
};

const FALLBACK_ERROR =
  'Something went wrong sending the form. Please email aristeinberg@icloud.com or call 416-797-4821 and we will pick it up from there.';

function readValues(form: HTMLFormElement): ContactPayload {
  const data = new FormData(form);

  return {
    name: String(data.get('name') ?? ''),
    email: String(data.get('email') ?? ''),
    phone: String(data.get('phone') ?? ''),
    business: String(data.get('business') ?? ''),
    project: String(data.get('project') ?? ''),
    message: String(data.get('message') ?? ''),
    consent: data.get('consent') === 'on',
    botcheck: String(data.get('botcheck') ?? ''),
  };
}

function fieldControl(form: HTMLFormElement, field: ContactField): HTMLElement | null {
  const element = form.elements.namedItem(field);
  if (element instanceof HTMLElement) return element;
  if (element && 'item' in element) {
    const first = element.item(0);
    return first instanceof HTMLElement ? first : null;
  }
  return null;
}

/**
 * Wire up the contact form. Returns a disposer so tests (and any future SPA
 * navigation) can detach listeners cleanly.
 */
export function initContactForm(
  form: HTMLFormElement,
  overrides: Partial<ContactFormDeps> = {},
): () => void {
  const deps: ContactFormDeps = {
    endpoint: overrides.endpoint ?? form.dataset.endpoint ?? DEFAULT_ENDPOINT,
    post:
      overrides.post ??
      (async (url, values) => {
        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(values),
          });
          return response.ok;
        } catch {
          return false;
        }
      }),
  };

  const status = form.querySelector<HTMLElement>('[data-form-status]');
  const statusTitle = status?.querySelector<HTMLElement>('[data-status-title]') ?? null;
  const statusText = status?.querySelector<HTMLElement>('[data-status-text]') ?? null;
  const statusIcon = status?.querySelector<SVGUseElement>('use') ?? null;

  const button = form.querySelector<HTMLButtonElement>('[type="submit"]');
  const buttonLabel = button?.querySelector<HTMLElement>('[data-submit-label]') ?? null;
  const defaultLabel = buttonLabel?.textContent ?? 'Send message';

  /** Fields the visitor has already submitted once — enables live re-checks. */
  const touched = new Set<ContactField>();
  let submitting = false;

  function errorElement(field: ContactField): HTMLElement | null {
    return form.querySelector<HTMLElement>(`[data-error-for="${field}"]`);
  }

  function setFieldError(field: ContactField, message: string | undefined): void {
    const control = fieldControl(form, field);
    const error = errorElement(field);
    const wrapper = control?.closest('.field') ?? null;
    const text = error?.querySelector<HTMLElement>('[data-error-text]') ?? error;

    if (message) {
      if (error && text) text.textContent = message;
      if (error) error.hidden = false;
      wrapper?.classList.add('field--invalid');
      control?.setAttribute('aria-invalid', 'true');
    } else {
      if (error) {
        error.hidden = true;
        if (text) text.textContent = '';
      }
      wrapper?.classList.remove('field--invalid');
      control?.removeAttribute('aria-invalid');
    }
  }

  function renderErrors(errors: ContactErrors): void {
    for (const field of FIELD_ORDER) {
      setFieldError(field, errors[field]);
    }
  }

  function showStatus(kind: StatusKind, title: string, text: string): void {
    if (!status) return;
    status.hidden = false;
    status.classList.toggle('form-status--error', kind === 'error');
    if (statusTitle) statusTitle.textContent = title;
    if (statusText) statusText.textContent = text;
    statusIcon?.setAttribute('href', STATUS_ICON[kind]);
    status.focus({ preventScroll: false });
  }

  function hideStatus(): void {
    if (status) status.hidden = true;
  }

  function setBusy(busy: boolean): void {
    submitting = busy;
    if (button) {
      button.disabled = busy;
      button.setAttribute('aria-busy', String(busy));
    }
    if (buttonLabel) buttonLabel.textContent = busy ? 'Sending…' : defaultLabel;
  }

  function handleSubmit(event: SubmitEvent): void {
    event.preventDefault();
    if (submitting) return;

    const values = readValues(form);
    const errors = validateContactForm(values);

    for (const field of FIELD_ORDER) touched.add(field);

    if (hasErrors(errors)) {
      renderErrors(errors);
      hideStatus();
      const firstInvalid = FIELD_ORDER.find((field) => errors[field] !== undefined);
      if (firstInvalid) fieldControl(form, firstInvalid)?.focus();
      return;
    }

    renderErrors({});
    setBusy(true);
    hideStatus();

    void deps
      .post(deps.endpoint, values)
      .then((sent) => {
        if (!sent) {
          showStatus('error', 'Message not sent', FALLBACK_ERROR);
          return;
        }

        showStatus(
          'success',
          'Thanks — message received.',
          'We read every inquiry and reply within one business day. If it is urgent, call or text 416-797-4821.',
        );
        form.reset();
        renderErrors({});
        touched.clear();
      })
      .finally(() => setBusy(false));
  }

  function handleInput(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const field = target.getAttribute('name') as ContactField | null;
    if (!field || !FIELD_ORDER.includes(field) || !touched.has(field)) return;

    const values = readValues(form);
    setFieldError(field, validateField(field, values));
  }

  function handleChange(event: Event): void {
    handleInput(event);
  }

  form.addEventListener('submit', handleSubmit);
  form.addEventListener('input', handleInput);
  form.addEventListener('change', handleChange);

  return () => {
    form.removeEventListener('submit', handleSubmit);
    form.removeEventListener('input', handleInput);
    form.removeEventListener('change', handleChange);
  };
}
