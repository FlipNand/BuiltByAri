import { describe, expect, it } from 'vitest';
import {
  FIELD_ORDER,
  LIMITS,
  MESSAGES,
  PROJECT_OPTIONS,
  hasErrors,
  validateBusiness,
  validateConsent,
  validateContactForm,
  validateEmail,
  validateField,
  validateMessage,
  validateName,
  validatePhone,
  validateProject,
  type ContactValues,
} from '../src/js/lib/validation';

const valid: ContactValues = {
  name: 'Ari Steinberg',
  email: 'ari@web.asteinberg.me',
  phone: '',
  business: '',
  project: '',
  message: 'We need a five page site for a bakery on Bloor.',
  consent: true,
};

describe('validateName', () => {
  it('accepts a normal name', () => {
    expect(validateName('Ari')).toBeUndefined();
  });

  it('rejects empty and whitespace-only values', () => {
    expect(validateName('')).toBe(MESSAGES.nameRequired);
    expect(validateName('   ')).toBe(MESSAGES.nameRequired);
  });

  it('rejects a single character once trimmed', () => {
    expect(validateName(' A ')).toBe(MESSAGES.nameShort);
  });

  it('rejects names over the limit', () => {
    expect(validateName('a'.repeat(LIMITS.nameMax + 1))).toBe(MESSAGES.nameLong);
  });

  it('accepts a name exactly at the limit', () => {
    expect(validateName('a'.repeat(LIMITS.nameMax))).toBeUndefined();
  });
});

describe('validateEmail', () => {
  it.each(['ari@web.asteinberg.me', 'first.last+tag@sub.domain.co.uk'])('accepts %s', (email) => {
    expect(validateEmail(email)).toBeUndefined();
  });

  it('requires a value', () => {
    expect(validateEmail('')).toBe(MESSAGES.emailRequired);
  });

  it.each(['ari', 'ari@', 'ari@localhost', '@web.asteinberg.me', 'ari web.asteinberg.me', 'a@b..c'])(
    'rejects %s',
    (email) => {
      expect(validateEmail(email)).toBe(MESSAGES.emailInvalid);
    },
  );

  it('rejects an over-long address', () => {
    const long = `${'a'.repeat(LIMITS.emailMax)}@example.com`;
    expect(validateEmail(long)).toBe(MESSAGES.emailLong);
  });
});

describe('validatePhone', () => {
  it('is optional', () => {
    expect(validatePhone('')).toBeUndefined();
    expect(validatePhone('   ')).toBeUndefined();
  });

  it('accepts common formatting', () => {
    expect(validatePhone('416-797-4821')).toBeUndefined();
    expect(validatePhone('+1 (416) 797 4821')).toBeUndefined();
  });

  it('rejects too few or too many digits', () => {
    expect(validatePhone('416-797')).toBe(MESSAGES.phoneInvalid);
    expect(validatePhone('1234567890123456')).toBe(MESSAGES.phoneInvalid);
  });
});

describe('validateBusiness', () => {
  it('is optional', () => {
    expect(validateBusiness('')).toBeUndefined();
  });

  it('rejects an over-long business name', () => {
    expect(validateBusiness('b'.repeat(LIMITS.businessMax + 1))).toBe(MESSAGES.businessLong);
  });
});

describe('validateMessage', () => {
  it('requires a message', () => {
    expect(validateMessage('')).toBe(MESSAGES.messageRequired);
  });

  it('rejects a short message', () => {
    expect(validateMessage('hello')).toBe(MESSAGES.messageShort);
  });

  it('accepts a message at the minimum length', () => {
    expect(validateMessage('x'.repeat(LIMITS.messageMin))).toBeUndefined();
  });

  it('rejects a message over the limit', () => {
    expect(validateMessage('x'.repeat(LIMITS.messageMax + 1))).toBe(MESSAGES.messageLong);
  });
});

describe('validateProject', () => {
  it('allows an empty choice', () => {
    expect(validateProject('')).toBeUndefined();
  });

  it('accepts every offered option', () => {
    for (const option of PROJECT_OPTIONS) {
      expect(validateProject(option)).toBeUndefined();
    }
  });

  it('rejects a value that is not offered', () => {
    expect(validateProject('Free website')).toBe(MESSAGES.projectInvalid);
  });
});

describe('validateConsent', () => {
  it('requires the checkbox', () => {
    expect(validateConsent(false)).toBe(MESSAGES.consentRequired);
    expect(validateConsent(true)).toBeUndefined();
  });
});

describe('validateContactForm', () => {
  it('returns no errors for a complete submission', () => {
    expect(validateContactForm(valid)).toEqual({});
  });

  it('reports every missing required field', () => {
    const errors = validateContactForm({
      name: '',
      email: '',
      phone: '',
      business: '',
      project: '',
      message: '',
      consent: false,
    });

    expect(Object.keys(errors).sort()).toEqual(['consent', 'email', 'message', 'name']);
    expect(hasErrors(errors)).toBe(true);
  });

  it('keeps optional fields silent', () => {
    const errors = validateContactForm({ ...valid, phone: '', business: '', project: '' });
    expect(errors).toEqual({});
  });

  it('validates a single field in isolation', () => {
    expect(validateField('email', { ...valid, email: 'nope' })).toBe(MESSAGES.emailInvalid);
    expect(validateField('phone', valid)).toBeUndefined();
    expect(validateField('consent', { ...valid, consent: false })).toBe(MESSAGES.consentRequired);
  });

  it('covers every field in the declared order', () => {
    expect(FIELD_ORDER).toEqual([
      'name',
      'email',
      'phone',
      'business',
      'project',
      'message',
      'consent',
    ]);
  });
});

describe('hasErrors', () => {
  it('is false for an empty object', () => {
    expect(hasErrors({})).toBe(false);
  });
});
