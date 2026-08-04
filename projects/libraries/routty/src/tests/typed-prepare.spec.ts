import type { Type } from '@angular/core';

import {
  frame,
  lazyFrame,
  layout,
  route,
} from '../lib/route-builders';
import type {
  InferFrameData,
  InferNavigationPreparedData,
  InferRoutePreparedData,
} from '../lib/navigation-definitions';

class ProjectPage {}

interface Project {
  readonly id: number;
  readonly name: string;
}

describe('typed frame preparation', () => {
  it('contextually types prepare callback context', () => {
    frame(ProjectPage, {
      prepare: [context => ({
        preparedUrl: context.url.href,
        aborted: context.signal.aborted,
      })],
    });
  });

  it('preserves prepare handlers at runtime', async () => {
    const project: Project = {
      id: 7,
      name: 'Routty',
    };

    const view = frame(ProjectPage, {
      prepare: [
        async () => ({ project }),
        () => ({ permissions: ['read'] as const }),
      ],
    });

    const first = await view.prepare?.[0]?.({} as never);
    const second = await view.prepare?.[1]?.({} as never);

    expect(first).toEqual({ project });
    expect(second).toEqual({ permissions: ['read'] });
  });

  it('supports the same inference for lazy frames', () => {
    const view = lazyFrame(
      async () => ProjectPage,
      {
        prepare: [
          () => ({ projectId: 42 }),
        ],
        afterEnter: [activated => {
          const projectId: number = activated.data.projectId;
          expect(projectId).toBe(42);
        }],
      },
    );

    expect(view.kind).toBe('frame');
  });
});

const project: Project = {
  id: 1,
  name: 'Typed preparation',
};

const projectFrame = frame(ProjectPage as Type<unknown>, {
  prepare: [
    async () => ({ project }),
    () => ({ permissions: ['read', 'write'] as const }),
  ],

  afterEnter: [activated => {
    const name: string = activated.data.project.name;
    const permission: 'read' | 'write' = activated.data.permissions[0];
    void name;
    void permission;

    // @ts-expect-error prepare did not provide a customer value
    activated.data.customer;
  }],

  beforeLeave: [active => {
    const id: number = active.data.project.id;
    void id;
    return true;
  }],
});

const projectRoute = route('/projects/:projectId', projectFrame, {
  name: 'project',
});

type ProjectFrameData = InferFrameData<typeof projectFrame>;
type ProjectRouteData = InferRoutePreparedData<typeof projectRoute>;

const frameData: ProjectFrameData = {
  project,
  permissions: ['read', 'write'],
};

const routeData: ProjectRouteData = frameData;
void routeData;
const applicationRoutes = [
  layout('/app', frame(ProjectPage, {
    prepare: [
      () => ({ session: { userId: 17 } }),
      () => ({ featureFlags: ['projects'] as const }),
    ],
  }), [
    route('/projects/:projectId', frame(ProjectPage, {
      prepare: [
        () => ({ project }),
      ],
    }), {
      name: 'applicationProject',
      data: {
        section: 'projects' as const,
      },
    }),
  ]),
] as const;


type ApplicationProjectData = InferNavigationPreparedData<
  typeof applicationRoutes,
  'applicationProject'
>;

const applicationProjectData: ApplicationProjectData = {
  session: { userId: 17 },
  featureFlags: ['projects'],
  project,
};

void applicationProjectData;

// @ts-expect-error unknown route names do not expose arbitrary data
const missingRouteData: InferNavigationPreparedData<typeof applicationRoutes, 'missing'> = {
  project,
};
void missingRouteData;
