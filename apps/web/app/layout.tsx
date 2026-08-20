import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { Header } from "./components/Header";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground overflow-x-hidden">
        <Header />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-border">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 text-xs text-muted">
            Underwrit — BNB Chain &quot;Build the Era&quot; hackathon submission.
            Evidence traces to real on-chain transactions.
          </div>
        </footer>
      </body>
    </html>
  );
}
