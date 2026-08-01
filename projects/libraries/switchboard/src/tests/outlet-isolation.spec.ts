import { ensureAngularTestEnvironment } from './angular-testbed.init';

import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RouterOutlet } from '@epikodelabs/switchboard';

ensureAngularTestEnvironment();

@Component({
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
class RouterOutletHost {}

describe('RouterOutlet isolation', () => {
  it('should compile the Angular-compatible router-outlet selector', async () => {
    expect(RouterOutlet).toBeTruthy();
    expect((RouterOutlet as any)['ɵdir']).toBeTruthy();

    await TestBed.configureTestingModule({
      imports: [RouterOutletHost],
    }).compileComponents();

    expect().nothing();
  });
});
