import type { Metadata } from "next";

import Link from "next/link";

import { getDynamicVariables } from "@/lib/variables";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Facts",
  description:
    "Dynamic facts used across ElonGoat pages (age, net worth, children count).",
};

export default async function FactsIndexPage() {
  const vars = await getDynamicVariables();

  return (
    <div className="space-y-6">
      <div className="glass rounded-3xl p-6">
        <h1 className="text-2xl font-semibold text-white">Facts</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/60">
          These values are variables (env/db later) and are used to keep pSEO
          pages fresh without regenerating content manually.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <FactCard title="Age" value={`${vars.age}`} href="/facts/age" />
        <FactCard
          title="Children count"
          value={`${vars.children_count}`}
          href="/facts/children"
        />
        <FactCard title="Date of birth" value={vars.dob} href="/facts/dob" />
        <FactCard
          title="Net worth (estimate)"
          value={vars.net_worth}
          href="/facts/net-worth"
        />
      </div>
    </div>
  );
}

function FactCard({
  title,
  value,
  href,
}: {
  title: string;
  value: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="glass rounded-3xl p-6 transition hover:border-white/20 hover:bg-white/10"
    >
      <div className="text-xs text-white/55">{title}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
      <div className="mt-2 text-sm text-white/60">View details</div>
    </Link>
  );
}
