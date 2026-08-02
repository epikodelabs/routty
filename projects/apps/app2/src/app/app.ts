import {
  Component,
  inject,
} from '@angular/core';
import {
  RouterOutlet,
  RouterLink,
} from '@epikodelabs/routty';
import { DemoSessionService } from '../../../app1/src/app/demo-session.service';

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
  protected readonly session = inject(DemoSessionService);
}

