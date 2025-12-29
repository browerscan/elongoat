import { describe, expect, it } from "vitest";

import {
  extractNextDataFromHtml,
  extractTimelineEntries,
  extractXHandlesFromText,
  parseTweetsFromSyndicationNextData,
} from "../backend/lib/xSyndication";

describe("x syndication parsing", () => {
  it("extracts __NEXT_DATA__ JSON from HTML", () => {
    const payload = { hello: "world" };
    const html = `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(
      payload,
    )}</script></body></html>`;
    expect(extractNextDataFromHtml(html)).toEqual(payload);
  });

  it("parses timeline entries + tweets", () => {
    const nextData = {
      props: {
        pageProps: {
          timeline: {
            entries: [
              {
                type: "tweet",
                entry_id: "tweet-123",
                sort_index: "1",
                content: {
                  tweet: {
                    id_str: "2001742502332911922",
                    created_at: "Thu Dec 18 19:52:57 +0000 2025",
                    full_text: "The future is going to be AMAZING.",
                    permalink: "/elonmusk/status/2001742502332911922",
                    favorite_count: 1,
                    reply_count: 2,
                    retweet_count: 3,
                    quote_count: 4,
                    user: {
                      screen_name: "elonmusk",
                      name: "Elon Musk",
                      followers_count: 10,
                      friends_count: 20,
                      profile_image_url_https: "https://example.com/a.jpg",
                    },
                  },
                },
              },
            ],
          },
        },
      },
    };

    expect(extractTimelineEntries(nextData)).toHaveLength(1);

    const tweets = parseTweetsFromSyndicationNextData({
      monitoredHandle: "elonmusk",
      nextData,
      limit: 10,
    });

    expect(tweets).toHaveLength(1);
    expect(tweets[0]?.tweetId).toBe("2001742502332911922");
    expect(tweets[0]?.authorHandle).toBe("elonmusk");
    expect(tweets[0]?.url).toBe(
      "https://x.com/elonmusk/status/2001742502332911922",
    );
    expect(tweets[0]?.content).toBe("The future is going to be AMAZING.");
    expect(tweets[0]?.postedAt).toMatch(/^2025-12-18T/);
  });

  it("extracts handles from @mentions and URLs", () => {
    const text =
      "Follow @Foo_Bar and https://x.com/TestUser plus https://twitter.com/Other.";
    expect(extractXHandlesFromText(text).sort()).toEqual([
      "foo_bar",
      "other",
      "testuser",
    ]);
  });
});
