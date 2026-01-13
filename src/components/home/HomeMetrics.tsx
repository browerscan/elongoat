import { fetchArticleCount } from "../../lib/apiClient";
import { getClusterIndex } from "../../lib/indexes";
import { getTweetStats } from "../../lib/muskTweets";

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="glass-premium rounded-3xl p-6">
      <div className="text-xs font-semibold uppercase tracking-wider text-white/55">
        {label}
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-tight text-white">
        {value}
      </div>
      <div className="mt-2 text-sm text-white/55">{hint}</div>
    </div>
  );
}

export async function HomeMetrics() {
  // Parallel fetch for metrics only
  const [cluster, articleCount, tweetStats] = await Promise.all([
    getClusterIndex(),
    fetchArticleCount(),
    getTweetStats(),
  ]);

  return (
    <section className="grid gap-4 md:grid-cols-3">
      <MetricCard
        label="Articles"
        value={articleCount.toLocaleString()}
        hint="AI-generated content"
      />
      <MetricCard
        label="Tweets"
        value={tweetStats?.totalTweets.toLocaleString() || "55K+"}
        hint="2010-2025 archive"
      />
      <MetricCard
        label="Topics"
        value={cluster.topics.length.toLocaleString()}
        hint="Knowledge graph hubs"
      />
    </section>
  );
}
