/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports -- test doubles and dynamic module access */
import React from 'react';
import { render, screen } from '@testing-library/react';

// Mock next/dynamic to synchronously return the imported component so we
// can assert against its DOM output in unit tests.
jest.mock('next/dynamic', () => {
  return (loader: () => Promise<{ default: React.ComponentType<unknown> }>) => {
    const Lazy: React.FC<Record<string, unknown>> = (props) => {
      const [Comp, setComp] = React.useState<React.ComponentType<unknown> | null>(null);
      React.useEffect(() => {
        let cancelled = false;
        loader().then((mod) => {
          if (!cancelled) setComp(() => mod.default);
        });
        return () => {
          cancelled = true;
        };
      }, []);
      return Comp ? <Comp {...props} /> : null;
    };
    return Lazy;
  };
});

// Mock the actual devtools package since it isn't installed in this test env.
jest.mock(
  '@tanstack/react-query-devtools',
  () => ({
    ReactQueryDevtools: () => <div data-testid="rq-devtools">DEVTOOLS</div>,
  }),
  { virtual: true }
);

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

function setNodeEnv(value: string | undefined) {
  // NODE_ENV is read at module load, so callers must use jest.isolateModules
  // around any subsequent require() of QueryDevtools.
  if (value === undefined) {
    delete (process.env as Record<string, string | undefined>).NODE_ENV;
  } else {
    (process.env as Record<string, string | undefined>).NODE_ENV = value;
  }
}

afterEach(() => {
  setNodeEnv(ORIGINAL_NODE_ENV);
});

describe('shouldRenderDevtools - production safety gate', () => {
  it('returns true when NODE_ENV === "development"', () => {
    setNodeEnv('development');
    jest.isolateModules(() => {
      const { shouldRenderDevtools } = require('../QueryDevtools');
      expect(shouldRenderDevtools()).toBe(true);
    });
  });

  it('returns false when NODE_ENV === "production"', () => {
    setNodeEnv('production');
    jest.isolateModules(() => {
      const { shouldRenderDevtools } = require('../QueryDevtools');
      expect(shouldRenderDevtools()).toBe(false);
    });
  });

  it('returns false when NODE_ENV === "test"', () => {
    setNodeEnv('test');
    jest.isolateModules(() => {
      const { shouldRenderDevtools } = require('../QueryDevtools');
      expect(shouldRenderDevtools()).toBe(false);
    });
  });

  it('returns false when NODE_ENV is undefined', () => {
    setNodeEnv(undefined);
    jest.isolateModules(() => {
      const { shouldRenderDevtools } = require('../QueryDevtools');
      expect(shouldRenderDevtools()).toBe(false);
    });
  });

  it('returns false for any unknown NODE_ENV value', () => {
    setNodeEnv('staging');
    jest.isolateModules(() => {
      const { shouldRenderDevtools } = require('../QueryDevtools');
      expect(shouldRenderDevtools()).toBe(false);
    });
  });
});

describe('<QueryDevtools /> - rendering gate', () => {
  it('renders nothing in production', () => {
    setNodeEnv('production');
    jest.isolateModules(() => {
      const { QueryDevtools } = require('../QueryDevtools');
      const { container } = render(<QueryDevtools />);
      expect(container).toBeEmptyDOMElement();
      expect(screen.queryByTestId('rq-devtools')).not.toBeInTheDocument();
    });
  });

  it('renders nothing in test environment', () => {
    setNodeEnv('test');
    jest.isolateModules(() => {
      const { QueryDevtools } = require('../QueryDevtools');
      const { container } = render(<QueryDevtools />);
      expect(container).toBeEmptyDOMElement();
      expect(screen.queryByTestId('rq-devtools')).not.toBeInTheDocument();
    });
  });

  it('renders the devtools when NODE_ENV === "development"', async () => {
    setNodeEnv('development');
    await jest.isolateModulesAsync(async () => {
      const { QueryDevtools } = require('../QueryDevtools');
      render(<QueryDevtools />);
      // next/dynamic mock resolves on next tick — wait for it.
      expect(await screen.findByTestId('rq-devtools')).toBeInTheDocument();
    });
  });
});

describe('Protocol invariant: devtools-in-DOM ⇔ NODE_ENV === "development"', () => {
  const cases: Array<[string | undefined, boolean]> = [
    ['development', true],
    ['production', false],
    ['test', false],
    [undefined, false],
    ['staging', false],
  ];

  test.each(cases)(
    'NODE_ENV=%p ⇒ devtools rendered = %p',
    async (env, expected) => {
      setNodeEnv(env);
      await jest.isolateModulesAsync(async () => {
        const { QueryDevtools, shouldRenderDevtools } = require('../QueryDevtools');
        // Helper invariant
        expect(shouldRenderDevtools()).toBe(expected);

        // DOM invariant
        render(<QueryDevtools />);
        if (expected) {
          expect(await screen.findByTestId('rq-devtools')).toBeInTheDocument();
        } else {
          // Allow a microtask for any async loader to resolve before asserting absence.
          await Promise.resolve();
          expect(screen.queryByTestId('rq-devtools')).not.toBeInTheDocument();
        }
      });
    }
  );
});
