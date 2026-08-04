import {
  parseParams,
  parseQuery,
  s,
} from '../lib/query-schema';

describe('strict route schema parsing', () => {
  it('rejects numbers below their minimum instead of clamping them', () => {
    expect(() => parseParams(
      { id: s.number({ min: 1 }) },
      { id: '0' },
    )).toThrowError(/below the minimum 1/);
  });

  it('rejects numbers above their maximum instead of clamping them', () => {
    expect(() => parseParams(
      { page: s.number({ max: 10 }) },
      { page: '11' },
    )).toThrowError(/above the maximum 10/);
  });

  it('rejects invalid booleans instead of treating them as false', () => {
    expect(() => parseQuery(
      { enabled: s.boolean() },
      new URL('https://example.test/?enabled=banana'),
    )).toThrowError(/Invalid boolean value/);
  });

  it('does not use a default to hide an invalid supplied value', () => {
    expect(() => parseQuery(
      { page: s.number({ default: 1 }) },
      new URL('https://example.test/?page=nope'),
    )).toThrowError(/Invalid number value/);
  });

  it('rejects missing required path parameters', () => {
    expect(() => parseParams(
      { id: s.number() },
      {},
    )).toThrowError(/Missing required path parameter "id"/);
  });
});