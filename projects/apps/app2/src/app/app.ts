import {
  Component,
  inject,
} from '@angular/core';
import {
  RouterOutlet,
  StreamixRouterLink,
} from '@epikodelabs/switchboard';
import { DemoSessionService } from '../../../app1/src/app/demo-session.service';

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
  protected readonly session = inject(DemoSessionService);
}
