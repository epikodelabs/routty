import { ensureAngularTestEnvironment } from './angular-testbed.init';

import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StreamixOutlet } from '@epikodelabs/streamix/router';

ensureAngularTestEnvironment();

@Component({
  standalone: true,
  imports: [StreamixOutlet],
  template: '<streamix-outlet />',
})
class OutletHost {}

describe('StreamixOutlet isolation', () => {
  it('should compile as a standalone directive', async () => {
    expect(StreamixOutlet).toBeTruthy();
    expect((StreamixOutlet as any)['ɵdir']).toBeTruthy();

    await TestBed.configureTestingModule({
      imports: [OutletHost],
    }).compileComponents();

    expect().nothing();
  });
});
