import {
  s,
  serializeQuery,
} from '@epikodelabs/routty';

describe('query schema serialization', () => {
  it('omits array values that match the schema default', () => {
    const query =
      serializeQuery(
        {
          filters: s.array(['active', 'recent']),
          page: s.number({ default: 1 }),
        },
        {
          filters: ['active', 'recent'],
          page: 1,
        },
      );

    expect(query).toBe('');
  });

  it('serializes array values when they differ from the schema default', () => {
    const query =
      serializeQuery(
        {
          filters: s.array(['active']),
        },
        {
          filters: ['active', 'recent'],
        },
      );

    expect(query).toBe('?filters=active&filters=recent');
  });
});