#!/usr/bin/env python3
"""
Import Codex-Generated Results to Supabase

Reads generated Q&A results from JSONL files and imports them
to the Supabase elongoat.paa_tree table.

Input:  output/results/batch_*_results.jsonl
Output: Supabase elongoat.paa_tree table

Usage:
  python scripts/3_import_results.py                    # Import all results
  python scripts/3_import_results.py --dry-run          # Preview without importing
  python scripts/3_import_results.py --batch batch_001  # Import specific batch
"""

import json
import argparse
import os
from pathlib import Path
from typing import List, Dict
from datetime import datetime

try:
    import psycopg2
    from psycopg2.extras import execute_values
except ImportError:
    print("ERROR: psycopg2 not installed. Run: pip install psycopg2-binary")
    exit(1)


class SupabaseImporter:
    """Import Q&A results to Supabase"""

    def __init__(self, database_url: str, dry_run: bool = False):
        self.database_url = database_url
        self.dry_run = dry_run
        self.conn = None
        self.stats = {
            'loaded': 0,
            'imported': 0,
            'skipped': 0,
            'errors': 0
        }

    def connect(self):
        """Connect to Supabase database"""
        print(f"\nConnecting to database...")

        try:
            self.conn = psycopg2.connect(self.database_url)
            print("  Connected successfully")
        except Exception as e:
            print(f"  Connection failed: {e}")
            raise

    def close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()

    def ensure_schema(self):
        """Ensure elongoat schema and tables exist"""
        if self.dry_run:
            print("\n[DRY RUN] Would create schema and tables")
            return

        print("\nEnsuring schema exists...")

        with self.conn.cursor() as cur:
            cur.execute("""
                CREATE SCHEMA IF NOT EXISTS elongoat;

                CREATE TABLE IF NOT EXISTS elongoat.paa_tree (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    question TEXT NOT NULL,
                    answer TEXT,
                    slug VARCHAR(255) UNIQUE NOT NULL,
                    parent_id UUID REFERENCES elongoat.paa_tree(id),
                    level INTEGER DEFAULT 0,
                    volume INTEGER DEFAULT 0,
                    difficulty INTEGER DEFAULT 0,
                    category VARCHAR(100),
                    meta_description TEXT,
                    related_topics JSONB DEFAULT '[]'::jsonb,
                    source_url TEXT,
                    generated_at TIMESTAMPTZ,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                );

                -- Update timestamp trigger
                CREATE OR REPLACE FUNCTION elongoat.update_timestamp()
                RETURNS TRIGGER AS $$
                BEGIN
                    NEW.updated_at = NOW();
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;

                DROP TRIGGER IF EXISTS update_paa_tree_timestamp ON elongoat.paa_tree;
                CREATE TRIGGER update_paa_tree_timestamp
                    BEFORE UPDATE ON elongoat.paa_tree
                    FOR EACH ROW EXECUTE FUNCTION elongoat.update_timestamp();

                -- Permissions
                GRANT USAGE ON SCHEMA elongoat TO postgres, anon, authenticated, service_role;
                GRANT ALL ON ALL TABLES IN SCHEMA elongoat TO postgres, anon, authenticated, service_role;
            """)
            self.conn.commit()

        print("  Schema ready")

    def load_results(self, results_dir: Path, batch_filter: str = None) -> List[Dict]:
        """Load results from JSONL files"""
        print(f"\nLoading results from {results_dir}...")

        results = []

        # Find all result files
        pattern = f"{batch_filter}_results.jsonl" if batch_filter else "*_results.jsonl"
        result_files = list(results_dir.glob(pattern))

        if not result_files:
            print(f"  No result files found matching: {pattern}")
            return results

        for file_path in sorted(result_files):
            print(f"  Reading {file_path.name}...")

            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    for line in f:
                        if line.strip():
                            entry = json.loads(line)
                            results.append(entry)
                            self.stats['loaded'] += 1
            except Exception as e:
                print(f"    Error reading file: {e}")
                self.stats['errors'] += 1

        print(f"  Loaded {len(results)} entries")
        return results

    def import_results(self, results: List[Dict]):
        """Import results to database"""
        if not results:
            print("\nNo results to import")
            return

        print(f"\nImporting {len(results)} entries...")

        if self.dry_run:
            print("[DRY RUN] Would import:")
            for entry in results[:3]:
                print(f"  - {entry.get('question', 'N/A')[:50]}...")
            if len(results) > 3:
                print(f"  ... and {len(results) - 3} more")
            return

        # Prepare data for bulk insert
        values = []
        for entry in results:
            try:
                values.append((
                    entry.get('question', ''),
                    entry.get('answer', ''),
                    entry.get('slug', ''),
                    entry.get('volume', 0),
                    entry.get('difficulty', 0),
                    entry.get('category', 'general'),
                    entry.get('meta_description', ''),
                    json.dumps(entry.get('related_topics', [])),
                    entry.get('generated_at', datetime.now().isoformat())
                ))
            except Exception as e:
                print(f"  Error preparing entry: {e}")
                self.stats['errors'] += 1

        # Bulk upsert
        with self.conn.cursor() as cur:
            insert_query = """
                INSERT INTO elongoat.paa_tree
                    (question, answer, slug, volume, difficulty, category,
                     meta_description, related_topics, generated_at)
                VALUES %s
                ON CONFLICT (slug) DO UPDATE SET
                    answer = EXCLUDED.answer,
                    volume = EXCLUDED.volume,
                    difficulty = EXCLUDED.difficulty,
                    category = EXCLUDED.category,
                    meta_description = EXCLUDED.meta_description,
                    related_topics = EXCLUDED.related_topics,
                    generated_at = EXCLUDED.generated_at,
                    updated_at = NOW()
            """

            try:
                execute_values(cur, insert_query, values)
                self.conn.commit()
                self.stats['imported'] = len(values)
                print(f"  Imported {len(values)} entries")
            except Exception as e:
                self.conn.rollback()
                print(f"  Import failed: {e}")
                self.stats['errors'] += 1

    def print_stats(self):
        """Print import statistics"""
        print("\n" + "="*60)
        print("IMPORT STATISTICS")
        print("="*60)
        print(f"  Loaded:   {self.stats['loaded']}")
        print(f"  Imported: {self.stats['imported']}")
        print(f"  Skipped:  {self.stats['skipped']}")
        print(f"  Errors:   {self.stats['errors']}")


