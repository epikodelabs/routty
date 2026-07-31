import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideStreamixRouter } from '@epikodelabs/switchboard';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    ...provideStreamixRouter(routes, {
      viewTransitions: true,
    }),
  ],
};
