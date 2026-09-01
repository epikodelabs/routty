import {
  layout,
  route,
} from '../lib/route-builders';
import type {
  InferNavigationPreparedData,
  InferRoutePreparedData,
} from '../lib/navigation-definitions';

class ProjectPage {}

interface Project {
  readonly id: number;
  readonly name: string;
}

const project: Project = {
  id: 1,
  name: 'Typed preparation',
};

describe('typed route preparation', () => {
  it('contextually types direct prepare callbacks', () => {
    route('/projects/:projectId', ProjectPage, {
      prepare: context => ({
        preparedUrl: context.url.href,
        aborted: context.signal.aborted,
      }),
    });
  });

  it('normalizes one prepare callback to an array', async () => {
    const definition = route('/projects/:projectId', ProjectPage, {
      prepare: () => ({ project }),
    });

    expect(definition.prepare?.length).toBe(1);
    expect(await definition.prepare?.[0]?.({} as never)).toEqual({ project });
  });

  it('normalizes multiple lifecycle callbacks', () => {
    const definition = route('/projects/:projectId', ProjectPage, {
      prepare: [
        async () => ({ project }),
        () => ({ permissions: ['read', 'write'] as const }),
      ],
      afterEnter: activated => {
        const name: string = activated.data.project.name;
        const permission: 'read' | 'write' = activated.data.permissions[0];
        void name;
        void permission;

        // @ts-expect-error prepare did not provide customer data
        activated.data.customer;
      },
      beforeLeave: active => {
        const id: number = active.data.project.id;
        void id;
        return true;
      },
    });

    expect(definition.prepare?.length).toBe(2);
    expect(definition.afterEnter?.length).toBe(1);
    expect(definition.beforeLeave?.length).toBe(1);
  });
});

const projectRoute = route('/projects/:projectId', ProjectPage, {
  name: 'project',
  prepare: [
    async () => ({ project }),
    () => ({ permissions: ['read', 'write'] as const }),
  ],
});

type ProjectRouteData = InferRoutePreparedData<typeof projectRoute>;

const routeData: ProjectRouteData = {
  project,
  permissions: ['read', 'write'],
};
void routeData;

const applicationRoutes = [
  layout('/app', ProjectPage, [
    route('/projects/:projectId', ProjectPage, {
      name: 'applicationProject',
      data: {
        section: 'projects' as const,
      },
      prepare: () => ({ project }),
    }),
  ], {
    prepare: [
      () => ({ session: { userId: 17 } }),
      () => ({ featureFlags: ['projects'] as const }),
    ],
  }),
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
