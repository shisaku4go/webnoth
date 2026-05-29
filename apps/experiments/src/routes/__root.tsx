import { createRootRoute, Link, Outlet } from '@tanstack/react-router';
import type * as React from 'react';

function GithubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="GitHub"
      {...props}
    >
      <title>GitHub</title>
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="border-b border-border">
        <nav className="container mx-auto flex items-center gap-6 px-4 py-3">
          <Link to="/" className="text-lg font-bold">
            webnoth
          </Link>
          <Link
            to="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            activeProps={{ className: 'text-foreground font-medium' }}
            activeOptions={{ exact: true }}
          >
            Experiments
          </Link>
          <Link
            to="/encyclopedia"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            activeProps={{ className: 'text-foreground font-medium' }}
            activeOptions={{ exact: true }}
          >
            Unit Encyclopedia
          </Link>
          <Link
            to="/encyclopedia/maps"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            activeProps={{ className: 'text-foreground font-medium' }}
          >
            Map Encyclopedia
          </Link>
          <Link
            to="/battle-simulator"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            activeProps={{ className: 'text-foreground font-medium' }}
          >
            Battle Simulator
          </Link>
          <Link
            to="/tactical-puzzle"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            activeProps={{ className: 'text-foreground font-medium' }}
          >
            Tactical Puzzles
          </Link>
        </nav>
      </header>
      <main className="container mx-auto px-4 py-6 flex-grow">
        <Outlet />
      </main>
      <footer className="border-t border-border/40 mt-auto bg-zinc-950/60 backdrop-blur-md py-8 text-sm text-muted-foreground">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between gap-6">
            <div className="space-y-2 max-w-md">
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground">webnoth</span>
                <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full border border-border">
                  GPLv2
                </span>
              </div>
              <p className="text-xs leading-relaxed">
                An unofficial web-based simulator and tactical sandbox for{' '}
                <strong>The Battle for Wesnoth</strong>. Built to explore combat
                mechanics, terrain defenses, and AI logics.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-8 sm:gap-12">
              <div className="space-y-2">
                <span className="font-semibold text-foreground text-xs uppercase tracking-wider">
                  Resources
                </span>
                <ul className="space-y-1.5 text-xs">
                  <li>
                    <a
                      href="https://github.com/shisaku4go/webnoth"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-foreground transition-colors flex items-center gap-1.5"
                    >
                      <GithubIcon className="size-3.5" />
                      GitHub Repository
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://www.wesnoth.org/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-foreground transition-colors"
                    >
                      Official Wesnoth Website
                    </a>
                  </li>
                </ul>
              </div>

              <div className="space-y-2">
                <span className="font-semibold text-foreground text-xs uppercase tracking-wider">
                  Legal
                </span>
                <ul className="space-y-1.5 text-xs">
                  <li>
                    <Link
                      to="/license"
                      className="hover:text-foreground transition-colors"
                    >
                      License Information
                    </Link>
                  </li>
                  <li className="text-[11px] text-muted-foreground/60 leading-normal">
                    The Battle for Wesnoth is copyright © 2003-2026 The Battle
                    for Wesnoth Project.
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="border-t border-border/50 mt-6 pt-4 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs">
            <p>
              © {new Date().getFullYear()} webnoth Contributors. Released under
              the GPL-2.0 License.
            </p>
            <p className="text-muted-foreground/60">
              Not affiliated with or endorsed by The Battle for Wesnoth Project.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
