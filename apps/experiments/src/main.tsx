import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { routeTree } from './routeTree.gen';
import './index.css';

// TanStack Router のインスタンス作成
const router = createRouter({ routeTree });

// TanStack Router の型安全性を登録
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

// TanStack Query のクライアント作成
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5分
    },
  },
});

const rootElement = document.getElementById('root');
if (rootElement && !rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  );
}
