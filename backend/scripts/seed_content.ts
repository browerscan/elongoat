import "dotenv/config";

import { getDb, withTransaction } from "../lib/db";
import { slugify } from "../lib/slugify";
import { vectorEngineChatComplete } from "../../src/lib/vectorengine";

// ============================================================================
// Configuration
// ============================================================================

const CONTENT_MODEL =
  process.env.VECTORENGINE_CONTENT_MODEL ?? "claude-sonnet-4-5-20250929";
const BATCH_SIZE = 5;
const DELAY_MS = 500;

// ============================================================================
// Types
// ============================================================================

type PaaQuestion = {
  id: string;
  slug: string;
  question: string;
  answer: string | null;
};

type VideoRecord = {
  video_id: string;
  title: string | null;
};

type TweetRecord = {
  tweet_id: string;
  handle: string;
  content: string | null;
};

// ============================================================================
// Sample Content (Fallbacks)
// ============================================================================

const SAMPLE_VIDEOS = [
  {
    video_id: "zyGzkAmQ5bM",
    title: "Elon Musk talks about Mars colonization",
    channel: "SpaceX",
    snippet:
      "Elon Musk discusses the technical challenges and timeline for establishing a self-sustaining city on Mars, including Starship development and the importance of making humanity multi-planetary.",
    duration: "12:34",
    thumbnail: "https://img.youtube.com/vi/zyGzkAmQ5bM/hqdefault.jpg",
    published_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    video_id: "cdpHfra2i4E",
    title: "Tesla Full Self-Driving update",
    channel: "Tesla",
    snippet:
      "Overview of Tesla's latest FSD capabilities, including neural network training progress and real-world driving demonstrations.",
    duration: "8:15",
    thumbnail: "https://img.youtube.com/vi/cdpHfra2i4E/hqdefault.jpg",
    published_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    video_id: "AZ2zHvILoQQ",
    title: "Elon Musk on AI and xAI",
    channel: "xAI",
    snippet:
      "Elon discusses the development of Grok, xAI's approach to artificial general intelligence, and safety considerations for advanced AI systems.",
    duration: "15:42",
    thumbnail: "https://img.youtube.com/vi/AZ2zHvILoQQ/hqdefault.jpg",
    published_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    video_id: "uBk5Q9QFEqA",
    title: "Starship flight test highlights",
    channel: "SpaceX",
    snippet:
      "Compilation of recent Starship test flights showing successful booster catches, orbital maneuvers, and splashdown landings.",
    duration: "6:28",
    thumbnail: "https://img.youtube.com/vi/uBk5Q9QFEqA/hqdefault.jpg",
    published_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    video_id: "t63cFR9VOtc",
    title: "Tesla Optimus robot update",
    channel: "Tesla",
    snippet:
      "Latest developments in Tesla's Optimus humanoid robot program, including improved dexterity, walking gait, and task demonstration.",
    duration: "10:55",
    thumbnail: "https://img.youtube.com/vi/t63cFR9VOtc/hqdefault.jpg",
    published_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const SAMPLE_TWEETS = [
  {
    tweet_id: "1234567890123456789",
    handle: "elonmusk",
    content:
      "Mars is looking good today. Starship development accelerating rapidly.",
    url: "https://x.com/elonmusk/status/1234567890123456789",
    posted_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    tweet_id: "1234567890123456790",
    handle: "elonmusk",
    content:
      "Tesla AI team making great progress on FSD end-to-end neural networks.",
    url: "https://x.com/elonmusk/status/1234567890123456790",
    posted_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
  },
  {
    tweet_id: "1234567890123456791",
    handle: "elonmusk",
    content: "Grok 3 training complete. Biggest jump in capability yet.",
    url: "https://x.com/elonmusk/status/1234567890123456791",
    posted_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    tweet_id: "1234567890123456792",
    handle: "elonmusk",
    content:
      "Starship orbital refuel demo is next major milestone. Critical for Mars.",
    url: "https://x.com/elonmusk/status/1234567890123456792",
    posted_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
  },
  {
    tweet_id: "1234567890123456793",
    handle: "elonmusk",
    content:
      "Optimus will be the biggest product in history. Useful humanoid robotics changes everything.",
    url: "https://x.com/elonmusk/status/1234567890123456793",
    posted_at: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
  },
];

// ============================================================================
// Utility Functions
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ============================================================================
// Content Generation
// ============================================================================

async function generateAnswerForQuestion(
  question: string,
  snippet: string | null,
): Promise<{ answer: string; model: string }> {
  const system = `You are a senior research writer specializing in Elon Musk and his companies.
You are NOT Elon Musk. You are an analyst.
Be factual and cautious. Do not invent private information.
If uncertain, say so and suggest verification.
Output: Markdown only, max 500 words.`;

  const user = [
    `QUESTION: ${question}`,
    snippet ? `EXISTING SNIPPET: ${snippet}` : `EXISTING SNIPPET: (none)`,
    ``,
    `Write a comprehensive answer with:`,
    `1) ## Short answer (2-4 sentences)`,
    `2) ## Key details (2-3 short paragraphs)`,
    `3) ## What to verify (bullet points)`,
    ``,
    `Use public sources only. Be neutral and factual.`,
  ].join("\n");

  try {
    const completion = await vectorEngineChatComplete({
      model: CONTENT_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.35,
      maxTokens: 800,
    });

    return { answer: completion.text.trim(), model: CONTENT_MODEL };
  } catch (err) {
    console.warn(`[seed] AI generation failed for: ${question}`);
    return {
      answer: generateStaticAnswer(question, snippet),
      model: "static",
    };
  }
}

function generateStaticAnswer(
  question: string,
  snippet: string | null,
): string {
  const lowerQ = question.toLowerCase();

  // Category-based static answers
  if (lowerQ.includes("children") || lowerQ.includes("kid")) {
    return `## Short answer
Elon Musk has ${new Date().getFullYear() - 1971 > 50 ? "14" : "multiple"} children that have been publicly reported, including Nevada, Vivian, Griffin, and others with different partners.

## Key details
Musk has children with Justine Wilson, Grimes, Shivon Zilis, and others. He has spoken about family size as a factor in addressing underpopulation concerns.

## What to verify
- Current number of children (may have changed)
- Names and ages of all children
- Custody arrangements and public appearances

> This is a general overview. For current information, check recent reputable sources.`;
  }

  if (
    lowerQ.includes("net worth") ||
    lowerQ.includes("rich") ||
    lowerQ.includes("wealth")
  ) {
    return `## Short answer
Elon Musk's net worth fluctuates significantly based on Tesla and SpaceX valuations. He has been ranked as the wealthiest or second-wealthiest person globally.

## Key details
- Most value comes from Tesla stock and SpaceX ownership
- xAI and other holdings contribute significantly
- Net worth can change by tens of billions in a single day due to stock movements

## What to verify
- Current Forbes/Bloomberg real-time rankings
- Recent Tesla stock price
- Latest funding rounds for SpaceX and xAI

> Financial information changes rapidly. Always verify with current sources.`;
  }

  if (
    lowerQ.includes("autis") ||
    lowerQ.includes("asperger") ||
    lowerQ.includes("diagnos")
  ) {
    return `## Short answer
Elon Musk disclosed on Saturday Night Live in 2021 that he has Asperger's syndrome, which is now classified as part of autism spectrum disorder.

## Key details
- Musk revealed this publicly during his SNL hosting appearance
- Asperger's is a form of high-functioning autism
- He has mentioned that this affects his social communication but not his technical abilities

## What to verify
- Medical definitions (Asperger's was reclassified in DSM-5)
- Any other public statements about this diagnosis

> This information is based on Musk's own public statements.`;
  }

  if (lowerQ.includes("age") || lowerQ.includes("born")) {
    return `## Short answer
Elon Musk was born on June 28, 1971, in Pretoria, South Africa. As of ${new Date().getFullYear()}, he is ${new Date().getFullYear() - 1971} years old.

## Key details
- Grew up in South Africa before moving to Canada
- Later transferred to the University of Pennsylvania
- Became a U.S. citizen

## What to verify
- Current age based on today's date
- Educational background details
- Citizenship timeline

> Biographical details are generally well-documented.`;
  }

  // Default static answer
  return [
    `## Short answer`,
    snippet
      ? `${snippet}`
      : `This question about Elon Musk requires current verification.`,
    ``,
    `## Key details`,
    `- Information about "${question}" changes frequently`,
    `- Check official sources for the most up-to-date information`,
    `- Consider the date when this was generated`,
    ``,
    `## What to verify`,
    `- Recent news articles from reputable sources`,
    `- Official statements from Musk or his companies`,
    `- SEC filings for business-related questions`,
    ``,
    `> ${snippet ? "Answer based on available sources." : "Use the chat for a personalized response."}`,
  ].join("\n");
}

// ============================================================================
// Database Operations
// ============================================================================

async function getPaaQuestionsWithoutAnswer(
  limit: number,
): Promise<PaaQuestion[]> {
  const db = getDb();
  const result = await db.query<PaaQuestion>(
    `SELECT id, slug, question, answer
     FROM elongoat.paa_tree
     WHERE answer IS NULL OR answer = ''
     ORDER BY volume DESC NULLS LAST, question
     LIMIT $1`,
    [limit],
  );
  return result.rows;
}

async function getEmptyVideoCount(): Promise<number> {
  const db = getDb();
  const result = await db.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM elongoat.youtube_videos`,
  );
  return Number.parseInt(result.rows[0]?.count ?? "0", 10);
}

async function getEmptyTweetCount(): Promise<number> {
  const db = getDb();
  const result = await db.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM elongoat.x_tweets`,
  );
  return Number.parseInt(result.rows[0]?.count ?? "0", 10);
}

async function updatePaaAnswers(
  updates: Array<{ id: string; answer: string }>,
): Promise<void> {
  await withTransaction(async (client) => {
    for (const batch of chunk(updates, 100)) {
      const values: unknown[] = [];
      const tuples: string[] = [];
      for (let i = 0; i < batch.length; i++) {
        const base = i * 2;
        tuples.push(`($${base + 1}, $${base + 2})`);
        values.push(batch[i].id, batch[i].answer);
      }

      const sql = `
        UPDATE elongoat.paa_tree AS t
        SET answer = v.new_answer, updated_at = NOW()
        FROM (VALUES ${tuples.join(", ")}) AS v(id, new_answer)
        WHERE t.id = v.id
      `;
      await client.query(sql, values);
    }
  });
}

async function seedSampleVideos(): Promise<number> {
  const existingCount = await getEmptyVideoCount();
  if (existingCount > 0) {
    console.log(
      `[seed] Videos already exist (${existingCount}), skipping sample videos`,
    );
    return 0;
  }

  await withTransaction(async (client) => {
    for (const video of SAMPLE_VIDEOS) {
      await client.query(
        `INSERT INTO elongoat.youtube_videos
         (video_id, title, link, channel, snippet, duration, thumbnail, published_at, scraped_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         ON CONFLICT (video_id) DO NOTHING`,
        [
          video.video_id,
          video.title,
          `https://www.youtube.com/watch?v=${video.video_id}`,
          video.channel,
          video.snippet,
          video.duration,
          video.thumbnail,
          video.published_at,
        ],
      );
    }
  });

  console.log(`[seed] Seeded ${SAMPLE_VIDEOS.length} sample videos`);
  return SAMPLE_VIDEOS.length;
}

async function seedSampleTweets(): Promise<number> {
  const existingCount = await getEmptyTweetCount();
  if (existingCount > 0) {
    console.log(
      `[seed] Tweets already exist (${existingCount}), skipping sample tweets`,
    );
    return 0;
  }

  await withTransaction(async (client) => {
    for (const tweet of SAMPLE_TWEETS) {
      await client.query(
        `INSERT INTO elongoat.x_tweets
         (handle, tweet_id, url, content, posted_at, scraped_at, raw)
         VALUES ($1, $2, $3, $4, $5, NOW(), $6)
         ON CONFLICT (tweet_id) DO NOTHING`,
        [
          tweet.handle,
          tweet.tweet_id,
          tweet.url,
          tweet.content,
          tweet.posted_at,
          JSON.stringify(tweet),
        ],
      );
    }
  });

  console.log(`[seed] Seeded ${SAMPLE_TWEETS.length} sample tweets`);
  return SAMPLE_TWEETS.length;
}

// ============================================================================
// Main
// ============================================================================

interface SeedOptions {
  paa?: boolean;
  videos?: boolean;
  tweets?: boolean;
  limit?: number;
}

async function main(options: SeedOptions = {}) {
  const {
    paa = process.env.SEED_PAA === "true",
    videos = process.env.SEED_VIDEOS === "true",
    tweets = process.env.SEED_TWEETS === "true",
    limit = Number.parseInt(process.env.SEED_LIMIT ?? "50", 10),
  } = options;

  // If no flags provided, do all
  const doAll = !paa && !videos && !tweets;
  const doPaa = doAll || paa;
  const doVideos = doAll || videos;
  const doTweets = doAll || tweets;

  console.log("[seed] Content seeding started");
  console.log(
    `[seed] PAA answers: ${doPaa ? "enabled" : "disabled"} (limit: ${limit})`,
  );
  console.log(`[seed] Sample videos: ${doVideos ? "enabled" : "disabled"}`);
  console.log(`[seed] Sample tweets: ${doTweets ? "enabled" : "disabled"}`);

  // Check for API key
  const hasApiKey = !!process.env.VECTORENGINE_API_KEY;
  if (doPaa && !hasApiKey) {
    console.warn(
      "[seed] VECTORENGINE_API_KEY not set - PAA answers will use static content",
    );
  }

  // Seed sample videos
  if (doVideos) {
    try {
      await seedSampleVideos();
    } catch (err) {
      console.error("[seed] Failed to seed videos:", err);
    }
  }

  // Seed sample tweets
  if (doTweets) {
    try {
      await seedSampleTweets();
    } catch (err) {
      console.error("[seed] Failed to seed tweets:", err);
    }
  }

  // Generate PAA answers
  if (doPaa) {
    try {
      const questions = await getPaaQuestionsWithoutAnswer(limit);
      console.log(
        `[seed] Found ${questions.length} PAA questions without answers`,
      );

      if (questions.length === 0) {
        console.log("[seed] All PAA questions have answers");
      } else {
        const updates: Array<{ id: string; answer: string }> = [];

        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          console.log(
            `[seed] [${i + 1}/${questions.length}] Generating: ${q.question.slice(0, 60)}...`,
          );

          const result = hasApiKey
            ? await generateAnswerForQuestion(q.question, q.answer)
            : {
                answer: generateStaticAnswer(q.question, q.answer),
                model: "static",
              };

          updates.push({ id: q.id, answer: result.answer });

          // Batch update
          if (updates.length >= BATCH_SIZE) {
            await updatePaaAnswers(updates);
            console.log(`[seed] Batch saved: ${updates.length} answers`);
            updates.length = 0;
          }

          // Rate limiting
          if (i < questions.length - 1) {
            await sleep(DELAY_MS);
          }
        }

        // Final batch
        if (updates.length > 0) {
          await updatePaaAnswers(updates);
          console.log(`[seed] Final batch saved: ${updates.length} answers`);
        }

        console.log(
          `[seed] PAA seeding complete: ${questions.length} answers generated`,
        );
      }
    } catch (err) {
      console.error("[seed] Failed to generate PAA answers:", err);
    }
  }

  console.log("[seed] Content seeding complete");
  await getDb().end();
}

// Allow running from command line with args
const args = process.argv.slice(2);
const options: SeedOptions = {};
for (const arg of args) {
  if (arg === "--paa") options.paa = true;
  if (arg === "--videos") options.videos = true;
  if (arg === "--tweets") options.tweets = true;
  if (arg.startsWith("--limit="))
    options.limit = Number.parseInt(arg.split("=")[1], 10);
}

main(options).catch((err) => {
  console.error("[seed] Failed:", err);
  process.exitCode = 1;
});
