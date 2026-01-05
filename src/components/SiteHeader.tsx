"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Menu, Rocket, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { SearchTrigger } from "./SearchTrigger";

const navLinks = [
  { href: "/about", label: "About" },
  { href: "/writing", label: "Writing" },
  { href: "/tweets", label: "Tweets" },
  { href: "/discover", label: "Discover" },
  { href: "/topics", label: "Topics" },
  { href: "/q", label: "Q&A" },
  { href: "/videos", label: "Videos" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close mobile menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMobileMenuOpen(false);
      }
    }

    if (mobileMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      // Prevent body scroll when menu is open
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  // Close menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-black/30 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
        <Link
          href="/"
          className="group flex items-center gap-2 rounded-xl px-2 py-1 transition-colors hover:bg-white/5"
          onClick={() => setMobileMenuOpen(false)}
        >
          <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-b from-white/10 to-white/5 ring-1 ring-white/10">
            <Rocket className="h-5 w-5 text-white/90" />
            <span className="pointer-events-none absolute -inset-2 rounded-2xl bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.35),transparent_55%)] opacity-0 blur-sm transition-opacity group-hover:opacity-100" />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight text-white">
              ElonGoat
            </div>
            <div className="text-xs text-white/60">Digital Elon (AI)</div>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-2 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-xl px-3 py-2 text-sm transition-colors hover:bg-white/5 hover:text-white ${
                pathname === link.href || pathname?.startsWith(link.href + "/")
                  ? "text-white"
                  : "text-white/70"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <a
            href="https://x.com/elonmusk"
            target="_blank"
            rel="noreferrer"
            className="rounded-xl px-3 py-2 text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-white"
          >
            Real Elon on X
          </a>
        </nav>

        <div className="flex items-center gap-2">
          {/* Mobile Menu Button */}
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 p-2 text-white/80 transition hover:border-white/20 hover:bg-white/10 md:hidden"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>

          <SearchTrigger />
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {mobileMenuOpen && (
        <div
          ref={menuRef}
          className="md:hidden"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 50,
          }}
        >
          <div className="border-b border-white/10 bg-black/95 backdrop-blur-xl">
            <nav className="mx-auto w-full max-w-6xl px-4 py-4 md:px-6">
              <div className="flex flex-col gap-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`rounded-xl px-4 py-3 text-sm transition-colors hover:bg-white/5 ${
                      pathname === link.href ||
                      pathname?.startsWith(link.href + "/")
                        ? "bg-white/10 text-white"
                        : "text-white/70"
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
                <a
                  href="https://x.com/elonmusk"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl px-4 py-3 text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-white"
                >
                  Real Elon on X
                </a>
              </div>
              <div className="mt-4 border-t border-white/10 pt-4">
                <div className="flex items-center gap-2">
                  <SearchTrigger />
                  <Link
                    href="/topics"
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 transition hover:border-white/20 hover:bg-white/10"
                  >
                    <Search className="h-4 w-4" />
                    Explore Topics
                  </Link>
                </div>
              </div>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
