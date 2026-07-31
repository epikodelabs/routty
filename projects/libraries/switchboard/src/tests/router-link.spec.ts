import { ensureAngularTestEnvironment } from './angular-testbed.init';

import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  RouterLink,
  RouterOutlet,
  StreamixRouter,
  provideStreamixRouter,
  route,
} from '@epikodelabs/switchboard';

ensureAngularTestEnvironment();

function delay(ms = 0): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function dispatchAnchorClick(target: HTMLAnchorElement): boolean {
  const event = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    button: 0,
  });

  let defaultPrevented = false;
  const cleanupListener = (currentEvent: MouseEvent) => {
    defaultPrevented = currentEvent.defaultPrevented;
    currentEvent.preventDefault();
  };

  document.addEventListener('click', cleanupListener);
  try {
    target.dispatchEvent(event);
  } finally {
    document.removeEventListener('click', cleanupListener);
  }

  return defaultPrevented;
}

@Component({
  standalone: true,
  template: '<h1>Home</h1>',
})
class HomeComponent {}

@Component({
  standalone: true,
  template: '<h1>About</h1>',
})
class AboutComponent {}

@Component({
  standalone: true,
  imports: [RouterLink, RouterOutlet],
  template: '<a [routerLink]="target">About</a><router-outlet />',
})
class RouterLinkHostComponent {
  target = '/about';
}

describe('StreamixRouterLink', () => {
  let router: StreamixRouter;

  beforeEach(() => {
    TestBed.resetTestingModule();
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    router?.dispose();
  });

  it('binds href for routerLink and navigates through anchor clicks', async () => {
    await TestBed.configureTestingModule({
      imports: [
        HomeComponent,
        AboutComponent,
        RouterLinkHostComponent,
      ],
      providers: [
        ...provideStreamixRouter([
          route('/', HomeComponent),
          route('/about', AboutComponent),
        ]),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(RouterLinkHostComponent);
    router = TestBed.inject(StreamixRouter);

    fixture.detectChanges();
    await delay();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const anchor = host.querySelector('a');

    expect(anchor).not.toBeNull();
    expect(anchor?.getAttribute('href')).toBe('/about');

    const defaultPrevented = dispatchAnchorClick(anchor as HTMLAnchorElement);

    await delay();
    fixture.detectChanges();

    expect(defaultPrevented).toBeTrue();
    expect(router.state.current?.path).toBe('/about');
    expect(host.textContent).toContain('About');
  });
});
