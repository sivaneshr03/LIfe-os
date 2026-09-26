import { Miniflare } from 'miniflare';
import fs from 'fs';
import path from 'path';

export async function createTestDatabase(): Promise<{ db: D1Database; dispose: () => Promise<void> }> {
  const mf = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response(null); } }',
    d1Databases: ['DB'],
  });

  const db = (await mf.getD1Database('DB')) as unknown as D1Database;
  const drizzleDir = path.resolve(__dirname, '../drizzle');
  const files = fs.readdirSync(drizzleDir).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    const raw = fs.readFileSync(path.join(drizzleDir, file), 'utf8');
    const statements = raw.split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      await db.prepare(stmt).run();
    }
  }

  return {
    db,
    dispose: () => mf.dispose(),
  };
}
