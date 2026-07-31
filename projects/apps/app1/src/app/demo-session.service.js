import { __decorate } from "tslib";
import { Injectable, signal } from '@angular/core';
let DemoSessionService = class DemoSessionService {
    adminAccess = signal(false);
    draftDirty = signal(true);
    workspaceLoads = signal(0);
    setAdminAccess(value) {
        this.adminAccess.set(value);
    }
    setDraftDirty(value) {
        this.draftDirty.set(value);
    }
    buildWorkspaceSnapshot(projectId) {
        const loadOrder = this.workspaceLoads() + 1;
        this.workspaceLoads.set(loadOrder);
        return {
            projectId,
            loadOrder,
            canOpenAdmin: this.adminAccess(),
            suggestedFilters: Object.freeze(projectId % 2 === 0
                ? ['recent', 'assigned']
                : ['open', 'watching']),
        };
    }
    createAdminAudit() {
        return {
            accessGranted: this.adminAccess(),
            reviewedBy: 'app1',
            workspaceLoads: this.workspaceLoads(),
        };
    }
};
DemoSessionService = __decorate([
    Injectable({
        providedIn: 'root',
    })
], DemoSessionService);
export { DemoSessionService };
