import { Component } from '@angular/core';
import { RouterOutlet } from '@epikodelabs/routty';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}
