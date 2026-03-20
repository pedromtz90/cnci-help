/**
 * Build script: validates content and generates search index.
 * Run with: npm run kb:index
 */
import { loadAllContent } from './loader';

async function main() {
  console.log('📚 Building knowledge base index...\n');

  const content = await loadAllContent();

  // Validate
  let errors = 0;
  for (const item of content) {
    if (!item.id) { console.error(`❌ Missing id: ${item.slug}`); errors++; }
    if (!item.title) { console.error(`❌ Missing title: ${item.slug}`); errors++; }
    if (!item.category) { console.error(`❌ Missing category: ${item.slug}`); errors++; }
    if (!item.content.trim()) { console.error(`❌ Empty content: ${item.slug}`); errors++; }
  }

  if (errors > 0) {
    console.error(`\n❌ ${errors} validation errors found.`);
    process.exit(1);
  }

  // Stats
  const byType = content.reduce<Record<string, number>>((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + 1;
    return acc;
  }, {});

  const byCategory = content.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {});

  console.log(`✅ ${content.length} content items validated\n`);
  console.log('By type:', byType);
  console.log('By category:', byCategory);
  console.log('\n✅ Knowledge base ready.');
}

main().catch(console.error);
