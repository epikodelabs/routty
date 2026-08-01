import {
  ApplicationConfig,
  mergeApplicationConfig,
} from '@angular/core';
import { provideClientHydration } from '@angular/platform-browser';
import { appConfig as browserConfig } from '../../../app1/src/app/app.config';

const hydrationConfig: ApplicationConfig = {
  providers: [provideClientHydration()],
};

export const appConfig = mergeApplicationConfig(
  browserConfig,
  hydrationConfig,
);
