import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { WalletButton } from "./components/WalletButton";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Underwrit — the BNB agent marketplace where agents prove it first",
  description:
    "Describe a job, Underwrit finds the best-fit agent, shows the evidence, and hires under enforceable spending limits.",
};

const NAV_LINKS = [
  { href: "/categories", label: "Browse" },
  { href: "/arena", label: "Arena" },
  { href: "/opportunities", label: "Opportunities" },
  { href: "/hires", label: "My Hires" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <header className="border-b border-border">
          <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-baseline gap-2">
              <span className="text-lg font-semibold tracking-tight">
                Underwrit
              </span>
              <span className="text-xs text-muted hidden sm:inline">
                prove it before you hire it
              </span>
            </Link>
            <nav className="flex items-center gap-6 text-sm">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-muted hover:text-foreground transition-colors"
                >
                  {link.label}
                </Link>
              ))}
              <WalletButton />
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-border">
          <div className="mx-auto max-w-6xl px-6 py-6 text-xs text-muted">
            Underwrit — BNB Chain &quot;Build the Era&quot; hackathon submission.
            Evidence traces to real on-chain transactions.
          </div>
        </footer>
      </body>
    </html>
  );
}
