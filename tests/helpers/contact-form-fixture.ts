/**
 * A trimmed copy of the contact form markup, matching contact/index.html.
 * Keeping it here means the DOM tests exercise the same hooks the real page
 * uses (`data-error-for`, `data-error-text`, `data-form-status`, …).
 */
export const CONTACT_FORM_HTML = `
<form class="form" data-contact-form novalidate>
  <div class="form__honeypot" aria-hidden="true">
    <label for="botcheck">Leave this field empty</label>
    <input id="botcheck" name="botcheck" type="text" tabindex="-1" autocomplete="off" />
  </div>

  <div class="field">
    <label class="field__label" for="name">Name</label>
    <input class="field__control" id="name" name="name" type="text" required aria-describedby="name-error" />
    <p class="field__error" id="name-error" data-error-for="name" hidden>
      <span data-error-text></span>
    </p>
  </div>

  <div class="field">
    <label class="field__label" for="email">Email</label>
    <input class="field__control" id="email" name="email" type="email" required aria-describedby="email-error" />
    <p class="field__error" id="email-error" data-error-for="email" hidden>
      <span data-error-text></span>
    </p>
  </div>

  <div class="field">
    <label class="field__label" for="phone">Phone</label>
    <input class="field__control" id="phone" name="phone" type="tel" aria-describedby="phone-hint phone-error" />
    <p class="field__hint" id="phone-hint">Optional.</p>
    <p class="field__error" id="phone-error" data-error-for="phone" hidden>
      <span data-error-text></span>
    </p>
  </div>

  <div class="field">
    <label class="field__label" for="business">Business</label>
    <input class="field__control" id="business" name="business" type="text" />
    <p class="field__error" id="business-error" data-error-for="business" hidden>
      <span data-error-text></span>
    </p>
  </div>

  <div class="field">
    <label class="field__label" for="project">Project</label>
    <select class="field__control" id="project" name="project">
      <option value="">Choose one</option>
      <option value="New website">A new website</option>
      <option value="Redesign">A redesign</option>
      <option value="Monthly care plan">Hosting and monthly care</option>
      <option value="Something else">Something else</option>
    </select>
    <p class="field__error" id="project-error" data-error-for="project" hidden>
      <span data-error-text></span>
    </p>
  </div>

  <div class="field">
    <label class="field__label" for="message">Message</label>
    <textarea class="field__control" id="message" name="message" required aria-describedby="message-hint message-error"></textarea>
    <p class="field__hint" id="message-hint">A short paragraph is enough.</p>
    <p class="field__error" id="message-error" data-error-for="message" hidden>
      <span data-error-text></span>
    </p>
  </div>

  <div class="field">
    <label class="check" for="consent">
      <input class="check__input" id="consent" name="consent" type="checkbox" required aria-describedby="consent-error" />
      <span class="check__text">I agree to the privacy policy.</span>
    </label>
    <p class="field__error" id="consent-error" data-error-for="consent" hidden>
      <span data-error-text></span>
    </p>
  </div>

  <div class="form-status" role="status" tabindex="-1" data-form-status hidden>
    <svg aria-hidden="true"><use href="/icons.svg#check-circle" /></svg>
    <div class="form-status__body">
      <p class="form-status__title" data-status-title></p>
      <p class="form-status__text" data-status-text></p>
    </div>
  </div>

  <div class="form__actions">
    <button class="btn btn--primary" type="submit">
      <span data-submit-label>Send message</span>
    </button>
  </div>
</form>
`;

export const VALID_VALUES = {
  name: 'Ari Steinberg',
  email: 'ari@web.asteinberg.me',
  phone: '416-797-4821',
  business: 'Bloor Bakery',
  project: 'New website',
  message: 'We need a five page site for a bakery on Bloor Street.',
  consent: true,
};

/** Mount the fixture and return the form element. */
export function mountContactForm(): HTMLFormElement {
  document.body.innerHTML = CONTACT_FORM_HTML;
  const form = document.querySelector('form');
  if (!(form instanceof HTMLFormElement)) throw new Error('Fixture form missing');
  return form;
}

/** Fill every field in the fixture with valid values. */
export function fillForm(form: HTMLFormElement, values = VALID_VALUES): void {
  for (const [key, value] of Object.entries(values)) {
    const control = form.elements.namedItem(key);
    if (control instanceof HTMLInputElement && control.type === 'checkbox') {
      control.checked = Boolean(value);
    } else if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) {
      control.value = String(value);
    } else if (control instanceof HTMLSelectElement) {
      control.value = String(value);
    }
  }
}
