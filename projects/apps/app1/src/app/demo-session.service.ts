import {
  Injectable,
  signal,
} from '@angular/core';

export interface DemoUser {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly email: string;
  readonly homeProjectId: number;
  readonly favoriteDraftId: number;
  readonly preferredView: string;
  readonly focusFilters: readonly string[];
  readonly canAccessAdmin: boolean;
  readonly prefersDraftGuard: boolean;
}

export interface WorkspaceSnapshot {
  readonly projectId: number;
  readonly loadOrder: number;
  readonly canOpenAdmin: boolean;
  readonly activeUserName: string;
  readonly activeUserRole: string;
  readonly recommendedDraftId: number;
  readonly suggestedFilters: readonly string[];
}

export interface AdminAudit {
  readonly accessGranted: boolean;
  readonly reviewedBy: string;
  readonly reviewerRole: string;
  readonly workspaceLoads: number;
}

const demoUsers = Object.freeze([
  {
    id: 'nora',
    name: 'Nora Hale',
    role: 'Operations Lead',
    email: 'nora@switchboard.test',
    homeProjectId: 101,
    favoriteDraftId: 7,
    preferredView: 'overview',
    focusFilters: Object.freeze(['open', 'recent']),
    canAccessAdmin: false,
    prefersDraftGuard: true,
  },
  {
    id: 'lev',
    name: 'Lev Moroz',
    role: 'Admin Reviewer',
    email: 'lev@switchboard.test',
    homeProjectId: 204,
    favoriteDraftId: 21,
    preferredView: 'activity',
    focusFilters: Object.freeze(['assigned', 'flagged']),
    canAccessAdmin: true,
    prefersDraftGuard: false,
  },
] satisfies readonly DemoUser[]);

@Injectable({
  providedIn: 'root',
})
export class DemoSessionService {
  readonly users = demoUsers;
  readonly currentUserId = signal(demoUsers[0].id);
  readonly adminAccess = signal(
    demoUsers[0].canAccessAdmin,
  );
  readonly draftDirty = signal(
    demoUsers[0].prefersDraftGuard,
  );
  readonly workspaceLoads = signal(0);

  currentUser(): DemoUser {
    return this.users.find(
      user => user.id === this.currentUserId(),
    ) ?? this.users[0];
  }

  loginAs(userId: string): void {
    const nextUser = this.users.find(
      user => user.id === userId,
    );

    if (!nextUser) {
      return;
    }

    this.currentUserId.set(nextUser.id);
    this.adminAccess.set(nextUser.canAccessAdmin);
    this.draftDirty.set(nextUser.prefersDraftGuard);
  }

  setAdminAccess(value: boolean): void {
    this.adminAccess.set(value);
  }

  setDraftDirty(value: boolean): void {
    this.draftDirty.set(value);
  }

  buildWorkspaceSnapshot(projectId: number): WorkspaceSnapshot {
    const activeUser = this.currentUser();
    const loadOrder = this.workspaceLoads() + 1;
    this.workspaceLoads.set(loadOrder);

    return {
      projectId,
      loadOrder,
      canOpenAdmin: this.adminAccess(),
      activeUserName: activeUser.name,
      activeUserRole: activeUser.role,
      recommendedDraftId: activeUser.favoriteDraftId,
      suggestedFilters: Object.freeze(
        projectId % 2 === 0
          ? [...activeUser.focusFilters, 'assigned']
          : [...activeUser.focusFilters, 'watching'],
      ),
    };
  }

  createAdminAudit(): AdminAudit {
    const activeUser = this.currentUser();

    return {
      accessGranted: this.adminAccess(),
      reviewedBy: activeUser.email,
      reviewerRole: activeUser.role,
      workspaceLoads: this.workspaceLoads(),
    };
  }
}
