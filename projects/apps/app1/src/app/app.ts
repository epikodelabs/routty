import {
  Component,
  inject,
} from '@angular/core';
import {
  RouterOutlet,
  StreamixRouterLink,
} from '@epikodelabs/switchboard';
import { DemoSessionService, DemoUser } from './demo-session.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    StreamixRouterLink,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly session = inject(DemoSessionService);

  get currentUser(): DemoUser {
    return this.session.currentUser();
  }
}
