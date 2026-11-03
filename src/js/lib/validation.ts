/**
 * Contact-form validation.
 *
 * Pure functions only: no DOM, no side effects. This keeps the rules
 * testable in isolation and makes the browser and the tests agree on the
 * exact wording of every message.
 */

export interface ContactValues {
  name: string;
  email: string;
  phone: string;
  business: string;
  project: string;
  message: string;
  consent: boolean;
}

export type ContactField = keyof ContactValues;
export type ContactErrors = Partial<Record<ContactField, string>>;

export const MESSAGES = {
  nameRequired: 'Please enter your name.',
  nameShort: 'Please use at least 2 characters.',
  nameLong: 'Please keep your name under 80 characters.',
  emailRequired: 'Please enter your email address.',
  emailInvalid: 'Please enter a valid email address, like you@business.ca.',
  emailLong: 'That email address is too long.',
  phoneInvalid: 'Please enter a phone number with 10 to 15 digits.',
  businessLong: 'Please keep your business name under 120 characters.',
  projectInvalid: 'Please choose an option from the list.',
  messageRequired: 'Please tell us what you need.',
  messageShort: 'A little more detail helps — at least 20 characters.',
  messageLong: 'Please keep your message under 2,000 characters.',
  consentRequired: 'Please confirm you agree to the privacy policy.',
} as const;

export const LIMITS = {
  nameMin: 2,
  nameMax: 80,
  emailMax: 254,
  businessMax: 120,
  messageMin: 20,
  messageMax: 2000,
  phoneMinDigits: 10,
  phoneMaxDigits: 15,
} as const;

/** Project options offered in the form's select. Also used by tests. */
export const PROJECT_OPTIONS = [
  'New website',
  'Redesign',
  'Monthly care plan',
  'Something else',
] as const;

/** Deliberately simple: one @, a dot in the domain, no whitespace. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

export function validateName(value: string): string | undefined {
  const name = value.trim();
  if (!name) return MESSAGES.nameRequired;
  if (name.length < LIMITS.nameMin) return MESSAGES.nameShort;
  if (name.length > LIMITS.nameMax) return MESSAGES.nameLong;
  return undefined;
}

export function validateEmail(value: string): string | undefined {
  const email = value.trim();
  if (!email) return MESSAGES.emailRequired;
  if (email.length > LIMITS.emailMax) return MESSAGES.emailLong;
  if (!EMAIL_PATTERN.test(email)) return MESSAGES.emailInvalid;
  return undefined;
}

/** Phone is optional; only validated once something is typed. */
export function validatePhone(value: string): string | undefined {
  const phone = value.trim();
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < LIMITS.phoneMinDigits || digits.length > LIMITS.phoneMaxDigits) {
    return MESSAGES.phoneInvalid;
  }
  return undefined;
}

export function validateBusiness(value: string): string | undefined {
  if (value.trim().length > LIMITS.businessMax) return MESSAGES.businessLong;
  return undefined;
}

export function validateMessage(value: string): string | undefined {
  const message = value.trim();
  if (!message) return MESSAGES.messageRequired;
  if (message.length < LIMITS.messageMin) return MESSAGES.messageShort;
  if (message.length > LIMITS.messageMax) return MESSAGES.messageLong;
  return undefined;
}

export function validateProject(value: string): string | undefined {
  if (!value) return undefined;
  return (PROJECT_OPTIONS as readonly string[]).includes(value)
    ? undefined
    : MESSAGES.projectInvalid;
}

export function validateConsent(value: boolean): string | undefined {
  return value ? undefined : MESSAGES.consentRequired;
}

/** Validate one field by name — used for per-field re-validation on input. */
export function validateField(field: ContactField, values: ContactValues): string | undefined {
  switch (field) {
    case 'name':
      return validateName(values.name);
    case 'email':
      return validateEmail(values.email);
    case 'phone':
      return validatePhone(values.phone);
    case 'business':
      return validateBusiness(values.business);
    case 'project':
      return validateProject(values.project);
    case 'message':
      return validateMessage(values.message);
    case 'consent':
      return validateConsent(values.consent);
    default:
      return undefined;
  }
}

/** Order the messages appear in the UI, so focus order matches the form. */
export const FIELD_ORDER: ContactField[] = [
  'name',
  'email',
  'phone',
  'business',
  'project',
  'message',
  'consent',
];

/** Validate the whole form, returning only the fields that failed. */
export function validateContactForm(values: ContactValues): ContactErrors {
  const errors: ContactErrors = {};

  for (const field of FIELD_ORDER) {
    const error = validateField(field, values);
    if (error) errors[field] = error;
  }

  return errors;
}

export function hasErrors(errors: ContactErrors): boolean {
  return Object.keys(errors).length > 0;
}
