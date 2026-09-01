import { HistoryManager } from '../lib/history';
import { getRouterLocation } from '../lib/router-url';

describe('Routty router platform', () => {
  it('provides a stable server location when no document is available', () => {
    const location = getRouterLocation(null);

    expect(location.origin).toBe('http://localhost');
    expect(location.pathname).toBe('/');
    expect(location.search).toBe('');
    expect(location.hash).toBe('');
    expect(location.href).toBe('http://localhost/');
  });

  it('uses the provided document location for SSR request routing', () => {
    const location = {
      origin: 'https://example.test',
      pathname: '/app/projects/101',
      search: '?tab=activity',
      hash: '#details',
      href: 'https://example.test/app/projects/101?tab=activity#details',
    } as Location;

    expect(getRouterLocation({ location })).toBe(location);
  });

  it('supports history bookkeeping without browser globals', () => {
    const manager = new HistoryManager(
      null,
      {
        pathname: '/server',
        search: '?render=1',
        hash: '#top',
      },
    );

    const update = manager.createDefaultUpdate();

    expect(update.previousEntry?.href).toBe('/server?render=1#top');
    expect(update.previousScroll).toEqual({ x: 0, y: 0 });
    expect(update.previousEntry?.state).toBeNull();
  });
});
