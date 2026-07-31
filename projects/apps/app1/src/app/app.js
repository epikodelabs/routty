import { __decorate } from "tslib";
import { Component } from '@angular/core';
import { RouterOutlet, StreamixRouterLink, } from '@epikodelabs/switchboard';
let App = class App {
};
App = __decorate([
    Component({
        selector: 'app-root',
        imports: [
            RouterOutlet,
            StreamixRouterLink,
        ],
        templateUrl: './app.html',
        styleUrl: './app.css',
    })
], App);
export { App };
