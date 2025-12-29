#!/usr/bin/env python3
"""
Prepare Knowledge Base for ElonGoat RAG

Combines multiple data sources into a unified knowledge base:
1. Google PAA data (local CSV)
2. Wikipedia - Elon Musk article
3. YouTube transcripts (optional)

Output: output/knowledge.jsonl
"""

import json
import hashlib
import re
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional

try:
    import pandas as pd
except ImportError:
    print("ERROR: pandas not installed. Run: pip install pandas")
    exit(1)

try:
    import requests
except ImportError:
    print("ERROR: requests not installed. Run: pip install requests")
    exit(1)


class KnowledgeBaseBuilder:
    """Build knowledge base from multiple sources"""

    def __init__(self, output_path: str):
        self.output_path = Path(output_path)
        self.entries: List[Dict] = []
        self.stats = {
            'paa': 0,
            'wikipedia': 0,
            'youtube': 0,
            'total': 0
        }

    def generate_id(self, text: str, source: str) -> str:
        """Generate unique ID for knowledge entry"""
        content = f"{source}:{text}"
        return hashlib.md5(content.encode()).hexdigest()[:12]

    def add_entry(self, text: str, source: str, metadata: Dict = None):
        """Add entry to knowledge base"""
        if not text or len(text.strip()) < 20:
            return

        entry = {
            'id': self.generate_id(text, source),
            'text': text.strip(),
            'source': source,
            'created_at': datetime.now().isoformat()
        }

        if metadata:
            entry.update(metadata)

        self.entries.append(entry)

    def load_paa_data(self, csv_path: str):
        """Load PAA data from CSV"""
        print(f"\nLoading PAA data from {csv_path}...")

        path = Path(csv_path)
        if not path.exists():
            print(f"  Warning: {csv_path} not found")
            return

        df = pd.read_csv(path, encoding='utf-8')
        print(f"  Found {len(df)} rows")

        for _, row in df.iterrows():
            # Extract question
            question = str(row.get('PAA Title', '')).strip()
            if not question:
                continue

            # Extract answer text
            answer = str(row.get('Text', '')).strip()

            # Combine Q&A
            if answer and answer != 'nan':
                text = f"Q: {question}\nA: {answer}"
            else:
                text = f"Q: {question}"

            # Add metadata
            metadata = {
                'type': 'paa',
                'parent': str(row.get('Parent', '')).strip(),
                'url': str(row.get('URL', '')).strip()
            }

            self.add_entry(text, 'paa', metadata)
            self.stats['paa'] += 1

        print(f"  Added {self.stats['paa']} PAA entries")

    def fetch_wikipedia(self, topic: str = "Elon Musk"):
        """Fetch Wikipedia article and extract key paragraphs"""
        print(f"\nFetching Wikipedia article: {topic}...")

        try:
            # Use Wikipedia API
            url = "https://en.wikipedia.org/api/rest_v1/page/summary/" + topic.replace(" ", "_")
            response = requests.get(url, timeout=10)

            if response.status_code == 200:
                data = response.json()
                extract = data.get('extract', '')

                if extract:
                    # Split into paragraphs
                    paragraphs = [p.strip() for p in extract.split('\n') if p.strip()]

                    for para in paragraphs:
                        if len(para) > 50:
                            self.add_entry(para, 'wikipedia', {'topic': topic})
                            self.stats['wikipedia'] += 1

                print(f"  Added {self.stats['wikipedia']} Wikipedia entries")
            else:
                print(f"  Failed to fetch Wikipedia: {response.status_code}")

        except Exception as e:
            print(f"  Error fetching Wikipedia: {e}")

    def fetch_wikipedia_full(self, topic: str = "Elon Musk"):
        """Fetch full Wikipedia article with sections"""
        print(f"\nFetching full Wikipedia article: {topic}...")

        try:
            # MediaWiki API for full content
            url = "https://en.wikipedia.org/w/api.php"
            params = {
                'action': 'query',
                'titles': topic,
                'prop': 'extracts',
                'explaintext': True,
                'format': 'json'
            }

            response = requests.get(url, params=params, timeout=30)

            if response.status_code == 200:
                data = response.json()
                pages = data.get('query', {}).get('pages', {})

                for page_id, page_data in pages.items():
                    if page_id == '-1':
                        print(f"  Page not found: {topic}")
                        continue

                    extract = page_data.get('extract', '')

                    # Split into sections
                    sections = re.split(r'\n\n+', extract)

                    for section in sections:
                        section = section.strip()
                        # Skip very short or header-only sections
                        if len(section) > 100:
                            # Truncate very long sections
                            if len(section) > 1000:
                                section = section[:1000] + "..."

                            self.add_entry(section, 'wikipedia', {'topic': topic})
                            self.stats['wikipedia'] += 1

                print(f"  Added {self.stats['wikipedia']} Wikipedia entries")
            else:
                print(f"  Failed: {response.status_code}")

        except Exception as e:
            print(f"  Error: {e}")

    def add_curated_facts(self):
        """Add curated Elon Musk facts"""
        print("\nAdding curated facts...")

        facts = [
            "Elon Musk was born on June 28, 1971, in Pretoria, South Africa. He holds citizenship in South Africa, Canada, and the United States.",
            "Elon Musk is the CEO of Tesla, Inc., SpaceX, and X Corp. He also leads Neuralink and The Boring Company.",
            "Elon Musk has 14 children from multiple relationships. His children include Nevada (deceased), twins Griffin and Vivian, triplets Kai, Saxon, and Damian, X Æ A-12, Exa Dark, and others.",
            "As of 2024, Elon Musk's net worth exceeds $400 billion, making him the richest person in the world.",
            "Elon Musk founded SpaceX in 2002 with the goal of reducing space transportation costs and enabling Mars colonization.",
            "Elon Musk became CEO of Tesla in 2008 after investing in the company during its early funding rounds.",
            "Elon Musk has publicly stated he has Asperger's syndrome, which he revealed during his Saturday Night Live hosting appearance in 2021.",
            "Elon Musk acquired Twitter for $44 billion in October 2022 and rebranded it as X in July 2023.",
            "Elon Musk stands at 6 feet 2 inches (188 cm) tall.",
            "Elon Musk's companies include Tesla, SpaceX, X (Twitter), xAI, Neuralink, and The Boring Company.",
            "Elon Musk sold his first video game, Blastar, for $500 when he was 12 years old.",
            "Elon Musk moved to Canada at age 17 and later to the United States to attend the University of Pennsylvania.",
            "Elon Musk co-founded PayPal, which was sold to eBay for $1.5 billion in 2002.",
            "Elon Musk's goal is to establish a self-sustaining city on Mars within the next few decades.",
            "Elon Musk has been married three times: to Justine Wilson (2000-2008) and twice to Talulah Riley (2010-2012, 2013-2016)."
        ]

        for fact in facts:
            self.add_entry(fact, 'curated', {'type': 'fact'})

        print(f"  Added {len(facts)} curated facts")

    def save(self):
        """Save knowledge base to JSONL file"""
        print(f"\nSaving knowledge base to {self.output_path}...")

        # Ensure output directory exists
        self.output_path.parent.mkdir(parents=True, exist_ok=True)

        # Deduplicate by ID
        seen_ids = set()
        unique_entries = []
        for entry in self.entries:
            if entry['id'] not in seen_ids:
                seen_ids.add(entry['id'])
                unique_entries.append(entry)

        # Save to JSONL
        with open(self.output_path, 'w', encoding='utf-8') as f:
            for entry in unique_entries:
                json.dump(entry, f, ensure_ascii=False)
                f.write('\n')

        self.stats['total'] = len(unique_entries)

        # Print summary
        print(f"\nKnowledge Base Summary:")
        print(f"  PAA entries:       {self.stats['paa']}")
        print(f"  Wikipedia entries: {self.stats['wikipedia']}")
        print(f"  Curated facts:     {len([e for e in unique_entries if e['source'] == 'curated'])}")
        print(f"  Total entries:     {self.stats['total']}")
        print(f"  Output file:       {self.output_path}")

        # File size
        file_size = self.output_path.stat().st_size / 1024
        print(f"  File size:         {file_size:.1f} KB")


def main():
    """Main entry point"""
    # Paths
    project_root = Path(__file__).parent.parent
    data_dir = project_root / 'data'
    output_dir = project_root / 'output'

    paa_file = data_dir / 'google-paa-elon-musk-level8-23-12-2025.csv'
    output_file = output_dir / 'knowledge.jsonl'

    print("="*60)
    print("ElonGoat Knowledge Base Builder")
    print("="*60)

    # Initialize builder
    builder = KnowledgeBaseBuilder(str(output_file))

    # Load PAA data
    builder.load_paa_data(str(paa_file))

    # Fetch Wikipedia
    builder.fetch_wikipedia_full("Elon Musk")

    # Add curated facts
    builder.add_curated_facts()

    # Save
    builder.save()

    print("\n" + "="*60)
    print("Knowledge base created successfully!")
    print("="*60 + "\n")


if __name__ == '__main__':
    main()
