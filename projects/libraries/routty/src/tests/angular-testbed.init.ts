import {
  TestBed,
  getTestBed,
} from '@angular/core/testing';

import {
  BrowserTestingModule,
  platformBrowserTesting,
} from '@angular/platform-browser/testing';

export function ensureAngularTestEnvironment(): void {
  const testBed = getTestBed() as {
    platform: unknown | null;
  };

  if (testBed.platform) {
    return;
  }

  TestBed.initTestEnvironment(
    BrowserTestingModule,
    platformBrowserTesting(),
  );
}

ensureAngularTestEnvironment();