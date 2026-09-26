#!/usr/bin/env node

/**
 * AAS Skills Manager for Antigravity & AI Agents
 * 
 * Provides search, inspection, installation, and management for 2,465+ skills
 * from the Agentic Awesome Skills (AAS) catalog into `.agents/skills/`.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT_DIR = path.resolve(__dirname, '..');
const SKILLS_DIR = path.join(ROOT_DIR, '.agents', 'skills');
const CATALOG_PATH = path.join(ROOT_DIR, '.agents', 'catalog', 'skills_index.json');
const SCRATCH_SRC = 'C:/Users/sivan/.gemini/antigravity-ide/brain/94a84427-4d4e-49f4-b870-a8f7085e11d4/scratch/agentic-awesome-skills/skills';
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/sickn33/agentic-awesome-skills/main/skills';

// Pre-defined popular bundles
const BUNDLES = {
  'web-app-builder': [
    'frontend-design', 'frontend-developer', 'high-end-visual-design', 'interactive-portfolio',
    '3d-web-experience', 'canvas-design', 'animejs-animation', 'mobile-design', 'form-cro'
  ],
  'seo-marketing': [
    'schema-markup', 'seo-content-writer', 'seo-content-auditor', 'frontend-seo', 'copywriting', 'analytics-tracking'
  ],
  'performance-qa': [
    'performance-engineer', 'frontend-lighthouse', 'accessibility-compliance-accessibility-audit',
    'systematic-debugging', 'code-review-checklist'
  ],
  'workflow-git': [
    'concise-planning', 'git-pushing', 'lint-and-validate', 'commit', 'create-pr'
  ],
  'devops-cloud': [
    'docker-expert', 'aws-serverless', 'bash-linux', 'deployment-procedures', 'ci-cd-and-automation'
  ]
};

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadCatalog() {
  if (!fs.existsSync(CATALOG_PATH)) {
    console.error(`Error: Catalog index not found at ${CATALOG_PATH}`);
    process.exit(1);
  }
  try {
    return JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
  } catch (err) {
    console.error(`Error parsing catalog index: ${err.message}`);
    process.exit(1);
  }
}

function getInstalledSkills() {
  ensureDir(SKILLS_DIR);
  return fs.readdirSync(SKILLS_DIR).filter(item => {
    const full = path.join(SKILLS_DIR, item);
    return fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, 'SKILL.md'));
  });
}

function parseSkillFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { name: '', description: '' };
  const yaml = match[1];
  let name = '';
  let description = '';
  
  const nameMatch = yaml.match(/^name:\s*(.+)$/m);
  if (nameMatch) name = nameMatch[1].trim().replace(/^['"]|['"]$/g, '');
  
  const descMatch = yaml.match(/^description:\s*(?:>-\s*|["']?)([\s\S]*?)(?:$|\n[a-z_]+:)/m);
  if (descMatch) description = descMatch[1].trim().replace(/^['"]|['"]$/g, '');
  
  return { name, description };
}

function downloadFile(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'AAS-Skill-Manager' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} when downloading ${url}`));
      }
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function copyFolderRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    ensureDir(dest);
    for (const child of fs.readdirSync(src)) {
      copyFolderRecursive(path.join(src, child), path.join(dest, child));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

// Commands
async function cmdList() {
  const installed = getInstalledSkills();
  console.log(`\n📦 Installed Skills in .agents/skills/ (${installed.length}):\n`);
  if (installed.length === 0) {
    console.log('  No skills installed yet. Use "search" and "install" to add skills.');
    return;
  }
  
  installed.forEach((skillId, idx) => {
    const skillPath = path.join(SKILLS_DIR, skillId, 'SKILL.md');
    try {
      const content = fs.readFileSync(skillPath, 'utf8');
      const { description } = parseSkillFrontmatter(content);
      const descPreview = description ? description.slice(0, 90) + (description.length > 90 ? '...' : '') : 'No description';
      console.log(`  ${(idx + 1).toString().padStart(2)}. \x1b[36m${skillId}\x1b[0m`);
      console.log(`      ${descPreview}\n`);
    } catch {
      console.log(`  ${(idx + 1).toString().padStart(2)}. \x1b[36m${skillId}\x1b[0m\n`);
    }
  });
}

function cmdSearch(keyword) {
  if (!keyword) {
    console.error('Usage: skills-manager search <keyword>');
    return;
  }
  const catalog = loadCatalog();
  const installedSet = new Set(getInstalledSkills());
  const kw = keyword.toLowerCase();
  
  const results = catalog.filter(item => {
    const id = (item.id || '').toLowerCase();
    const name = (item.name || '').toLowerCase();
    const cat = (item.category || '').toLowerCase();
    const desc = (item.description || '').toLowerCase();
    return id.includes(kw) || name.includes(kw) || cat.includes(kw) || desc.includes(kw);
  });
  
  console.log(`\n🔍 Found ${results.length} skills matching "${keyword}":\n`);
  const topResults = results.slice(0, 30);
  
  topResults.forEach((item, idx) => {
    const isInst = installedSet.has(item.id);
    const status = isInst ? '\x1b[32m[Installed]\x1b[0m' : '\x1b[90m[Available]\x1b[0m';
    console.log(`  ${(idx + 1).toString().padStart(2)}. \x1b[36m${item.id}\x1b[0m (${item.category || 'general'}) ${status}`);
    const desc = (item.description || '').slice(0, 100);
    console.log(`      ${desc}${item.description && item.description.length > 100 ? '...' : ''}\n`);
  });
  
  if (results.length > 30) {
    console.log(`  ... and ${results.length - 30} more matches. Narrow your query for specific results.`);
  }
}

function cmdInfo(skillId) {
  if (!skillId) {
    console.error('Usage: skills-manager info <skill-id>');
    return;
  }
  const catalog = loadCatalog();
  const item = catalog.find(x => x.id === skillId || x.name === skillId);
  if (!item) {
    console.error(`Skill "${skillId}" not found in catalog.`);
    return;
  }
  
  const installed = getInstalledSkills().includes(item.id);
  console.log(`\n📋 Skill Details: \x1b[36m${item.id}\x1b[0m`);
  console.log(`  Status:      ${installed ? '\x1b[32mInstalled in .agents/skills/\x1b[0m' : 'Available in catalog'}`);
  console.log(`  Category:    ${item.category || 'N/A'}`);
  console.log(`  Risk level:  ${item.risk || 'safe'}`);
  console.log(`  Source:      ${item.source || 'community'}`);
  console.log(`  Date Added:  ${item.date_added || 'N/A'}`);
  console.log(`\n  Description:`);
  console.log(`  ${item.description || 'No description available.'}\n`);
  if (!installed) {
    console.log(`  To install: node scripts/skills-manager.js install ${item.id}\n`);
  }
}

async function installSingleSkill(skillId, catalog) {
  const dest = path.join(SKILLS_DIR, skillId);
  if (fs.existsSync(path.join(dest, 'SKILL.md'))) {
    console.log(`  - \x1b[33m${skillId}\x1b[0m is already installed.`);
    return true;
  }
  
  // Strategy 1: Check local scratch repository
  const localSrc = path.join(SCRATCH_SRC, skillId);
  if (fs.existsSync(localSrc)) {
    try {
      copyFolderRecursive(localSrc, dest);
      console.log(`  - \x1b[32mInstalled ${skillId}\x1b[0m (from local AAS cache)`);
      return true;
    } catch (err) {
      console.warn(`    Warning: Failed copying local folder: ${err.message}. Trying download...`);
    }
  }
  
  // Strategy 2: Download SKILL.md from GitHub raw
  try {
    const rawUrl = `${GITHUB_RAW_BASE}/${skillId}/SKILL.md`;
    const content = await downloadFile(rawUrl);
    ensureDir(dest);
    fs.writeFileSync(path.join(dest, 'SKILL.md'), content, 'utf8');
    console.log(`  - \x1b[32mInstalled ${skillId}\x1b[0m (downloaded via GitHub)`);
    return true;
  } catch (err) {
    console.error(`  - \x1b[31mFailed to install ${skillId}\x1b[0m: ${err.message}`);
    return false;
  }
}

async function cmdInstall(skillIds) {
  if (!skillIds || skillIds.length === 0) {
    console.error('Usage: skills-manager install <skill-id> [<skill-id-2> ...]');
    return;
  }
  const catalog = loadCatalog();
  console.log(`\n📥 Installing ${skillIds.length} skill(s)...`);
  for (const id of skillIds) {
    await installSingleSkill(id, catalog);
  }
  console.log('\nDone! Antigravity automatically detects changes in .agents/skills.\n');
}

function cmdRemove(skillIds) {
  if (!skillIds || skillIds.length === 0) {
    console.error('Usage: skills-manager remove <skill-id> [<skill-id-2> ...]');
    return;
  }
  console.log(`\n🗑️ Removing ${skillIds.length} skill(s)...`);
  for (const id of skillIds) {
    const dest = path.join(SKILLS_DIR, id);
    if (fs.existsSync(dest)) {
      fs.rmSync(dest, { recursive: true, force: true });
      console.log(`  - \x1b[31mRemoved ${id}\x1b[0m`);
    } else {
      console.log(`  - \x1b[33m${id}\x1b[0m was not installed.`);
    }
  }
  console.log('\nDone!\n');
}

async function cmdBundle(bundleName) {
  if (!bundleName || !BUNDLES[bundleName]) {
    console.log('\nAvailable Bundles:');
    for (const [name, skills] of Object.entries(BUNDLES)) {
      console.log(`  - \x1b[36m${name}\x1b[0m (${skills.length} skills): ${skills.join(', ')}`);
    }
    console.log('\nUsage: skills-manager bundle <bundle-name>\n');
    return;
  }
  
  const skills = BUNDLES[bundleName];
  console.log(`\n📦 Installing bundle: \x1b[36m${bundleName}\x1b[0m (${skills.length} skills)...`);
  await cmdInstall(skills);
}

function cmdCategories() {
  const catalog = loadCatalog();
  const counts = {};
  catalog.forEach(item => {
    const cat = item.category || 'uncategorized';
    counts[cat] = (counts[cat] || 0) + 1;
  });
  
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  console.log(`\n📚 Skill Categories (${sorted.length} total across ${catalog.length} skills):\n`);
  sorted.forEach(([cat, count]) => {
    console.log(`  - \x1b[36m${cat.padEnd(30)}\x1b[0m: ${count} skills`);
  });
  console.log('\nUse "skills-manager search <category-name>" to explore any category.\n');
}

function cmdHelp() {
  console.log(`
============================================================
 AAS Skills Manager for Antigravity & AI Coding Assistants
============================================================

Usage:
  node scripts/skills-manager.js <command> [arguments]

Commands:
  list                 List currently installed skills in .agents/skills/
  search <query>       Search all 2,465 skills in catalog by keyword
  info <skill-id>      Show full metadata and description for a skill
  install <id...>      Install one or more skills into .agents/skills/
  remove <id...>       Remove skill(s) from .agents/skills/
  bundle [name]        List or install pre-packaged skill bundles
  categories           List all 40+ skill categories and counts
  help                 Display this help guide

Examples:
  node scripts/skills-manager.js list
  node scripts/skills-manager.js search portfolio
  node scripts/skills-manager.js info 3d-web-experience
  node scripts/skills-manager.js install 3d-web-experience animejs-animation
  node scripts/skills-manager.js bundle web-app-builder
`);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'list';
  
  switch (command) {
    case 'list':
      await cmdList();
      break;
    case 'search':
      cmdSearch(args[1]);
      break;
    case 'info':
      cmdInfo(args[1]);
      break;
    case 'install':
      await cmdInstall(args.slice(1));
      break;
    case 'remove':
      cmdRemove(args.slice(1));
      break;
    case 'bundle':
      await cmdBundle(args[1]);
      break;
    case 'categories':
      cmdCategories();
      break;
    case 'help':
    case '--help':
    case '-h':
      cmdHelp();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      cmdHelp();
      process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
