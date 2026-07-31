import { Component } from '@angular/core';
import {
  RouterOutlet,
  StreamixRouterLink,
} from '@epikodelabs/switchboard';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    StreamixRouterLink,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}
