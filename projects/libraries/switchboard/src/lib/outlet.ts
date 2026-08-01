import {
  DestroyRef,
  Directive,
  ElementRef,
  Input,
  OnInit,
  inject,
} from '@angular/core';

import { StreamixRouter } from './streamix-router';

@Directive({ selector: 'router-outlet', standalone: true })
export class RouterOutlet implements OnInit {
  private readonly router = inject(StreamixRouter);
  private readonly element = inject(ElementRef<HTMLElement>).nativeElement;
  private readonly destroyRef = inject(DestroyRef);
  private connectedName = '';

  @Input() name = '';

  ngOnInit(): void {
    this.connectedName = this.resolveName();

    if (!this.shouldConnect(this.connectedName)) {
      return;
    }

    this.router.connect(this.connectedName, this.element);
  }

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (!this.shouldConnect(this.connectedName)) {
        return;
      }

      this.router.disconnect(this.connectedName, this.element);
    });
  }

  private resolveName(): string {
    return (this.name || this.element.getAttribute('name') || '').trim();
  }

  private shouldConnect(name: string): boolean {
    return name !== '' || this.element.closest('streamix-view') === null;
  }
}
