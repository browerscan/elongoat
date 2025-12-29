import type { Metadata } from "next";

import Link from "next/link";
import { notFound } from "next/navigation";

import { JsonLd } from "@/components/JsonLd";
import { OpenChatButton } from "@/components/OpenChatButton";
import { getDynamicVariables } from "@/lib/variables";
import { generateFactMetadata } from "@/lib/seo";
import {
  generateBreadcrumbSchema,
  generateWebPageSchema,
} from "@/lib/structuredData";

export const revalidate = 3600;

const FACTS = new Map<
  string,
  (vars: Awaited<ReturnType<typeof getDynamicVariables>>) => {
    title: string;
    value: string;
    description: string;
  }
>([
  [
    "age",
    (vars) => ({
      title: "Elon Musk age",
      value: `${vars.age}`,
      description: "Calculated from DOB (1971-06-28). Updates automatically.",
    }),
  ],
  [
    "children",
    (vars) => ({
      title: "Elon Musk children count",
      value: `${vars.children_count}`,
      description: "A variable that can be updated over time.",
    }),
  ],
  [
    "dob",
    (vars) => ({
      title: "Elon Musk date of birth",
      value: vars.dob,
      description: "Stored as an ISO date and used to compute age.",
    }),
  ],
  [
    "net-worth",
    (vars) => ({
      title: "Elon Musk net worth (estimate)",
      value: vars.net_worth,
      description:
        "An estimate that fluctuates with markets; treat as potentially outdated.",
    }),
  ],
]);

export async function generateMetadata({
  params,
}: {
  params: { fact: string };
}): Promise<Metadata> {
  const vars = await getDynamicVariables();
  const def = FACTS.get(params.fact);
  if (!def)
    return {
      title: "Fact not found",
      robots: { index: false },
    };
  const info = def(vars);
  return generateFactMetadata({
    title: info.title,
    value: info.value,
    description: info.description,
    fact: params.fact,
  });
}

export default async function FactPage({
  params,
}: {
  params: { fact: string };
}) {
  const vars = await getDynamicVariables();
  const def = FACTS.get(params.fact);
  if (!def) return notFound();
  const info = def(vars);

  // JSON-LD structured data
  const jsonLd = [
    generateWebPageSchema({
      title: info.title,
      description: `${info.description} Current value: ${info.value}. Quick facts about Elon Musk with live variables and AI chat.`,
      url: `/facts/${params.fact}`,
      breadcrumbs: [
        { name: "Home", url: "/" },
        { name: "Facts", url: "/facts" },
        { name: info.title.slice(0, 30), url: `/facts/${params.fact}` },
      ],
    }),
    generateBreadcrumbSchema([
      { name: "Home", url: "/" },
      { name: "Facts", url: "/facts" },
      { name: info.title.slice(0, 30), url: `/facts/${params.fact}` },
    ]),
  ];

  return (
    <>
      <JsonLd data={jsonLd} />
      <div className="space-y-6">
        <header className="glass glow-ring rounded-3xl p-6">
          <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
            <Link href="/facts" className="hover:text-white">
              Facts
            </Link>
            <span className="text-white/30">/</span>
            <span className="text-white/80">{params.fact}</span>
          </div>
          <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-white">
            {info.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/65">
            {info.description}
          </p>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <div className="glass rounded-2xl px-5 py-3 text-sm font-semibold text-white">
              {info.value}
            </div>
            <OpenChatButton label="Ask the AI about this fact" />
          </div>
        </header>

        <section className="glass rounded-3xl p-6">
          <h2 className="text-lg font-semibold text-white">Notes</h2>
          <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-white/70">
            <li>
              This is a variable endpoint: you can wire it to Supabase later so
              it updates without code changes.
            </li>
            <li>
              If you need strict accuracy (finance/legal/medical), verify using
              primary sources.
            </li>
          </ul>
        </section>
      </div>
    </>
  );
}
