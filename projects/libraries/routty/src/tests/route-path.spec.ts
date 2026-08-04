import {
  compileRoutePath,
  joinRoutePath,
  matchRoutePath,
} from '../lib/route-path';

describe('route path', () => {
  it('compiles literals and parameters once', () => {
    const pattern = compileRoutePath('/teams/:teamId/users/:userId');

    expect(pattern.parameterNames).toEqual(['teamId', 'userId']);
    expect(pattern.patternKey).toBe('teams/:/users/:');
  });

  it('rejects malformed parameter segments', () => {
    expect(() => compileRoutePath('/users/:user-id')).toThrowError(
      /Invalid path parameter segment/,
    );
  });

  it('matches and decodes parameter values', () => {
    const match = matchRoutePath(
      compileRoutePath('/users/:id'),
      '/users/hello%20world',
    );

    expect(match).toEqual({ id: 'hello world' });
  });

  it('requires an exact segment count', () => {
    const pattern = compileRoutePath('/users/:id');

    expect(matchRoutePath(pattern, '/users')).toBeNull();
    expect(matchRoutePath(pattern, '/users/1/details')).toBeNull();
  });

  it('joins normalized route paths', () => {
    expect(joinRoutePath('/app/', '/users/:id/')).toBe('/app/users/:id');
  });
});