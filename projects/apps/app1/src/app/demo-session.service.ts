import { Injectable, signal } from '@angular/core';

export interface WorkspaceSnapshot {
  readonly projectId: number;
  readonly loadOrder: number;
  readonly canOpenAdmin: boolean;
  readonly suggestedFilters: readonly string[];
}

export interface AdminAudit {
  readonly accessGranted: boolean;
  readonly reviewedBy: string;
  readonly workspaceLoads: number;
}

@Injectable({
  providedIn: 'root',
})
export class DemoSessionService {
  readonly adminAccess = signal(false);
  readonly draftDirty = signal(true);
  readonly workspaceLoads = signal(0);

  setAdminAccess(value: boolean): void {
    this.adminAccess.set(value);
  }

  setDraftDirty(value: boolean): void {
    this.draftDirty.set(value);
  }

  buildWorkspaceSnapshot(projectId: number): WorkspaceSnapshot {
    const loadOrder = this.workspaceLoads() + 1;
    this.workspaceLoads.set(loadOrder);

    return {
      projectId,
      loadOrder,
      canOpenAdmin: this.adminAccess(),
      suggestedFilters: Object.freeze(
        projectId % 2 === 0
          ? ['recent', 'assigned']
          : ['open', 'watching'],
      ),
    };
  }

  createAdminAudit(): AdminAudit {
    return {
      accessGranted: this.adminAccess(),
      reviewedBy: 'route-playground',
      workspaceLoads: this.workspaceLoads(),
    };
  }
}
