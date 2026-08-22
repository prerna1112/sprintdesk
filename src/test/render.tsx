import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import { StrictMode, type ReactElement, type PropsWithChildren } from 'react';
import { MemoryRouter } from 'react-router-dom';

interface TestRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  route?: string;
}

export function renderWithProviders(
  ui: ReactElement,
  { route = '/', ...options }: TestRenderOptions = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  function Wrapper({ children }: PropsWithChildren) {
    return (
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter
            initialEntries={[route]}
            future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
          >
            {children}
          </MemoryRouter>
        </QueryClientProvider>
      </StrictMode>
    );
  }

  return render(ui, { wrapper: Wrapper, ...options });
}
