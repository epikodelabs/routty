import {
  Component,
  inject,
} from '@angular/core';
import {
  RouterOutlet,
  RouterLink,
} from '@epikodelabs/routty';
import { DemoSessionService, DemoUser } from './demo-session.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
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