def main():
    parser = argparse.ArgumentParser(
        description="Import Codex results to Supabase",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Preview without importing'
    )

    parser.add_argument(
        '--batch',
        type=str,
        default=None,
        help='Import specific batch (e.g., batch_001)'
    )

    args = parser.parse_args()

    # Get database URL
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print("ERROR: DATABASE_URL environment variable not set")
        print("\nSet it with:")
        print("  export DATABASE_URL='postgresql://postgres:PASSWORD@supabase-db:5432/postgres?schema=elongoat'")
        exit(1)

    # Paths
    project_root = Path(__file__).parent.parent
    results_dir = project_root / 'output' / 'results'

    print("="*60)
    print("ElonGoat Results Importer")
    print("="*60)

    if args.dry_run:
        print("[DRY RUN MODE]")

    # Initialize importer
    importer = SupabaseImporter(database_url, dry_run=args.dry_run)

    try:
        # Connect
        importer.connect()

        # Ensure schema
        importer.ensure_schema()

        # Load results
        results = importer.load_results(results_dir, args.batch)

        # Import
        importer.import_results(results)

        # Print stats
        importer.print_stats()

    except Exception as e:
        print(f"\nFATAL ERROR: {e}")
        exit(1)

    finally:
        importer.close()

    print("\n" + "="*60)
    print("Import complete!")
    print("="*60 + "\n")


if __name__ == '__main__':
    main()
