import {
  HistoryManager,
  ZERO_SCROLL,
  type HistoryUpdate,
} from '../lib/history';

interface BrowserHarness {
  readonly history: {
    state: unknown;
  };
  scrollX: number;
  scrollY: number;
}

function createHarness(
  href = '/',
  state: unknown = null,
): {
  readonly browser: BrowserHarness;
  readonly location: {
    pathname: string;
    search: string;
    hash: string;
  };
  readonly manager: HistoryManager;
} {
  const url = new URL(href, 'https://example.test');
  const browser: BrowserHarness = {
    history: { state },
    scrollX: 0,
    scrollY: 0,
  };
  const location = {
    pathname: url.pathname,
    search: url.search,
    hash: url.hash,
  };

  return {
    browser,
    location,
    manager: new HistoryManager(
      browser as unknown as Window,
      location as Location,
    ),
  };
}

describe('HistoryManager deep behavior', () => {
  it('creates one stable initial entry', () => {
    const { manager } = createHarness(
      '/start?tab=one#details',
      { initial: true },
    );

    const first = manager.createDefaultUpdate();
    const second = manager.createDefaultUpdate();

    expect(first.previousEntry)
      .toEqual(second.previousEntry);
    expect(first.previousEntry?.href)
      .toBe('/start?tab=one#details');
    expect(first.previousEntry?.state)
      .toEqual({ initial: true });
    expect(first.previousIndex).toBe(0);
    expect(first.nextIndex).toBe(0);
  });

  it('captures the current scroll before creating a push update', () => {
    const { browser, manager } =
      createHarness('/first');

    manager.createDefaultUpdate();
    browser.scrollX = 30;
    browser.scrollY = 140;

    const update = manager.createUpdate(
      '/second',
      false,
      { page: 2 },
    );

    expect(update.type).toBe('push');
    expect(update.previousScroll)
      .toEqual({ x: 30, y: 140 });
    expect(update.nextEntry?.scroll)
      .toBe(ZERO_SCROLL);
    expect(update.nextEntry?.state)
      .toEqual({ page: 2 });
  });

  it('commits a push update as the current entry', () => {
    const { manager } = createHarness('/first');
    manager.createDefaultUpdate();

    const update = manager.createUpdate(
      '/second',
      false,
      { page: 2 },
    );
    manager.commitUpdate(update, '/second');

    const current = manager.createDefaultUpdate();

    expect(current.previousIndex).toBe(1);
    expect(current.previousEntry?.href)
      .toBe('/second');
    expect(current.previousEntry?.state)
      .toEqual({ page: 2 });
  });

  it('rolls a pending push back to the previous entry', () => {
    const { manager } = createHarness('/first');
    manager.createDefaultUpdate();

    const update = manager.createUpdate(
      '/second',
      false,
      null,
    );
    manager.rollbackUpdate(update);

    const current = manager.createDefaultUpdate();

    expect(current.previousIndex).toBe(0);
    expect(current.previousEntry?.href)
      .toBe('/first');
  });

  it('preserves the entry id when replacing', () => {
    const { manager } = createHarness('/first');
    const initial =
      manager.createDefaultUpdate()
        .previousEntry!;

    const update = manager.createUpdate(
      '/replacement',
      true,
      { replaced: true },
    );

    expect(update.type).toBe('replace');
    expect(update.nextEntry?.id)
      .toBe(initial.id);

    manager.commitUpdate(
      update,
      '/replacement',
    );

    expect(
      manager.createDefaultUpdate()
        .previousEntry?.id,
    ).toBe(initial.id);
  });

  it('restores the previous entry when replacement is rolled back', () => {
    const { manager } = createHarness(
      '/first',
      { original: true },
    );
    manager.createDefaultUpdate();

    const update = manager.createUpdate(
      '/replacement',
      true,
      { replacement: true },
    );
    manager.rollbackUpdate(update);

    const current =
      manager.createDefaultUpdate()
        .previousEntry;

    expect(current?.href).toBe('/first');
    expect(current?.state)
      .toEqual({ original: true });
  });

  it('truncates forward entries after a new push branch', () => {
    const { manager } = createHarness('/a');
    manager.createDefaultUpdate();

    const toB = manager.createUpdate(
      '/b',
      false,
      null,
    );
    manager.commitUpdate(toB, '/b');

    const toC = manager.createUpdate(
      '/c',
      false,
      null,
    );
    manager.commitUpdate(toC, '/c');

    const backToB =
      manager.createPopStateUpdate('/b');
    manager.commitUpdate(backToB, '/b');

    const branch = manager.createUpdate(
      '/d',
      false,
      null,
    );
    manager.commitUpdate(branch, '/d');

    const current =
      manager.createDefaultUpdate();

    expect(current.previousEntry?.href)
      .toBe('/d');
    expect(current.previousIndex)
      .toBe(branch.nextIndex);
  });

  it('resolves adjacent backward popstate entries', () => {
    const { manager } = createHarness('/a');
    manager.createDefaultUpdate();

    const toB = manager.createUpdate(
      '/b',
      false,
      null,
    );
    manager.commitUpdate(toB, '/b');

    const update =
      manager.createPopStateUpdate('/a');

    expect(update.type).toBe('popstate');
    expect(update.previousIndex).toBe(1);
    expect(update.nextIndex).toBe(0);
    expect(update.nextEntry?.href).toBe('/a');
  });

  it('resolves adjacent forward popstate entries', () => {
    const { manager } = createHarness('/a');
    manager.createDefaultUpdate();

    const toB = manager.createUpdate(
      '/b',
      false,
      null,
    );
    manager.commitUpdate(toB, '/b');

    const back =
      manager.createPopStateUpdate('/a');
    manager.commitUpdate(back, '/a');

    const forward =
      manager.createPopStateUpdate('/b');

    expect(forward.previousIndex).toBe(0);
    expect(forward.nextIndex).toBe(1);
    expect(forward.nextEntry?.href).toBe('/b');
  });

  it('chooses the nearest duplicate href during popstate resolution', () => {
    const { manager } = createHarness('/same');
    manager.createDefaultUpdate();

    for (const href of ['/x', '/same', '/y']) {
      const update = manager.createUpdate(
        href,
        false,
        null,
      );
      manager.commitUpdate(update, href);
    }

    const target =
      manager.createPopStateUpdate('/same');

    expect(target.previousIndex).toBe(3);
    expect(target.nextIndex).toBe(2);
  });

  it('reads the browser state for a popstate target', () => {
    const { browser, manager } =
      createHarness('/a');

    manager.createDefaultUpdate();
    const toB = manager.createUpdate(
      '/b',
      false,
      { old: true },
    );
    manager.commitUpdate(toB, '/b');

    browser.history.state = {
      restored: true,
    };

    const update =
      manager.createPopStateUpdate('/a');

    expect(update.nextEntry?.state)
      .toEqual({ restored: true });
  });

  it('rolls popstate bookkeeping back to the previous index', () => {
    const { manager } = createHarness('/a');
    manager.createDefaultUpdate();

    const toB = manager.createUpdate(
      '/b',
      false,
      null,
    );
    manager.commitUpdate(toB, '/b');

    const pop =
      manager.createPopStateUpdate('/a');
    manager.rollbackUpdate(pop);

    expect(
      manager.createDefaultUpdate()
        .previousEntry?.href,
    ).toBe('/b');
  });

  it('uses zero scroll for a synthesized committed push entry', () => {
    const { manager } = createHarness('/a');
    manager.createDefaultUpdate();

    const synthetic: HistoryUpdate = {
      type: 'push',
      previousIndex: 0,
      nextIndex: 1,
      previousScroll: {
        x: 10,
        y: 20,
      },
    };

    manager.commitUpdate(
      synthetic,
      '/synthetic',
    );

    expect(
      manager.createDefaultUpdate()
        .previousEntry?.scroll,
    ).toBe(ZERO_SCROLL);
  });
});
