export interface ScrollPosition {
  readonly x: number;
  readonly y: number;
}

export interface HistoryEntry {
  readonly id: number;
  readonly href: string;
  readonly scroll: ScrollPosition;
  readonly state: unknown;
}

export interface HistoryUpdate {
  readonly type: 'none' | 'push' | 'replace' | 'popstate';
  readonly previousIndex: number;
  readonly nextIndex: number;
  readonly previousEntry?: HistoryEntry;
  readonly previousScroll: ScrollPosition;
  readonly nextEntry?: HistoryEntry;
}

export const ZERO_SCROLL: ScrollPosition = Object.freeze({ x: 0, y: 0 });

export class HistoryManager {
  constructor(
    private readonly browserWindow: Pick<Window, 'history' | 'scrollX' | 'scrollY'> | null =
      typeof window === 'undefined' ? null : window,
    private readonly location: Pick<Location, 'pathname' | 'search' | 'hash'> =
      typeof window === 'undefined'
        ? { pathname: '/', search: '', hash: '' }
        : window.location,
    private readonly decorateState: (state: unknown, entryId: number) => unknown =
      state => state,
    private readonly readEntryId: (state: unknown) => number | null =
      () => null,
  ) {}

  private entries: HistoryEntry[] = [];
  private index = -1;
  private nextId = 1;

  private get currentHref(): string {
    return this.location.pathname + this.location.search + this.location.hash;
  }

  private readScroll(): ScrollPosition {
    return {
      x: this.browserWindow?.scrollX ?? 0,
      y: this.browserWindow?.scrollY ?? 0,
    };
  }

  private readHistoryState(): unknown {
    return this.browserWindow?.history.state ?? null;
  }

  private allocateId(): number {
    return this.nextId++;
  }

  private ensureHistoryEntry(): void {
    if (this.entries.length > 0) return;

    const browserState = this.readHistoryState();
    const existingId = this.readEntryId(browserState);
    const id = existingId ?? this.allocateId();
    this.nextId = Math.max(this.nextId, id + 1);

    this.entries = [{
      id,
      href: this.currentHref,
      scroll: this.readScroll(),
      state: this.decorateState(browserState, id),
    }];
    this.index = 0;
  }

  private saveCurrentScroll(): ScrollPosition {
    const scroll = this.readScroll();
    const entry = this.entries[this.index];
    if (entry) this.entries[this.index] = { ...entry, scroll };
    return scroll;
  }

  createDefaultUpdate(): HistoryUpdate {
    this.ensureHistoryEntry();
    return {
      type: 'none',
      previousIndex: this.index,
      nextIndex: this.index,
      previousScroll: this.readScroll(),
      previousEntry: this.entries[this.index],
      nextEntry: this.entries[this.index],
    };
  }

  createUpdate(href: string, replace: boolean, state: unknown): HistoryUpdate {
    this.ensureHistoryEntry();
    const previousScroll = this.saveCurrentScroll();
    const previousIndex = this.index;
    const current = this.entries[this.index];
    const id = replace && current ? current.id : this.allocateId();
    const nextEntry: HistoryEntry = {
      id,
      href,
      scroll: replace ? previousScroll : ZERO_SCROLL,
      state: this.decorateState(state, id),
    };

    if (replace) {
      const previousEntry = this.entries[this.index];
      this.entries[this.index] = nextEntry;
      return { type: 'replace', previousIndex, nextIndex: this.index, previousEntry, previousScroll, nextEntry };
    }

    this.entries = this.entries.slice(0, this.index + 1);
    this.entries.push(nextEntry);
    return {
      type: 'push', previousIndex, nextIndex: this.index + 1, previousScroll,
      previousEntry: this.entries[previousIndex], nextEntry,
    };
  }

  createPopStateUpdate(href: string): HistoryUpdate {
    this.ensureHistoryEntry();
    const previousScroll = this.saveCurrentScroll();
    const previousIndex = this.index;
    const browserState = this.readHistoryState();
    const entryId = this.readEntryId(browserState);
    const resolvedIndex = entryId === null
      ? this.findHistoryIndexByHref(href)
      : this.entries.findIndex(entry => entry.id === entryId);
    const nextIndex = resolvedIndex >= 0
      ? resolvedIndex
      : this.entries[previousIndex - 1]
        ? previousIndex - 1
        : previousIndex;
    const existing = this.entries[nextIndex];
    const id = entryId ?? existing?.id ?? this.allocateId();
    const nextEntry: HistoryEntry = existing
      ? { ...existing, id, href, state: this.decorateState(browserState, id) }
      : { id, href, scroll: ZERO_SCROLL, state: this.decorateState(browserState, id) };

    return {
      type: 'popstate', previousIndex, nextIndex, previousScroll,
      previousEntry: this.entries[previousIndex], nextEntry,
    };
  }

  private findHistoryIndexByHref(href: string): number {
    const previous = this.entries[this.index - 1];
    if (previous?.href === href) return this.index - 1;
    const next = this.entries[this.index + 1];
    if (next?.href === href) return this.index + 1;

    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < this.entries.length; index++) {
      if (this.entries[index]?.href !== href || index === this.index) continue;
      const distance = Math.abs(index - this.index);
      if (distance < bestDistance) { bestIndex = index; bestDistance = distance; }
    }
    return bestIndex;
  }

  rollbackUpdate(update: HistoryUpdate): void {
    switch (update.type) {
      case 'push':
        this.entries = this.entries.slice(0, update.previousIndex + 1);
        this.index = update.previousIndex;
        return;
      case 'replace':
        if (update.previousEntry && update.previousIndex >= 0) {
          this.entries[update.previousIndex] = update.previousEntry;
        }
        this.index = update.previousIndex;
        return;
      case 'popstate':
      case 'none':
        this.index = update.previousIndex;
        return;
    }
  }

  commitUpdate(update: HistoryUpdate, href: string): void {
    this.index = update.nextIndex;
    const previous = this.entries[this.index];
    this.entries[this.index] = update.nextEntry ?? {
      id: previous?.id ?? this.allocateId(),
      href,
      scroll: update.type === 'replace' ? update.previousScroll : ZERO_SCROLL,
      state: this.decorateState(null, previous?.id ?? this.nextId - 1),
    };
  }
}
