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
  private connected = false;

  @Input() name = '';

  ngOnInit(): void {
    if (!this.shouldConnect()) {
      return;
    }

    this.connected = true;
    this.router.connect(this.name, this.element);
  }

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (!this.connected) {
        return;
      }

      this.router.disconnect(this.name, this.element);
    });
  }

  private shouldConnect(): boolean {
    // Layout composition owns unnamed nested outlets internally. Named outlets
    // still need to register so grouped route commits can target them.
    return this.name.trim() !== '' ||
      this.element.closest('streamix-view') === null;
  }
}
