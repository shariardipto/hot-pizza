import { describe, expect, it } from 'vitest';
import { isBlockedCustomer } from './abuse.ts';

describe('isBlockedCustomer', () => {
  const list = ['+880 1712-345678', 'Fraud@Example.com', '07911 123456'];

  it('matches phone numbers whatever the format of the entry', () => {
    expect(isBlockedCustomer(list, { phone: '+8801712345678' })).toBe(true); // BD, entered with country code
    expect(isBlockedCustomer(list, { phone: '+447911123456' })).toBe(true); // UK, entered in national format
    expect(isBlockedCustomer(['01712345678'], { phone: '+8801712345678' })).toBe(true);
  });

  it('matches e-mails case-insensitively', () => {
    expect(isBlockedCustomer(list, { phone: '+34600000000', email: 'fraud@example.COM' })).toBe(true);
  });

  it('does not block other customers', () => {
    expect(isBlockedCustomer(list, { phone: '+8801712345679' })).toBe(false);
    expect(isBlockedCustomer(list, { phone: '+34600000000', email: 'someone@example.com' })).toBe(false);
    expect(isBlockedCustomer([], { phone: '+8801712345678' })).toBe(false);
  });

  it('ignores entries too short to identify a phone (no accidental mass blocking)', () => {
    expect(isBlockedCustomer(['123', '0'], { phone: '+8801712345123' })).toBe(false);
  });
});
