import { createRouter, type Route, type Router as VanillaRouter, type RouterConfig as VanillaRouterConfig } from '../lib/vanilla-router';
import { idescribe } from './env.spec';

function unwrapTestComponent<T>(value: T | { default: T }): T {
  return value != null && typeof value === 'object' && 'default' in value
    ? value.default
    : value as T;
}
// Helper function for async testing
function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForCondition(
    predicate: () => boolean,
    timeoutMs = 500,
    stepMs = 10,
): Promise<void> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        if (predicate()) {
            return;
        }

        await delay(stepMs);
    }

    throw new Error('Timed out waiting for condition.');
}
// Helper function to create test components
function createComponent(text: string): () => Node {
    return () => document.createTextNode(text);
}
function runViewTransitionCallback(callback: () => void | PromiseLike<void>): { finished: Promise<void> } {
    return {
        finished: Promise.resolve()
            .then(() => callback())
            .then(() => undefined),
    };
}
function dispatchAnchorClick(target: HTMLAnchorElement, init: MouseEventInit = {}): boolean {
    const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        button: 0,
        ...init
    });
    let defaultPrevented = false;
    const cleanupListener = (currentEvent: MouseEvent) => {
        defaultPrevented = currentEvent.defaultPrevented;
        currentEvent.preventDefault();
    };
    document.addEventListener('click', cleanupListener);
    try {
        target.dispatchEvent(event);
    }
    finally {
        document.removeEventListener('click', cleanupListener);
    }
    return defaultPrevented;
}
// Helper to create a route object with component (since Route doesn't have 'component' property)
function routeWithComponent(path: string, text: string): Route {
    return {
        path,
        load: async () => ({
            component: unwrapTestComponent(await (() => Promise.resolve(createComponent(text)))())
        })
    };
}
idescribe('Router', () => {
    let outlet: HTMLElement;
    let router: VanillaRouter;
    beforeEach(() => {
        // Create a DOM outlet for testing
        outlet = document.createElement('div');
        outlet.id = 'test-outlet';
        document.body.appendChild(outlet);
        // Reset URL
        window.history.replaceState(null, '', '/');
        // Spy on console methods
        spyOn(console, 'debug');
        spyOn(console, 'error');
    });
    afterEach(() => {
        if (router) {
            router.dispose();
        }
        if (outlet.parentNode) {
            document.body.removeChild(outlet);
        }
    });
    describe('creation', () => {
        it('should create a router instance', () => {
            const config: VanillaRouterConfig = {
                routes: [routeWithComponent('', 'Home')],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            expect(router).toBeDefined();
            expect(router.state).toBeDefined();
            expect(router.state.current).toBeNull();
            expect(router.state.pending).toBeFalse();
            expect(router.state.phase).toBeNull();
            expect(router.state.path).toBe('');
            expect(router.state.params).toEqual({});
            expect(router.state.query).toEqual({});
            expect(router.state.data).toEqual({});
            expect(router.state.routeConfig).toBeNull();
        });
        it('should use default outlet when not provided', () => {
            const app = document.createElement('div');
            app.id = 'app';
            document.body.appendChild(app);
            const defaultRouter = createRouter({
                routes: [routeWithComponent('', 'Home')]
            });
            expect(defaultRouter).toBeDefined();
            defaultRouter.dispose();
            document.body.removeChild(app);
        });
        it('should normalize baseHref', () => {
            const config: VanillaRouterConfig = {
                routes: [routeWithComponent('', 'Home')],
                baseHref: '/app/',
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            expect(router.href('/about')).toBe('/app/about');
        });
    });
    describe('navigation', () => {
        it('should navigate to a route', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                    routeWithComponent('about', 'About'),
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            await router.navigate('/about');
            expect(router.state.current?.path).toBe('/about');
            expect(router.state.current?.config.path).toBe('about');
            expect(outlet.textContent).toBe('About');
            expect(router.state.routeConfig?.path).toBe('about');
        });
        it('should resolve navigation after the route has rendered', async () => {
            router = createRouter({
                routes: [routeWithComponent('about', 'About')],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            });
            const completed = await router.navigate('/about');
            expect(completed).toBeTrue();
            expect(router.state.current?.path).toBe('/about');
            expect(outlet.textContent).toBe('About');
        });
        it('should notify outlet activation through the config hook', async () => {
            const onOutletActivate = jasmine.createSpy('onOutletActivate');
            router = createRouter({
                routes: [{
                        path: 'about',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(() => ({
                                node: document.createTextNode('About'),
                                component: { kind: 'about-component' }
                            })))())
                        })
                    }], render: (name, node) => {
                    outlet.replaceChildren(node);
                },
                onOutletActivate
            });
            await router.navigate('/about');
            expect(onOutletActivate).toHaveBeenCalledTimes(1);
            expect(onOutletActivate).toHaveBeenCalledWith(outlet, jasmine.objectContaining({ kind: 'about-component' }));
        });
        it('should navigate to the home route', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            await router.navigate('/');
            expect(router.state.current?.path).toBe('/');
            expect(outlet.textContent).toBe('Home');
        });
        it('should navigate with replace option', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                    routeWithComponent('about', 'About'),
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            const replaceSpy = spyOn(window.history, 'replaceState').and.callThrough();
            await router.navigate('/about', { replace: true });
            expect(replaceSpy).toHaveBeenCalled();
            expect(router.state.current?.path).toBe('/about');
        });
        it('should navigate with state', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                    routeWithComponent('about', 'About'),
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            const pushStateSpy = spyOn(window.history, 'pushState').and.callThrough();
            await router.navigate('/about', { state: { from: 'test' } });
            expect(pushStateSpy).toHaveBeenCalledWith(
                { from: 'test' },
                '',
                '/about'
            );
            expect(router.state.historyState).toEqual({ from: 'test' });
            expect(router.state.current?.historyState).toEqual({ from: 'test' });
        });
        it('should update the current history state without navigating', async () => {
            router = createRouter({
                routes: [
                    routeWithComponent('', 'Home'),
                    routeWithComponent('about', 'About'),
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            });
            router.start();
            await router.navigate('/about', { state: { from: 'test' } });
            const replaceStateSpy = spyOn(window.history, 'replaceState').and.callThrough();
            router.updateHistoryState({ from: 'updated', step: 2 });
            expect(replaceStateSpy).toHaveBeenCalledWith(
                { from: 'updated', step: 2 },
                '',
                '/about'
            );
            expect(router.state.historyState).toEqual({ from: 'updated', step: 2 });
            expect(router.state.current?.historyState).toEqual({ from: 'updated', step: 2 });
        });
        it('should handle navigation to external URLs', async () => {
            const navigateExternal = jasmine.createSpy('navigateExternal');
            const config: VanillaRouterConfig = {
                routes: [routeWithComponent('', 'Home')],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
                navigateExternal
            };
            router = createRouter(config);
            router.start();
            await router.navigate('https://example.com');
            expect(navigateExternal).toHaveBeenCalledWith(new URL('https://example.com/'));
        });
        it('should handle navigation with query parameters', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            await router.navigate('/?foo=bar&baz=qux');
            expect(router.state.query).toEqual({ foo: 'bar', baz: 'qux' });
        });
        it('should handle navigation with hash', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            await router.navigate('/#section');
            expect(router.state.current?.url.hash).toBe('#section');
        });
        it('should ignore an active URL without touching history when configured', async () => {
            let guardCalls = 0;
            let prepareCalls = 0;
            let componentLoads = 0;
            const pushStateSpy = spyOn(window.history, 'pushState').and.callThrough();
            router = createRouter({
                routes: [{
                        path: 'same',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => {
                                componentLoads++;
                                return Promise.resolve(createComponent('Same'));
                            })()),
                            beforeEnter: [() => {
                                    guardCalls++;
                                    return true;
                                }],
                            prepare: [() => {
                                prepareCalls++;
                                return {
                                    value: 'prepared'
                                };
                            }]
                        })
                    }], render: (name, node) => {
                    outlet.replaceChildren(node);
                },
                onSameUrlNavigation: 'ignore'
            });
            await router.navigate('/same');
            pushStateSpy.calls.reset();
            const navigated = await router.navigate('/same');
            expect(navigated).toBeFalse();
            expect(guardCalls).toBe(1);
            expect(prepareCalls).toBe(1);
            expect(componentLoads).toBe(1);
            expect(pushStateSpy).not.toHaveBeenCalled();
        });
        it('should reload an active URL by default', async () => {
            let componentLoads = 0;
            router = createRouter({
                routes: [{
                        path: 'same',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => {
                                componentLoads++;
                                return Promise.resolve(createComponent('Same'));
                            })())
                        })
                    }], render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            });
            await router.navigate('/same');
            const navigated = await router.navigate('/same');
            expect(navigated).toBeTrue();
            expect(componentLoads).toBe(1);
        });
    });
    describe('route matching', () => {
        it('should refresh a cached route pattern when its path changes', async () => {
            const route = routeWithComponent('first', 'Route');
            router = createRouter({ routes: [route], render: (name, node) => {
                outlet.replaceChildren(node);
            }, });
            await router.navigate('/first');
            (route as { path: string }).path = 'second';
            await router.navigate('/second');
            expect(router.state.current?.path).toBe('/second');
            expect(outlet.textContent).toBe('Route');
        });
        it('should match parameterized routes', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'users/:id',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('User')))())
                        })
                    },
                ], render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            await router.navigate('/users/123');
            expect(router.state.current?.path).toBe('/users/123');
            expect(router.state.current?.params).toEqual({ id: '123' });
            expect(router.state.current?.config.path).toBe('users/:id');
            expect(router.state.params).toEqual({ id: '123' });
        });
        it('should decode URL parameters', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'users/:id',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('User')))())
                        })
                    },
                ], render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            await router.navigate('/users/hello%20world');
            expect(router.state.current?.params).toEqual({ id: 'hello world' });
        });
        it('should match wildcard routes', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                    {
                        path: '**',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('404')))())
                        })
                    },
                ], render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            await router.navigate('/non-existent');
            expect(router.state.current?.config.path).toBe('**');
            expect(outlet.textContent).toBe('404');
        });
    });
        it('should only match complete flat route paths', async () => {
            router = createRouter({
                routes: [
                    routeWithComponent('admin/users', 'Admin Users'),
                    routeWithComponent('admin/settings', 'Admin Settings'),
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            });

            await router.navigate('/admin/users');

            expect(router.state.current?.config.path).toBe('admin/users');
            expect(outlet.textContent).toBe('Admin Users');
        });
        it('should not infer parent routes from path prefixes', async () => {
            router = createRouter({
                routes: [
                    routeWithComponent('admin', 'Admin'),
                    routeWithComponent('admin/users', 'Admin Users'),
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            });

            await router.navigate('/admin/users');

            expect(router.state.current?.config.path).toBe('admin/users');
            expect(outlet.textContent).toBe('Admin Users');
        });
    describe('guards', () => {
        it('should allow navigation when guard returns true', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'protected',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('Protected')))()),
                            beforeEnter: [() => true]
                        })
                    },
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            await router.navigate('/protected');
            expect(router.state.current?.path).toBe('/protected');
            expect(outlet.textContent).toBe('Protected');
        });
        it('should block navigation when guard returns false', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'protected',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('Protected')))()),
                            beforeEnter: [() => false]
                        })
                    },
                    routeWithComponent('', 'Home'),
                ],
                outlet
            };
            router = createRouter(config);
            router.start();
            await router.navigate('/protected');
            expect(router.state.current).toBeNull();
            expect(router.state.pending).toBeFalse();
        });
        it('should resolve false when a guard blocks navigation', async () => {
            router = createRouter({
                routes: [{
                        path: 'protected',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('Protected')))()),
                            beforeEnter: [() => false]
                        })
                    }], render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            });
            const completed = await router.navigate('/protected');
            expect(completed).toBeFalse();
            expect(router.state.current).toBeNull();
        });
        it('should redirect when guard returns a redirect string', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'old',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('Old')))()),
                            beforeEnter: [() => '/new']
                        })
                    },
                    routeWithComponent('new', 'New'),
                ],
                outlet
            };
            router = createRouter(config);
            router.start();
            await router.navigate('/old');
            expect(router.state.current?.path).toBe('/new');
            expect(outlet.textContent).toBe('New');
        });
        it('should redirect when guard returns a redirect object', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'old',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('Old')))()),
                            beforeEnter: [() => ({ redirectTo: '/new', replace: true })]
                        })
                    },
                    routeWithComponent('new', 'New'),
                ],
                outlet
            };
            router = createRouter(config);
            router.start();
            await router.navigate('/old');
            expect(router.state.current?.path).toBe('/new');
            expect(outlet.textContent).toBe('New');
        });
        it('should support async guards', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'async',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('Async')))()),
                            beforeEnter: [
                                async () => {
                                    await delay(10);
                                    return true;
                                },
                            ]
                        })
                    },
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            await router.navigate('/async');
            expect(router.state.current?.path).toBe('/async');
            expect(outlet.textContent).toBe('Async');
        });
        it('should execute multiple guards in order', async () => {
            const order: string[] = [];
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'guarded',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('Guarded')))()),
                            beforeEnter: [
                                () => { order.push('first'); return true; },
                                () => { order.push('second'); return true; },
                            ]
                        })
                    },
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            await router.navigate('/guarded');
            expect(order).toEqual(['first', 'second']);
            expect(router.state.current?.path).toBe('/guarded');
        });
        it('should stop at the first failing guard', async () => {
            const order: string[] = [];
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'guarded',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('Guarded')))()),
                            beforeEnter: [
                                () => { order.push('first'); return true; },
                                () => { order.push('second'); return false; },
                                () => { order.push('third'); return true; },
                            ]
                        })
                    },
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            await router.navigate('/guarded');
            expect(order).toEqual(['first', 'second']);
            expect(router.state.current).toBeNull();
        });
        it('should work with guard objects', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'protected',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('Protected')))()),
                            beforeEnter: [() => true]
                        })
                    },
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            await router.navigate('/protected');
            expect(router.state.current?.path).toBe('/protected');
        });
        it('should block navigation when beforeLeave returns false', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'edit',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('Edit')))()),
                            beforeLeave: [() => false]
                        })
                    },
                    routeWithComponent('other', 'Other'),
                ],
                outlet
            };
            router = createRouter(config);
            router.start();
            await router.navigate('/edit');
            await router.navigate('/other');
            expect(router.state.current?.path).toBe('/edit');
            expect(outlet.textContent).toBe('Edit');
            expect(router.state.error).toBeNull();
        });
        it('should redirect when beforeLeave returns a redirect', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'edit',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('Edit')))()),
                            beforeLeave: [() => '/confirm']
                        })
                    },
                    routeWithComponent('confirm', 'Confirm'),
                    routeWithComponent('other', 'Other'),
                ],
                outlet
            };
            router = createRouter(config);
            router.start();
            await router.navigate('/edit');
            await router.navigate('/other');
            expect(router.state.current?.path).toBe('/confirm');
            expect(outlet.textContent).toBe('Confirm');
        });
        it('should warn when beforeLeave redirects to the pending URL', async () => {
            const warnSpy = spyOn(console, 'warn');
            router = createRouter({
                routes: [
                    {
                        path: 'edit',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('Edit')))()),
                            beforeLeave: [() => ({ redirectTo: '/target', replace: true })]
                        })
                    },
                    routeWithComponent('target', 'Target'),
                ],
                outlet
            });
            await router.navigate('/edit');
            await router.navigate('/target');
            expect(warnSpy).toHaveBeenCalledWith('[Router] Ignoring beforeLeave redirect to the pending URL', '/target');
            expect(router.state.current?.path).toBe('/target');
        });
    });
    describe('prepare data', () => {
        it('should prepare data before navigation', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'user',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('User')))()),
                            prepare: [
                                () => ({ userId: 123 }),
                                () => ({ userName: 'Alice' })
                            ]
                        })
                    },
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            await router.navigate('/user');
            expect(router.state.current?.data).toEqual({
                userId: 123,
                userName: 'Alice'
            });
        });
        it('should support async prepare handlers', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'async-data',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('Async Data')))()),
                            prepare: [async () => {
                                    await delay(10);
                                    return { data: { id: 1, name: 'Async' } };
                                }]
                        })
                    },
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            await router.navigate('/async-data');
            expect(router.state.current?.data).toEqual({
                data: { id: 1, name: 'Async' }
            });
        });
        it('should merge static data and prepared data', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'merged',
                        data: { static: 'static-value' },
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('Merged')))()),
                            prepare: [() => ({ dynamic: 'dynamic-value' })]
                        })
                    },
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            await router.navigate('/merged');
            expect(router.state.current?.data).toEqual({
                static: 'static-value',
                dynamic: 'dynamic-value'
            });
        });
        it('should merge multiple prepare handlers', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'user',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('User')))()),
                            prepare: [
                                () => ({ userId: 100 }),
                                () => ({ userId: 123 })
                            ]
                        })
                    },
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            await router.navigate('/user');
            expect(router.state.current?.data).toEqual({
                userId: 123
            });
        });
    });
    describe('redirects', () => {
        it('should handle static redirects', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        kind: 'redirect',
                        path: 'old',
                        redirectTo: '/new'
                    },
                    routeWithComponent('new', 'New Page'),
                ],
                outlet
            };
            router = createRouter(config);
            router.start();
            await router.navigate('/old');
            expect(router.state.current?.path).toBe('/new');
            expect(outlet.textContent).toBe('New Page');
        });
        it('should handle parameterized redirects', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        kind: 'redirect',
                        path: 'users/:id',
                        redirectTo: '/profiles/:id'
                    },
                    {
                        path: 'profiles/:id',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('Profile')))())
                        })
                    },
                ], render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            await router.navigate('/users/123');
            expect(router.state.current?.path).toBe('/profiles/123');
            expect(router.state.current?.params).toEqual({ id: '123' });
        });
        it('should enforce max redirect count', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        kind: 'redirect',
                        path: 'a',
                        redirectTo: '/b'
                    },
                    {
                        kind: 'redirect',
                        path: 'b',
                        redirectTo: '/a'
                    },
                ], render: (name, node) => {
                    outlet.replaceChildren(node);
                },
                maxRedirects: 3
            };
            router = createRouter(config);
            router.start();
            await expectAsync(router.navigate('/a'))
                .toBeRejectedWithError(/Maximum redirect count of 3 exceeded/);
            expect(router.state.phase).toBeNull();
            expect(router.state.error).toBeDefined();
            expect((router.state.error as Error).message).toContain('Maximum redirect count');
        });
        it('should handle cross-origin redirects', async () => {
            const navigateExternal = jasmine.createSpy('navigateExternal');
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        kind: 'redirect',
                        path: 'external',
                        redirectTo: 'https://example.com'
                    },
                ], render: (name, node) => {
                    outlet.replaceChildren(node);
                },
                navigateExternal
            };
            router = createRouter(config);
            router.start();
            await router.navigate('/external');
            expect(navigateExternal).toHaveBeenCalledWith(new URL('https://example.com/'));
        });
    });
    describe('lazy loading', () => {
        it('should lazy load components', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'lazy',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('Lazy Loaded')))())
                        })
                    },
                ], render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            await router.navigate('/lazy');
            expect(router.state.current?.path).toBe('/lazy');
            expect(outlet.textContent).toBe('Lazy Loaded');
        });
        it('should lazy load components with default export', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'lazy-default',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve({
                                default: createComponent('Lazy Default')
                            }))())
                        })
                    },
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            await router.navigate('/lazy-default');
            expect(outlet.textContent).toBe('Lazy Default');
        });
        it('should handle lazy loading errors', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'error',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.reject(new Error('Load failed')))())
                        })
                    },
                ], render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            await expectAsync(router.navigate('/error'))
                .toBeRejectedWithError('Load failed');
            expect(router.state.phase).toBeNull();
            expect(router.state.error).toBeDefined();
            expect((router.state.error as Error).message).toBe('Load failed');
        });
    });
    describe('history management', () => {
        it('should handle back navigation', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                    routeWithComponent('about', 'About'),
                    {
                        path: 'users/:id',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('User')))())
                        })
                    },
                ], render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            await router.navigate('/about');
            await router.navigate('/users/123');
            const popstate = new Promise<void>(resolve => {
                window.addEventListener('popstate', () => resolve(), { once: true });
            });
            router.back();
            await popstate;
            await waitForCondition(() => router.state.current?.path === '/about');
            expect(router.state.current?.path).toBe('/about');
        });
        it('should handle forward navigation', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                    routeWithComponent('about', 'About'),
                    {
                        path: 'users/:id',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('User')))())
                        })
                    },
                ], render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            await router.navigate('/about');
            await router.navigate('/users/123');
            const backPopstate = new Promise<void>(resolve => {
                window.addEventListener('popstate', () => resolve(), { once: true });
            });
            router.back();
            await backPopstate;
            await waitForCondition(() => router.state.current?.path === '/about');
            const forwardPopstate = new Promise<void>(resolve => {
                window.addEventListener('popstate', () => resolve(), { once: true });
            });
            router.forward();
            await forwardPopstate;
            await waitForCondition(() => router.state.current?.path === '/users/123');
            expect(router.state.current?.path).toBe('/users/123');
        });
        it('should handle popstate events', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                    routeWithComponent('about', 'About'),
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            await router.navigate('/about');
            const popstate = new Promise<void>(resolve => {
                window.addEventListener('popstate', () => resolve(), { once: true });
            });
            window.history.back();
            await popstate;
            await waitForCondition(() => router.state.current?.path === '/');
            expect(router.state.current?.path).toBe('/');
        });
        it('should scroll to the top after programmatic navigation when configured', async () => {
            let scrollX = 24;
            let scrollY = 160;
            spyOnProperty(window, 'scrollX', 'get').and.callFake(() => scrollX);
            spyOnProperty(window, 'scrollY', 'get').and.callFake(() => scrollY);
            const scrollToSpy = spyOn(window, 'scrollTo').and.callFake((x?: number | ScrollToOptions, y?: number) => {
                if (typeof x === 'number') {
                    scrollX = x;
                    scrollY = y ?? 0;
                }
            });
            router = createRouter({
                routes: [
                    routeWithComponent('', 'Home'),
                    routeWithComponent('about', 'About'),
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
                scrollRestoration: 'top'
            });
            router.start();
            await router.navigate('/about');
            expect(scrollToSpy).toHaveBeenCalledWith(0, 0);
        });
        it('should restore the saved scroll position on popstate when configured', async () => {
            let scrollX = 30;
            let scrollY = 140;
            spyOnProperty(window, 'scrollX', 'get').and.callFake(() => scrollX);
            spyOnProperty(window, 'scrollY', 'get').and.callFake(() => scrollY);
            const scrollToSpy = spyOn(window, 'scrollTo').and.callFake((x?: number | ScrollToOptions, y?: number) => {
                if (typeof x === 'number') {
                    scrollX = x;
                    scrollY = y ?? 0;
                }
            });
            router = createRouter({
                routes: [
                    routeWithComponent('', 'Home'),
                    routeWithComponent('about', 'About'),
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
                scrollRestoration: 'restore'
            });
            router.start();
            await router.navigate('/about');
            scrollX = 320;
            scrollY = 480;
            const popstate = new Promise<void>(resolve => {
                window.addEventListener('popstate', () => resolve(), { once: true });
            });
            window.history.back();
            await popstate;
            await waitForCondition(() => router.state.current?.path === '/');
            expect(scrollToSpy).toHaveBeenCalledWith(30, 140);
            expect(router.state.current?.path).toBe('/');
        });
        it('should restore active URL on blocked navigation', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                    {
                        path: 'blocked',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('Blocked')))()),
                            beforeEnter: [() => false]
                        })
                    },
                ], render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            // First navigate to home to have a current route
            await router.navigate('/', { state: { page: 'home' } });
            const replaceStateSpy = spyOn(window.history, 'replaceState').and.callThrough();
            await router.navigate('/blocked', { state: { page: 'blocked' } });
            const replaceStateCall =
                replaceStateSpy.calls.mostRecent();

            expect(
                replaceStateCall.args[0],
            ).toEqual({ page: 'home' });
            expect(replaceStateCall.args[1]).toBe('');
            expect(replaceStateCall.args[2]).toBe('/');
            expect(router.state.current?.path).toBe('/');
            expect(router.state.historyState).toEqual({ page: 'home' });
        });
        it('should run view transitions for DOM commits when enabled', async () => {
            const transitionDocument = document as Document & {
                startViewTransition?: (callback: () => void | PromiseLike<void>) => {
                    finished: Promise<void>;
                };
            };
            const original = transitionDocument.startViewTransition;
            const startViewTransition = jasmine.createSpy('startViewTransition')
                .and.callFake((callback: () => void | PromiseLike<void>) =>
                runViewTransitionCallback(callback));
            transitionDocument.startViewTransition = startViewTransition;
            try {
                router = createRouter({
                    routes: [
                        routeWithComponent('', 'Home'),
                        routeWithComponent('about', 'About'),
                    ],
                    viewTransitions: true
                });
                await router.navigate('/about');
                expect(startViewTransition).toHaveBeenCalled();
            }
            finally {
                transitionDocument.startViewTransition = original;
            }
        });
        it('should allow a route to opt into view transitions', async () => {
            const transitionDocument = document as Document & {
                startViewTransition?: (callback: () => void | PromiseLike<void>) => {
                    finished: Promise<void>;
                };
            };
            const original = transitionDocument.startViewTransition;
            const startViewTransition = jasmine.createSpy('startViewTransition')
                .and.callFake((callback: () => void | PromiseLike<void>) =>
                runViewTransitionCallback(callback));
            transitionDocument.startViewTransition = startViewTransition;
            try {
                router = createRouter({
                    routes: [
                        routeWithComponent('', 'Home'),
                        {
                            path: 'about',
                            viewTransition: true,
                            load: async () => ({
                                component: unwrapTestComponent(await (() => Promise.resolve(createComponent('About')))())
                            })
                        },
                    ], render: (name, node) => {
                        outlet.replaceChildren(node);
                    },
                });
                await router.navigate('/about');
                expect(startViewTransition).toHaveBeenCalled();
            }
            finally {
                transitionDocument.startViewTransition = original;
            }
        });
        it('should allow a route to opt out of global view transitions', async () => {
            const transitionDocument = document as Document & {
                startViewTransition?: (callback: () => void | PromiseLike<void>) => {
                    finished: Promise<void>;
                };
            };
            const original = transitionDocument.startViewTransition;
            const startViewTransition = jasmine.createSpy('startViewTransition')
                .and.callFake((callback: () => void | PromiseLike<void>) =>
                runViewTransitionCallback(callback));
            transitionDocument.startViewTransition = startViewTransition;
            try {
                router = createRouter({
                    routes: [
                        routeWithComponent('', 'Home'),
                        {
                            path: 'about',
                            viewTransition: false,
                            load: async () => ({
                                component: unwrapTestComponent(await (() => Promise.resolve(createComponent('About')))())
                            })
                        },
                    ], render: (name, node) => {
                        outlet.replaceChildren(node);
                    },
                    viewTransitions: true
                });
                await router.navigate('/about');
                expect(startViewTransition).not.toHaveBeenCalled();
            }
            finally {
                transitionDocument.startViewTransition = original;
            }
        });
        it('should evaluate the view transition predicate against navigation context', async () => {
            const transitionDocument = document as Document & {
                startViewTransition?: (callback: () => void | PromiseLike<void>) => {
                    finished: Promise<void>;
                };
            };
            const original = transitionDocument.startViewTransition;
            const startViewTransition = jasmine.createSpy('startViewTransition')
                .and.callFake((callback: () => void | PromiseLike<void>) =>
                runViewTransitionCallback(callback));
            const predicate = jasmine.createSpy('predicate')
                .and.callFake((context: {
                from: {
                    path: string;
                } | null;
                to: {
                    path: string;
                } | null;
                phase: string;
                url: URL;
            }) => context.to?.path === '/about' && context.phase === 'success');
            transitionDocument.startViewTransition = startViewTransition;
            try {
                router = createRouter({
                    routes: [
                        routeWithComponent('', 'Home'),
                        routeWithComponent('about', 'About'),
                        routeWithComponent('settings', 'Settings'),
                    ],
                    viewTransitions: predicate
                });
                await router.navigate('/about');
                await router.navigate('/settings');
                const [firstCall] = predicate.calls.allArgs();
                const [firstContext] = firstCall as [
                    {
                        from: {
                            path: string;
                        } | null;
                        to: {
                            path: string;
                        } | null;
                        phase: string;
                        url: URL;
                    }
                ];
                expect(firstContext.from).toBeNull();
                expect(firstContext.to?.path).toBe('/about');
                expect(firstContext.phase).toBe('success');
                expect(firstContext.url.pathname).toBe('/about');
                expect(startViewTransition).toHaveBeenCalledTimes(1);
            }
            finally {
                transitionDocument.startViewTransition = original;
            }
        });
        it('should clear stale error state on blocked navigation', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                    {
                        path: 'broken'
                    },
                    {
                        path: 'blocked',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('Blocked')))()),
                            beforeEnter: [() => false]
                        })
                    },
                ],
                outlet
            };
            router = createRouter(config);
            router.start();
            await expectAsync(router.navigate('/broken'))
                .toBeRejectedWithError(/no component/);
            expect(router.state.error).toBeDefined();
            await router.navigate('/');
            await router.navigate('/blocked');
            expect(router.state.error).toBeNull();
            expect(router.state.current?.path).toBe('/');
        });
    });
    describe('click interception', () => {
        it('should intercept anchor clicks', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                    routeWithComponent('about', 'About'),
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            const link = document.createElement('a');
            link.href = '/about';
            link.textContent = 'About';
            document.body.appendChild(link);
            const defaultPrevented = dispatchAnchorClick(link);
            await delay(50);
            expect(defaultPrevented).toBeTrue();
            expect(router.state.current?.path).toBe('/about');
            document.body.removeChild(link);
        });
        it('should not intercept external links', () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            const link = document.createElement('a');
            link.href = 'https://example.com';
            link.textContent = 'External';
            document.body.appendChild(link);
            const defaultPrevented = dispatchAnchorClick(link);
            // Router should not intercept external links
            expect(defaultPrevented).toBeFalse();
            document.body.removeChild(link);
        });
        it('should not intercept links with modifier keys', () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                    routeWithComponent('about', 'About'),
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            const link = document.createElement('a');
            link.href = '/about';
            link.textContent = 'About';
            document.body.appendChild(link);
            const defaultPrevented = dispatchAnchorClick(link, { metaKey: true });
            expect(defaultPrevented).toBeFalse();
            document.body.removeChild(link);
        });
        it('should not intercept links with download attribute', () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            const link = document.createElement('a');
            link.href = '/about';
            link.download = 'file';
            document.body.appendChild(link);
            const defaultPrevented = dispatchAnchorClick(link);
            expect(defaultPrevented).toBeFalse();
            document.body.removeChild(link);
        });
        it('should not intercept links with external rel', () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            const link = document.createElement('a');
            link.href = '/about';
            link.rel = 'external';
            document.body.appendChild(link);
            const defaultPrevented = dispatchAnchorClick(link);
            expect(defaultPrevented).toBeFalse();
            document.body.removeChild(link);
        });
        it('should handle hash-only links', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                    routeWithComponent('about', 'About'),
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            // Navigate to about first
            await router.navigate('/about');
            // Click on a hash link from the same page
            const link = document.createElement('a');
            link.href = '#section';
            link.textContent = 'Section';
            document.body.appendChild(link);
            const defaultPrevented = dispatchAnchorClick(link);
            // The router should NOT prevent default for hash-only links
            expect(defaultPrevented).toBeFalse();
            document.body.removeChild(link);
        });
    });
    describe('state management', () => {
        it('should expose current route state', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                    routeWithComponent('about', 'About'),
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            await router.navigate('/about');
            expect(router.state.path).toBe('/about');
            expect(router.state.params).toEqual({});
            expect(router.state.query).toEqual({});
            expect(router.state.routeConfig).toBeDefined();
            expect(router.state.pending).toBeFalse();
            expect(router.state.phase).toBeNull();
        });
        it('should expose a base-stripped path when baseHref is configured', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                    routeWithComponent('about', 'About'),
                ],
                baseHref: '/app/',
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            await router.navigate('/app/about');
            expect(router.state.path).toBe('/about');
            expect(router.state.current?.path).toBe('/about');
            expect(router.state.current?.url.pathname).toBe('/app/about');
        });
        it('should track navigation phase', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'async',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('Async')))()),
                            prepare: [async () => {
                                    await delay(30);
                                    return { data: 'data' };
                                }]
                        })
                    },
                ], render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            const navigation = router.navigate('/async');
            // Check that phase changes
            expect(router.state.phase).toBeDefined();
            await navigation;
            expect(router.state.phase).toBeNull();
        });
        it('should track pending state during navigation', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'async',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('Async')))()),
                            prepare: [async () => {
                                    await delay(30);
                                    return { data: 'data' };
                                }]
                        })
                    },
                ], render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            expect(router.state.pending).toBeFalse();
            const navigation = router.navigate('/async');
            // Should be pending during navigation
            expect(router.state.pending).toBeTrue();
            await navigation;
            expect(router.state.pending).toBeFalse();
        });
        it('should expose error state on navigation failure', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'error',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.reject(new Error('Component failed')))())
                        })
                    },
                ],
                outlet
            };
            router = createRouter(config);
            router.start();
            await expectAsync(router.navigate('/error'))
                .toBeRejectedWithError('Component failed');
            expect(router.state.error).toBeDefined();
            expect((router.state.error as Error).message).toBe('Component failed');
        });
    });
    describe('lifecycle', () => {
        it('should start and stop the router', () => {
            const config: VanillaRouterConfig = {
                routes: [routeWithComponent('', 'Home')],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            expect(router.state.pending).toBeFalse();
            router.stop();
            expect(router.state.current).toBeNull();
            expect(router.state.pending).toBeFalse();
        });
        it('should prevent starting a disposed router', () => {
            const config: VanillaRouterConfig = {
                routes: [routeWithComponent('', 'Home')],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.dispose();
            expect(() => {
                router.start();
            }).toThrowError(/Cannot start a disposed router/);
        });
        it('should prevent navigation after disposal', () => {
            const config: VanillaRouterConfig = {
                routes: [routeWithComponent('', 'Home')],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            router.dispose();
            expect(() => {
                router.navigate('/about');
            }).toThrowError(/Cannot navigate with a disposed router/);
        });
        it('should clean up event listeners on dispose', () => {
            const config: VanillaRouterConfig = {
                routes: [routeWithComponent('', 'Home')],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            const removeEventListenerSpy = spyOn(window, 'removeEventListener').and.callThrough();
            const documentRemoveSpy = spyOn(document, 'removeEventListener').and.callThrough();
            router = createRouter(config);
            router.start();
            router.dispose();
            expect(removeEventListenerSpy).toHaveBeenCalledWith('popstate', jasmine.any(Function));
            expect(documentRemoveSpy).toHaveBeenCalledWith('click', jasmine.any(Function));
        });
        it('should stop navigation on dispose', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'slow',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('Slow')))()),
                            prepare: [async () => {
                                    await delay(100);
                                    return { data: 'data' };
                                }]
                        })
                    },
                ],
            };
            router = createRouter(config);
            router.start();
            const navigation = router.navigate('/slow');
            // Dispose while navigation is in progress
            router.dispose();
            await expectAsync(navigation).toBeResolved();
            // The navigation should be cancelled
            expect(router.state.phase).toBeNull();
        });
        it('should dispose the active component when navigating away', async () => {
            let disposedComponent = false;
            let abortedSignal = false;
            let attachedAtDisposal = false;
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'first',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve((_route, { destroySignal }) => {
                                destroySignal.addEventListener('abort', () => {
                                    abortedSignal = true;
                                }, { once: true });
                                const node = document.createElement('div');
                                node.textContent = 'First';
                                return {
                                    node,
                                    dispose: () => {
                                        disposedComponent = true;
                                        attachedAtDisposal = node.parentElement === outlet;
                                    }
                                };
                            }))())
                        })
                    },
                    routeWithComponent('second', 'Second'),
                ],
                outlet
            };
            router = createRouter(config);
            router.start();
            await router.navigate('/first');
            await router.navigate('/second');
            expect(disposedComponent).toBeTrue();
            expect(abortedSignal).toBeTrue();
            expect(attachedAtDisposal).toBeTrue();
            expect(router.state.current?.path).toBe('/second');
        });
    });
    describe('utility methods', () => {
        it('should generate href with baseHref', () => {
            const config: VanillaRouterConfig = {
                routes: [routeWithComponent('', 'Home')],
                baseHref: '/app/',
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            expect(router.href('/about')).toBe('/app/about');
            expect(router.href('about')).toBe('/app/about');
        });
        it('should generate href with query parameters', () => {
            const config: VanillaRouterConfig = {
                routes: [routeWithComponent('', 'Home')],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            expect(router.href('/about?foo=bar')).toBe('/about?foo=bar');
        });
        it('should resolve relative hrefs from the current location inside baseHref', () => {
            window.history.replaceState(null, '', '/app/section/');
            const config: VanillaRouterConfig = {
                routes: [routeWithComponent('', 'Home')],
                baseHref: '/app/',
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            expect(router.href('child')).toBe('/app/section/child');
        });
        it('should resolve relative hrefs from the current location at the root baseHref', () => {
            window.history.replaceState(null, '', '/dashboard/profile');
            const config: VanillaRouterConfig = {
                routes: [routeWithComponent('', 'Home')],
                baseHref: '/',
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            expect(router.href('settings')).toBe('/dashboard/settings');
        });
        it('should create links with correct href', () => {
            const config: VanillaRouterConfig = {
                routes: [routeWithComponent('', 'Home')],
                baseHref: '/app/',
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            const link = router.createLink('/about', 'About', 'nav-link');
            expect(link.tagName).toBe('A');
            expect(link.textContent).toBe('About');
            expect(link.className).toBe('nav-link');
            expect(link.href).toContain('/app/about');
        });
        it('should create links without className', () => {
            const config: VanillaRouterConfig = {
                routes: [routeWithComponent('', 'Home')],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            const link = router.createLink('/about', 'About');
            expect(link.tagName).toBe('A');
            expect(link.textContent).toBe('About');
            expect(link.className).toBe('');
        });
    });
    describe('error handling', () => {
        it('should handle route with no component', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'broken'
                    },
                ], render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            await expectAsync(router.navigate('/broken'))
                .toBeRejectedWithError(/no component/);
            expect(router.state.phase).toBeNull();
            expect(router.state.error).toBeDefined();
            expect((router.state.error as Error).message).toContain('no component');
        });
        it('should use custom renderError on initial navigation failure', async () => {
            let errorRendered = false;
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'broken'
                    },
                ], render: (name, node) => {
                    outlet.replaceChildren(node);
                }, renderError: (outletName: string, error: unknown) => {
                    errorRendered = true;
                    outlet.textContent = 'Custom Error: ' + (error as Error).message;
                }
            };
            router = createRouter(config);
            router.start();
            await expectAsync(router.navigate('/broken'))
                .toBeRejectedWithError(/no component/);
            expect(errorRendered).toBeTrue();
            expect(outlet.textContent).toContain('Custom Error');
        });
        it('should synchronize state and outlet on navigation error', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                    {
                        path: 'broken'
                    },
                ], render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            // Navigate to home first
            await router.navigate('/');
            expect(outlet.textContent).toBe('Home');
            // Try to navigate to broken route
            await expectAsync(router.navigate('/broken'))
                .toBeRejectedWithError(/no component/);
            expect(outlet.textContent).toContain('Page failed to load');
            expect(router.state.current).toBeNull();
            expect(router.state.error).toBeDefined();
        });
        it('should treat named AbortError failures as aborted navigations', async () => {
            let markStarted!: () => void;
            const started = new Promise<void>(resolve => {
                markStarted = resolve;
            });
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                    {
                        path: 'slow',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('Slow')))()),
                            prepare: [async ({ signal }) => {
                                    markStarted();
                                    await new Promise<void>((_resolve, reject) => {
                                        signal.addEventListener('abort', () => {
                                            const error = new Error('aborted');
                                            error.name = 'AbortError';
                                            reject(error);
                                        }, { once: true });
                                    });
                                    return { data: 'slow' };
                                }]
                        })
                    },
                ],
            };
            router = createRouter(config);
            router.start();
            const slowNavigation = router.navigate('/slow');
            await started;
            await router.navigate('/');
            await expectAsync(slowNavigation).toBeResolvedTo(false);
            expect(router.state.error).toBeNull();
            expect(router.state.current?.path).toBe('/');
        });
        it('should handle guard errors', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'error',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('Error')))()),
                            beforeEnter: [
                                () => {
                                    throw new Error('Guard failed');
                                },
                            ]
                        })
                    },
                ],
                outlet
            };
            router = createRouter(config);
            router.start();
            await expectAsync(router.navigate('/error'))
                .toBeRejectedWithError('Guard failed');
            expect(router.state.error).toBeDefined();
            expect((router.state.error as Error).message).toBe('Guard failed');
        });
        it('should handle prepare errors', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    {
                        path: 'error',
                        load: async () => ({
                            component: unwrapTestComponent(await (() => Promise.resolve(createComponent('Error')))()),
                            prepare: [() => {
                                throw new Error('Prepare failed');
                            }]
                        })
                    },
                ],
            };
            router = createRouter(config);
            router.start();
            await expectAsync(router.navigate('/error'))
                .toBeRejectedWithError('Prepare failed');
            expect(router.state.error).toBeDefined();
            expect((router.state.error as Error).message).toBe('Prepare failed');
        });
    });
    describe('tracing', () => {
        it('should log debug messages when tracing is enabled', async () => {
            const debugSpy = console.debug as jasmine.Spy;
            debugSpy.calls.reset();
            const config: VanillaRouterConfig = {
                routes: [routeWithComponent('', 'Home')],
                enableTracing: true, render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            const navigation = router.navigate('/about');
            router.dispose();
            await expectAsync(navigation).toBeResolved();
            expect(debugSpy).toHaveBeenCalled();
        });
        it('should not log debug messages when tracing is disabled', async () => {
            const debugSpy = console.debug as jasmine.Spy;
            debugSpy.calls.reset();
            const config: VanillaRouterConfig = {
                routes: [routeWithComponent('', 'Home')],
                enableTracing: false, render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            const navigation = router.navigate('/about');
            router.dispose();
            await expectAsync(navigation).toBeResolved();
            expect(debugSpy).not.toHaveBeenCalled();
        });
    });
    describe('replace method', () => {
        it('should navigate with replace option', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                    routeWithComponent('about', 'About'),
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            const replaceSpy = spyOn(window.history, 'replaceState').and.callThrough();
            await router.replace('/about');
            expect(replaceSpy).toHaveBeenCalled();
            expect(router.state.current?.path).toBe('/about');
        });
        it('should navigate with replace option and state', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                    routeWithComponent('about', 'About'),
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            const replaceSpy = spyOn(window.history, 'replaceState').and.callThrough();
            await router.replace('/about', { from: 'test' });
            expect(replaceSpy).toHaveBeenCalledWith(
                { from: 'test' },
                '',
                '/about'
            );
            expect(router.state.historyState).toEqual({ from: 'test' });
        });
    });
    describe('baseHref handling', () => {
        it('should strip baseHref from URL for routing', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                    routeWithComponent('about', 'About'),
                ],
                baseHref: '/app/',
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            await router.navigate('/app/about');
            expect(router.state.current?.path).toBe('/about');
            expect(router.state.current?.url.pathname).toBe('/app/about');
            expect(outlet.textContent).toBe('About');
        });
        it('should reject navigation outside baseHref', () => {
            const config: VanillaRouterConfig = {
                routes: [routeWithComponent('', 'Home')],
                baseHref: '/app/',
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            expect(() => {
                router.navigate('/outside');
            }).toThrowError(/outside router base/);
        });
        it('should handle baseHref with root path', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                    routeWithComponent('about', 'About'),
                ],
                baseHref: '/',
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            await router.navigate('/about');
            expect(router.state.current?.path).toBe('/about');
            expect(outlet.textContent).toBe('About');
        });
        it('should navigate relative URLs from the current location at the root baseHref', async () => {
            window.history.replaceState(null, '', '/dashboard/profile');
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('dashboard/profile', 'Profile'),
                    routeWithComponent('dashboard/settings', 'Settings'),
                ],
                baseHref: '/',
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            await delay(50);
            await router.navigate('settings');
            expect(router.state.current?.path).toBe('/dashboard/settings');
            expect(router.state.current?.url.pathname).toBe('/dashboard/settings');
            expect(outlet.textContent).toBe('Settings');
        });
        it('should handle absolute URLs within baseHref', () => {
            const config: VanillaRouterConfig = {
                routes: [routeWithComponent('', 'Home')],
                baseHref: '/app/',
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            // Should create href with baseHref
            expect(router.href('/app/about')).toBe('/app/about');
            expect(router.href('about')).toBe('/app/about');
        });
        it('should navigate relative URLs from the current baseHref location', async () => {
            window.history.replaceState(null, '', '/app/section/');
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('section', 'Section'),
                    routeWithComponent('section/child', 'Child'),
                ],
                baseHref: '/app/',
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            await router.navigate('child');
            expect(router.state.current?.path).toBe('/section/child');
            expect(router.state.current?.url.pathname).toBe('/app/section/child');
            expect(outlet.textContent).toBe('Child');
        });
    });
    describe('renderNotFound', () => {
        it('should call renderNotFound when route is not found', async () => {
            let notFoundCalled = false;
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                }, renderNotFound: (outletName: string, _url: URL) => {
                    notFoundCalled = true;
                    outlet.textContent = 'Custom 404';
                }
            };
            router = createRouter(config);
            router.start();
            await router.navigate('/non-existent');
            expect(notFoundCalled).toBeTrue();
            expect(outlet.textContent).toBe('Custom 404');
            expect(router.state.phase).toBeNull();
            expect(router.state.error).toBeNull();
            expect(router.state.current).toBeNull();
        });
        it('should use default renderNotFound when not provided', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            await router.navigate('/non-existent');
            expect(outlet.textContent).toBe('404 — Page Not Found');
        });
        it('should clear the current route when rendering not found', async () => {
            const config: VanillaRouterConfig = {
                routes: [
                    routeWithComponent('', 'Home'),
                ],
                render: (name, node) => {
                    outlet.replaceChildren(node);
                },
            };
            router = createRouter(config);
            router.start();
            await router.navigate('/');
            expect(router.state.current?.path).toBe('/');
            await router.navigate('/non-existent');
            expect(router.state.current).toBeNull();
            expect(router.state.path).toBe('');
        });
    });
    describe('grouped named outlets', () => {
        function groupedRoute(): Route {
            return {
                path: 'project/:id',
                load: async () => ({
                    component: () => document.createTextNode('Primary')
                }),
                outlets: [{
                    path: 'project/:id',
                    outlet: 'sidebar',
                    load: async () => ({
                        component: () => document.createTextNode('Sidebar')
                    })
                }]
            };
        }

        it('should prepare and commit the complete outlet group', async () => {
            const primary = document.createElement('div');
            const sidebar = document.createElement('div');
            const committed: string[][] = [];

            router = createRouter({
                routes: [groupedRoute()],
                commit: outlets => {
                    committed.push(outlets.map(current => current.name));
                    for (const current of outlets) {
                        (current.name === 'sidebar' ? sidebar : primary)
                            .replaceChildren(current.node);
                    }
                }
            });

            expect(await router.navigate('/project/42')).toBeTrue();
            expect(committed).toEqual([['', 'sidebar']]);
            expect(primary.textContent).toBe('Primary');
            expect(sidebar.textContent).toBe('Sidebar');
            expect(router.state.params).toEqual({ id: '42' });
        });

        it('should reject malformed groups before navigation starts', () => {
            expect(() => createRouter({
                routes: [{
                    path: 'project',
                    load: async () => ({ component: createComponent('Primary') }),
                    outlets: [{
                        path: 'other',
                        outlet: 'sidebar',
                        load: async () => ({ component: createComponent('Sidebar') })
                    }]
                }]
            })).toThrowError(/must use the primary path/);

            expect(() => createRouter({
                routes: [{
                    path: 'project',
                    load: async () => ({ component: createComponent('Primary') }),
                    outlets: [
                        {
                            path: 'project',
                            outlet: 'sidebar',
                            load: async () => ({ component: createComponent('One') })
                        },
                        {
                            path: 'project',
                            outlet: 'sidebar',
                            load: async () => ({ component: createComponent('Two') })
                        }
                    ]
                }]
            })).toThrowError(/Duplicate outlet/);
        });

        it('should reject URL parsers declared by a secondary outlet', async () => {
            router = createRouter({
                routes: [{
                    path: 'project/:id',
                    load: async () => ({ component: createComponent('Primary') }),
                    outlets: [{
                        path: 'project/:id',
                        outlet: 'sidebar',
                        load: async () => ({
                            component: createComponent('Sidebar'),
                            parseParams: params => params
                        })
                    }]
                }],
                commit: () => undefined
            });

            await expectAsync(router.navigate('/project/42'))
                .toBeRejectedWithError(/cannot define parseParams or parseQuery/);
            expect((router.state.error as Error).message)
                .toContain('cannot define parseParams or parseQuery');
        });

        it('should preserve the active route when a later group fails to prepare', async () => {
            const primary = document.createElement('div');
            router = createRouter({
                routes: [
                    routeWithComponent('stable', 'Stable'),
                    {
                        path: 'broken',
                        load: async () => ({ component: createComponent('Broken') }),
                        outlets: [{
                            path: 'broken',
                            outlet: 'sidebar',
                            load: async () => { throw new Error('Sidebar failed'); }
                        }]
                    }
                ],
                commit: outlets => {
                    primary.replaceChildren(outlets[0].node);
                }
            });

            expect(await router.navigate('/stable')).toBeTrue();
            expect(primary.textContent).toBe('Stable');
            await expectAsync(router.navigate('/broken'))
                .toBeRejectedWithError('Sidebar failed');
            expect(router.state.current?.path).toBe('/stable');
            expect(primary.textContent).toBe('Stable');
            expect((router.state.error as Error).message).toBe('Sidebar failed');
        });

        it('should dispose all staged views when the group commit throws', async () => {
            const destroyed: boolean[] = [];
            router = createRouter({
                routes: [{
                    path: 'project',
                    load: async () => ({
                        component: (_route, context) => {
                            context.destroySignal.addEventListener('abort', () => destroyed.push(true));
                            return document.createTextNode('Primary');
                        }
                    }),
                    outlets: [{
                        path: 'project',
                        outlet: 'sidebar',
                        load: async () => ({
                            component: (_route, context) => {
                                context.destroySignal.addEventListener('abort', () => destroyed.push(true));
                                return document.createTextNode('Sidebar');
                            }
                        })
                    }]
                }],
                commit: () => { throw new Error('Commit failed'); }
            });

            await expectAsync(router.navigate('/project'))
                .toBeRejectedWithError('Commit failed');
            expect(destroyed.length).toBe(2);
            expect((router.state.error as Error).message).toBe('Commit failed');
        });

        it('should run native view transitions for grouped named outlet commits', async () => {
            const transitionDocument = document as Document & {
                startViewTransition?: (callback: () => void | PromiseLike<void>) => {
                    finished: Promise<void>;
                };
            };
            const original = transitionDocument.startViewTransition;
            const startViewTransition = jasmine.createSpy('startViewTransition')
                .and.callFake((callback: () => void | PromiseLike<void>) =>
                runViewTransitionCallback(callback));
            transitionDocument.startViewTransition = startViewTransition;

            try {
                router = createRouter({
                    routes: [groupedRoute()],
                    viewTransitions: true,
                    commit: outlets => {
                        for (const current of outlets) {
                            (current.name === 'sidebar' ? document.createElement('div') : outlet)
                                .replaceChildren(current.node);
                        }
                    }
                });

                expect(await router.navigate('/project/42')).toBeTrue();
                expect(startViewTransition).toHaveBeenCalled();
            }
            finally {
                transitionDocument.startViewTransition = original;
            }
        });
    });

    describe('revalidation', () => {
        it('should rerun the current navigation without changing browser history', async () => {
            let loadCount = 0;
            let prepareCount = 0;

            router = createRouter({
            routes: [{
                path: '',
                load: async () => {
                loadCount++;

                return {
                    component: route =>
                    document.createTextNode(
                        String(route.data['message']),
                    ),

                    prepare: [
                    async () => {
                        prepareCount++;

                        return {
                        message: `Home ${prepareCount}`,
                        };
                    },
                    ],
                };
                },
            }],
            onSameUrlNavigation: 'ignore',
            render: (_name, node) => {
                outlet.replaceChildren(node);
            },
            });

            expect(await router.navigate('/')).toBeTrue();
            expect(loadCount).toBe(1);
            expect(prepareCount).toBe(1);
            expect(outlet.textContent).toBe('Home 1');

            const pushState =
            spyOn(window.history, 'pushState').and.callThrough();
            const replaceState =
            spyOn(window.history, 'replaceState').and.callThrough();

            expect(await router.revalidate()).toBeTrue();

            // Lazy route configuration remains cached.
            expect(loadCount).toBe(1);

            // Navigation-dependent data is recomputed.
            expect(prepareCount).toBe(2);
            expect(outlet.textContent).toBe('Home 2');

            expect(pushState).not.toHaveBeenCalled();
            expect(replaceState).not.toHaveBeenCalled();
        });
    });
});