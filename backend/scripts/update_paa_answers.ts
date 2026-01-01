#!/usr/bin/env tsx

/**
 * Update PAA index with generated answers
 */

import fs from "fs";
import path from "path";

const PAA_INDEX_PATH = path.join(
  __dirname,
  "../../data/generated/paa-index.json",
);

interface Question {
  slug: string;
  question: string;
  parent: string;
  answer: string | null;
  sourceUrl: string | null;
  sourceTitle: string | null;
  volume: number;
}

interface PAAIndex {
  generatedAt: string;
  source: string;
  questions: Question[];
}

// Generated answers from codex batches
const generatedAnswers: Record<string, string> = {
  // Batch 1
  "what-car-does-elon-musk-drive":
    "Elon Musk most often appears driving (or being driven in) Tesla vehicles, but there isn't a single \"official\" daily-driver he consistently confirms. In public events and social posts, he's frequently associated with Tesla flagships like the Model S (including high-performance variants) and newer headline vehicles such as the Cybertruck. That makes sense: as Tesla's CEO and product promoter, he tends to showcase Tesla models in real-world use. Separately, Musk is known to own or have owned notable collector cars. For example, major outlets including CNBC have reported he bought the James Bond \"Wet Nellie\" Lotus Esprit submarine prop at auction, and it's widely cited as part of his collection. Biographical reporting (including Walter Isaacson's book on Musk) and mainstream coverage over the years also describe him as an enthusiast who has owned high-end cars in the past. Bottom line: if you're searching \"what car does Elon Musk drive,\" the most accurate SEO answer is that he primarily drives Teslas publicly, while also having a history of owning rare collector vehicles reported by major media.",
  "is-elon-musk-a-trillionaire":
    'No—Elon Musk is not a trillionaire as of January 1, 2026. His wealth is enormous, but credible trackers still place him below $1 trillion. For example, Forbes\' Real-Time Billionaires List and Bloomberg\'s Billionaires Index regularly publish Musk\'s estimated net worth based on Tesla shares, private-company valuations (notably SpaceX), and other holdings, and those estimates fluctuate day to day with markets and private tender offers. In late 2025, major coverage highlighted that Musk\'s net worth had reached the high hundreds of billions on some trackers, sparking headlines about him being "on the path" to $1 trillion. That wording matters: "could become" is not the same as "is." A trillionaire milestone would require either a major sustained surge in Tesla\'s market cap, a significantly higher valuation for SpaceX/xAI/X-related assets, or a compensation/event-driven jump large enough to clear the $1 trillion threshold.',
  "how-do-i-contact-elon-musk":
    'Realistically, there is no publicly listed, reliable "direct email" or phone number for Elon Musk, and many sites claiming one are scams. The most credible way to try to contact Musk is through public, verifiable channels: 1) X (formerly Twitter): Musk is highly active there, and replying to his posts is the most direct public route. A paid X subscription may improve message visibility in some contexts, but there is no guarantee he will see or respond. 2) Official company channels: If your request is business-related, use the formal contact paths for Tesla, SpaceX, and xAI (press pages, customer support, investor relations, or partnership inquiries). 3) Charitable/philanthropy routes: For grants or nonprofit outreach, look for the Musk Foundation\'s official presence and submission guidance. Safety tip: Don\'t send money, crypto, or sensitive personal data to anyone claiming to "connect you to Elon." Verify accounts and domains carefully.',
  "why-did-elon-musk-support-trump":
    "Elon Musk's support for Donald Trump has been explained in reporting as a mix of ideology, policy preference, and political strategy—plus Musk's own public statements. During the 2024 election cycle, outlets like NPR reported Musk became a major financial backer through a pro-Trump super PAC and publicly endorsed Trump. Coverage in 2025 described Musk aligning himself with Trump-world politics and policy priorities. The most commonly cited reasons include: support for deregulation and a business-friendly approach; opposition to certain Democratic policies; and Musk's stated concerns about \"free speech\" and culture-war issues, which intensified after he bought Twitter/X. Musk has also criticized government bureaucracy and positioned himself as an efficiency-oriented reformer—framing that as compatible with Trump's agenda.",
  "what-is-elon-musk-diagnosed-with":
    "Elon Musk has publicly said he has Asperger's syndrome, a term commonly associated with autism spectrum disorder (ASD). He disclosed this during his opening monologue while hosting Saturday Night Live in May 2021, which was widely covered by major outlets such as CBS News and Forbes. Important context: In modern clinical practice, \"Asperger's\" is no longer typically used as a separate formal diagnosis; it's generally understood within the broader autism spectrum framework. Media coverage often notes this shift while still reporting Musk's own wording. Beyond that, people frequently search for additional diagnoses, but it's not credible to list medical conditions without clear, on-the-record confirmation.",
  "is-elon-musk-a-vegan":
    "No—Elon Musk is not known to be vegan, and he has not consistently identified himself that way in credible public statements. In fact, Musk has repeatedly described preferences that don't align with a vegan diet, including enjoying classic \"American food\" and other non-plant-based meals. He's also joked about prioritizing tasty food over strict health rules in long-form interviews. Because diet claims get exaggerated online, the most credible approach is to rely on primary-source statements (Musk's own interviews and posts) rather than influencer summaries. Across those public comments, there's no solid evidence he follows a vegan lifestyle, avoids all animal products, or advocates veganism as a personal rule.",
  "why-are-people-protesting-against-elon-musk":
    "People protest Elon Musk for a range of political and business-related reasons, and the motives vary by place and time. In 2025, major outlets including the Associated Press, The Guardian, and Wired reported on organized demonstrations targeting Tesla stores and Musk personally—often framed around opposition to Musk's political role and influence, especially tied to his involvement with the Trump administration and government \"efficiency\" efforts. A prominent theme has been economic pressure: urging consumers to boycott Tesla, sell Tesla shares, or publicly distance themselves from Musk. Some protesters argue Musk's political activity, rhetoric, and alliances are harmful to democratic institutions or social programs; others focus on labor issues, corporate governance, and brand safety.",
  "how-many-hair-transplants-has-elon-musk-had":
    'There is no verified, reliable public record stating how many hair transplants Elon Musk has had—so any precise number (or "how many grafts") is speculation. Musk has not published medical documentation, and he has not consistently confirmed specific cosmetic procedures in a way that would allow a factual count. What we can say with confidence is that Musk\'s hairline and density have visibly changed over decades, which has led to widespread online discussion and commentary from hair-restoration marketers and "celebrity procedure" blogs. However, those sources are not medical records and often disagree with each other, which is exactly why they shouldn\'t be treated as credible proof.',
  "is-elon-musk-supporting-trump":
    'Yes—Elon Musk has supported Donald Trump in concrete, documentable ways, particularly during the 2024 election cycle, though the relationship has also shown periods of tension. Reporting by NPR described Musk as a major financial backer through a pro-Trump super PAC (with donations disclosed via FEC filings). Multiple outlets also reported that Musk publicly endorsed Trump in mid-2024 and then continued appearing as a vocal supporter during the campaign. In 2025, coverage described Musk as closely aligned with Trump-world politics, at times tied to government "efficiency" efforts and broader conservative priorities. At the same time, late-2025 reporting from major newspapers has portrayed the Musk–Trump dynamic as volatile—featuring public disagreements, shifting influence, and attempted reconciliations.',
  "what-surgeries-has-elon-musk-had":
    "Elon Musk has not provided a comprehensive, verifiable public list of surgeries he has had, so it's not possible to answer with an accurate catalog without drifting into rumors. High-profile people often face nonstop speculation about cosmetic or medical procedures, but credible reporting standards require either (1) medical documentation made public by the person, or (2) an explicit, on-the-record confirmation. What's commonly discussed online includes alleged cosmetic work (especially hair restoration), yet Musk has not reliably confirmed procedure details in a way that supports a factual checklist. Visual changes over time are not proof of surgery, and \"expert guesses\" in celebrity-surgery content are not the same as confirmed medical history.",
  "what-surgery-did-elon-musk-have":
    "Elon Musk has not publicly confirmed undergoing any specific surgery in a way that can be verified through primary sources. Online posts often speculate about cosmetic procedures (most commonly hair restoration), but reputable outlets generally treat that as rumor unless it is backed by an on-the-record statement, medical documentation, or reporting from a major newsroom. For a reliable answer, look for Musk's own comments in recorded interviews, or reporting from organizations with strict editorial standards such as Reuters, The Wall Street Journal, or Forbes. Biographical works that cover his life and business career focus on companies, family history, and work habits rather than publishing a detailed medical or surgical timeline.",
  "where-does-elon-musk-live":
    "Elon Musk's location has shifted over time, and he also travels frequently for Tesla, SpaceX and other ventures. In recent years, Musk has repeatedly said he moved his primary base to Texas. Major profiles commonly identify Austin, Texas as his residence in recent rich-list snapshots, aligning with Tesla's major operations and headquarters presence in the Austin area. Musk has also publicly described living near SpaceX's launch and test site on the Texas Gulf Coast, around Boca Chica/Starbase, and has characterized his personal housing there as modest; outlets such as CBS News have reported on those statements and the small-home narrative.",
  "who-is-elon-musk-s-manager":
    'Elon Musk isn\'t managed in the way an entertainer is. He runs multiple companies as CEO or executive leader, so there is no single publicly identified "manager" who supervises his day-to-day work. In corporate terms, Musk is accountable to boards of directors and, for public companies like Tesla, ultimately to shareholders through governance structures described in company filings and public disclosures. When people ask about his "manager," they often really mean his representatives: lawyers, communications staff, and investor-relations contacts. For example, major outlets have identified attorney Alex Spiro (Quinn Emanuel) as a prominent legal representative for Musk in high-profile disputes and corporate matters.',
  "who-is-the-1-richest-family":
    'Rankings of the #1 richest family depend on methodology—especially whether "family wealth" includes monarchies and state-linked assets. In mainstream business rankings that focus on identifiable private holdings, the Walton family (heirs to Walmart) is frequently listed at or near the top. Bloomberg\'s annual "Richest Families" feature, for example, has repeatedly put the Waltons in the No. 1 spot with wealth in the hundreds of billions of dollars, driven by their large ownership stake in Walmart. Other widely cited contenders in global dynasty lists include Gulf royal families (such as Abu Dhabi\'s Al Nahyan family), but estimates can vary because sovereign wealth, state revenues and private assets are difficult to separate cleanly.',
  "what-is-elon-musk-s-1-hour-rule":
    "There isn't a single, universally documented \"Elon Musk 1 hour rule\" that Musk has formally defined. The phrase is often used online as shorthand for his broader time-management philosophy: protect focused thinking time and eliminate low-value meetings. Two well-sourced ideas that get blended into this myth are (1) Musk's preference for long, uninterrupted blocks to think, discussed in business coverage such as CNBC, and (2) his internal guidance at Tesla to keep meetings short, cut unnecessary recurring meetings, and leave a meeting when you're no longer adding value—also reported by CNBC from a company email. If you see a \"1 hour rule\" claim, it's best to interpret it as: reserve at least one uninterrupted hour for deep work or problem-solving, and aggressively defend that time from calendar clutter.",
  "does-elon-musk-pay-taxes":
    "Yes—Elon Musk pays taxes, but the amount and timing depend on how his income is structured. Like many billionaire founders, much of Musk's wealth is tied up in company equity, and unrealized stock gains generally aren't taxed in the U.S. until shares are sold or certain compensation is exercised. That structure can make annual income-tax totals look low in years when someone primarily holds appreciating stock. In years when Musk sells shares or exercises stock options, tax bills can be enormous. For instance, Musk publicly said he would pay over $11 billion in taxes for 2021, a claim widely reported by outlets such as CNBC and CBS News in the context of his Tesla option exercises and stock sales.",
  "who-is-the-richest-child-ever":
    'There isn\'t a single, universally accepted answer to "the richest child ever," because "child" (under 18), "richest" (net worth vs. family wealth) and ownership (direct vs. trusts) are hard to define and verify. Most credible wealth trackers (Forbes, Bloomberg) focus on adults, and they generally avoid assigning precise net worths to minors when assets are held in family structures. That said, one of the strongest documented reference points comes from Guinness World Records\' discussion of Alexandra Andresen, which notes she received a large stake in her family\'s investment company as a child and that the value later made her the world\'s youngest billionaire in public rankings.',
  "is-there-a-family-that-is-a-trillionaire":
    'No family is reliably and publicly documented as "a trillionaire family" in the way that individual billionaires are tracked. Credible rankings that focus on identifiable private holdings—such as Bloomberg\'s annual "Richest Families" list—show the top dynasties in the hundreds of billions, not a confirmed $1+ trillion. The Walton family is often cited as No. 1 in those lists, with wealth around or above the $500 billion range in recent updates, which is enormous but still below a trillion. You will sometimes see claims that certain royal families (commonly the House of Saud or other Gulf monarchies) are "worth" a trillion dollars, but those estimates often blur private family wealth with national resources, sovereign wealth funds, or state-controlled companies.',
  "who-is-the-wealthiest-person-on-earth":
    "The \"wealthiest person on Earth\" can change quickly, so the most accurate answer always depends on the date and the ranking methodology. As of late 2025 / early January 2026 snapshots, Forbes' Real-Time Billionaires coverage and related rich-list reporting place Elon Musk at No. 1, with an estimated net worth in the hundreds of billions of dollars driven by his stakes in Tesla, SpaceX and his AI/social holdings. Bloomberg's Billionaires Index is another widely used benchmark, and it can show slightly different numbers because it updates continuously and uses its own valuation assumptions, especially for private-company stakes.",
  "does-musk-believe-in-god":
    "Elon Musk's public comments suggest he is not traditionally religious, but he also doesn't present himself as a hardline atheist in every interview. In recent years he has described himself as a \"cultural Christian,\" saying he values the teachings of Jesus and sees moral wisdom in Christian ethics—coverage of a 2024 conversation with Jordan Peterson highlighted that framing, and broader reporting has discussed Musk's evolving spiritual language. When asked directly about God, Musk has often answered in probabilistic terms—open to the idea of a creator or a first cause, but unconvinced about a personal, interventionist deity and skeptical of claims that can't be supported by evidence.",
};

// Load the PAA index
const paaIndex: PAAIndex = JSON.parse(fs.readFileSync(PAA_INDEX_PATH, "utf-8"));

// Update questions with generated answers
let updatedCount = 0;
for (const question of paaIndex.questions) {
  if (generatedAnswers[question.slug] && question.answer === null) {
    question.answer = generatedAnswers[question.slug];
    updatedCount++;
  }
}

// Save updated index
fs.writeFileSync(PAA_INDEX_PATH, JSON.stringify(paaIndex, null, 2) + "\n");

console.log(`Updated ${updatedCount} answers in PAA index.`);
console.log(`Total questions: ${paaIndex.questions.length}`);
console.log(
  `Questions with answers: ${paaIndex.questions.filter((q) => q.answer !== null).length}`,
);
