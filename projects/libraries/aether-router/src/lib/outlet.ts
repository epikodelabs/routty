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
  private readonly shouldConnect =
    this.element.closest('streamix-view') === null;

  @Input() name = '';

  ngOnInit(): void {
    if (!this.shouldConnect) {
      return;
    }

    this.router.connect(this.name, this.element);
  }

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (!this.shouldConnect) {
        return;
      }

      this.router.disconnect(this.name, this.element);
    });
  }
}
