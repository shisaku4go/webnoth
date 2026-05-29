import { createFileRoute, Link } from '@tanstack/react-router';
import { Button } from '@webnoth/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@webnoth/ui/components/card';
import { ArrowLeft, BookOpen, Scale, ShieldAlert } from 'lucide-react';
import type * as React from 'react';

export const Route = createFileRoute('/license')({
  component: LicensePage,
});

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

function LicensePage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto py-6 animate-in fade-in duration-300">
      {/* Back Link */}
      <Link
        to="/"
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
      >
        <ArrowLeft className="size-3" />
        Back to Dashboard
      </Link>

      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-red-500 via-amber-500 to-yellow-500 bg-clip-text text-transparent flex items-center gap-3">
          <Scale className="size-10 text-amber-500 shrink-0" />
          License & Legal Information
        </h1>
        <p className="text-base text-muted-foreground">
          webnoth is an open-source project built as an unofficial derivative
          client for Battle for Wesnoth.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Derivative Work Notice */}
        <Card className="border-border bg-card/40 backdrop-blur-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
              <ShieldAlert className="size-5 text-amber-500" />
              Derivative Work Notice
            </CardTitle>
            <CardDescription className="text-xs">
              Relationship with The Battle for Wesnoth Project
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground leading-relaxed space-y-3">
            <p>
              This software is an unofficial fan-made project based on{' '}
              <a
                href="https://www.wesnoth.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground font-semibold hover:underline"
              >
                The Battle for Wesnoth
              </a>
              . All game properties, units, maps, sprites, sound effects, and
              gameplay formulas are derived from The Battle for Wesnoth.
            </p>
            <p>
              webnoth is not affiliated with, endorsed by, or associated with
              The Battle for Wesnoth Project. All original game designs,
              characters, rules, assets, and assets copyright belong to their
              respective creators and contributors.
            </p>
          </CardContent>
        </Card>

        {/* License Notice */}
        <Card className="border-border bg-card/40 backdrop-blur-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
              <BookOpen className="size-5 text-blue-500" />
              GNU General Public License Version 2
            </CardTitle>
            <CardDescription className="text-xs">
              License terms governing the distribution and modification of this
              software
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground leading-relaxed space-y-4">
            <p>
              webnoth is free software: you can redistribute it and/or modify it
              under the terms of the GNU General Public License as published by
              the Free Software Foundation, either version 2 of the License, or
              (at your option) any later version.
            </p>
            <p>
              This program is distributed in the hope that it will be useful,
              but WITHOUT ANY WARRANTY; without even the implied warranty of
              MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
              General Public License for more details.
            </p>

            <div className="mt-4 p-4 bg-zinc-950/65 rounded-lg border border-border/60">
              <h4 className="font-mono text-xs font-bold text-foreground mb-2">
                GNU GENERAL PUBLIC LICENSE
              </h4>
              <p className="font-mono text-[11px] leading-relaxed text-zinc-400">
                Version 2, June 1991
                <br />
                <br />
                Copyright (C) 1989, 1991 Free Software Foundation, Inc.
                <br />
                51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA
                <br />
                <br />
                Everyone is permitted to copy and distribute verbatim copies of
                this license document, but changing it is not allowed.
              </p>
              <div className="mt-4 pt-4 border-t border-border/40 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <span className="text-xs text-muted-foreground">
                  Read the complete GPL v2 license terms online:
                </span>
                <a
                  href="https://www.gnu.org/licenses/old-licenses/gpl-2.0.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/85 text-xs font-bold transition-colors border border-border"
                >
                  View Full License Text
                </a>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Source Code and Contributions */}
        <Card className="border-border bg-card/40 backdrop-blur-md">
          <CardContent className="py-6 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="space-y-1 text-center sm:text-left">
              <h3 className="font-bold text-foreground">
                Source Code & Contributions
              </h3>
              <p className="text-xs text-muted-foreground">
                In compliance with the GPL license, the source code of this
                project is fully open source.
              </p>
            </div>
            <a
              href="https://github.com/shisaku4go/webnoth"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-foreground text-sm font-bold transition-colors border border-zinc-700 shadow-md cursor-pointer shrink-0"
            >
              <GithubIcon className="size-4" />
              GitHub Repository
            </a>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Back Button */}
      <div className="pt-4 flex justify-center">
        <Link to="/">
          <Button
            variant="outline"
            className="font-bold cursor-pointer flex items-center gap-2"
          >
            <ArrowLeft className="size-4" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
