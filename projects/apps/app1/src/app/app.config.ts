import {
  ApplicationConfig,
  ApplicationModule,
  importProvidersFrom,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { provideStreamixRouter } from '@epikodelabs/switchboard';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    importProvidersFrom(ApplicationModule, BrowserModule),
    provideBrowserGlobalErrorListeners(),
    ...provideStreamixRouter(routes, {
      viewTransitions: true,
    }),
  ],
};
