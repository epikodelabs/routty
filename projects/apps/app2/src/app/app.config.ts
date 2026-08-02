import {
  ApplicationConfig,
  ApplicationModule,
  importProvidersFrom,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { BrowserModule, provideClientHydration } from '@angular/platform-browser';
import { provideRouter } from '@epikodelabs/routty';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    importProvidersFrom(ApplicationModule, BrowserModule),
    provideBrowserGlobalErrorListeners(),
    provideClientHydration(),
    ...provideRouter(routes, {
      viewTransitions: true,
    }),
  ],
};
