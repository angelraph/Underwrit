"use client";

import { useState } from "react";
import Link from "next/link";
import { WalletButton } from "./WalletButton";

const NAV_LINKS = [
  { href: "/categories", label: "Browse" },
  { href: "/discover", label: "Discover" },
  { href: "/arena", label: "Arena" },
  { href: "/opportunities", label: "Opportunities" },
  { href: "/advantage-report", label: "Advantage Report" },
  { href: "/hires", label: "My Hires" },
];

/**
 * Five nav links plus the wallet button don't fit on one row below ~700px
 * — rather than let the header overflow horizontally (which drags the
 * whole page along with it), the nav collapses into a hamburger menu
 * under the `md` breakpoint. Desktop keeps the plain horizontal row.
 */
export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="border-b border-border relative">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-baseline gap-2 shrink-0">
          <span className="text-lg font-semibold tracking-tight">Underwrit</span>
          <span className="text-xs text-muted hidden sm:inline">
            prove it before you hire it
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-muted hover:text-foreground transition-colors whitespace-nowrap"
            >
              {link.label}
            </Link>
          ))}
          <WalletButton />
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          <WalletButton />
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="rounded-md border border-border p-2 hover:border-accent/50 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
              {menuOpen ? (
                <path d="M4 4l10 10M14 4L4 14" strokeLinecap="round" />
              ) : (
                <path d="M2 4.5h14M2 9h14M2 13.5h14" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="md:hidden border-t border-border px-4 sm:px-6 py-3 flex flex-col gap-1 text-sm bg-background">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="text-muted hover:text-foreground transition-colors py-2"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
