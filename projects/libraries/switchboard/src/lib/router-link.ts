import {
  Directive,
  HostBinding,
  Input,
  inject,
} from '@angular/core';

import type { NavigationTarget } from './navigation-types';
import { StreamixRouter } from './streamix-router';

@Directive({
  selector: 'a[routerLink], area[routerLink]',
  standalone: true,
})
export class StreamixRouterLink {
  private readonly router = inject(StreamixRouter);

  @Input('routerLink')
  routerLink: NavigationTarget | null | undefined;

  @HostBinding('attr.href')
  get href(): string | null {
    return this.router.href(this.routerLink);
  }
}
