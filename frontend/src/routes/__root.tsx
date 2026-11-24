import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { CampaignProvider } from "@/context/CampaignContext";
import { Toaster } from "sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg-primary)] px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-[var(--color-gold)]">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          The page you're looking for doesn't exist.
        </p>
        <div className="mt-6">
          <Link to="/" className="btn-gold">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({
  error,
  reset,
}: {
  error: unknown;
  reset: () => void;
}) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg-primary)] px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">This page didn't load</h1>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          {error instanceof Error ? error.message : String(error)}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="btn-gold"
          >
            Try again
          </button>
          <a href="/" className="btn-outline">
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Income Engine — Campaign Pipeline" },
      {
        name: "description",
        content:
          "State-driven campaign pipeline: offer → upload → merge → process → results.",
      },
      { property: "og:title", content: "Income Engine — Campaign Pipeline" },
      {
        property: "og:description",
        content: "State-driven campaign pipeline: offer → upload → merge → process → results.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Income Engine — Campaign Pipeline" },
      { name: "twitter:description", content: "State-driven campaign pipeline: offer → upload → merge → process → results." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/6fedacf5-53bb-4e1f-b8d8-2bbc094fd7ee/id-preview-6cd1f5ed--4852d34c-a79a-4eeb-a6fe-d44117a49be3.lovable.app-1784712919380.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/6fedacf5-53bb-4e1f-b8d8-2bbc094fd7ee/id-preview-6cd1f5ed--4852d34c-a79a-4eeb-a6fe-d44117a49be3.lovable.app-1784712919380.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Space+Grotesk:wght@500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <CampaignProvider>
        <Outlet />
        <Toaster theme="dark" richColors position="top-right" />
      </CampaignProvider>
    </QueryClientProvider>
  );
}
