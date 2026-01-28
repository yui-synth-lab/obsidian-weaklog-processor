/**
 * Deploy script for Obsidian plugin development
 *
 * Copies built files (main.js, manifest.json, styles.css) to your Obsidian vault.
 *
 * Setup:
 * 1. Create a .env file in the project root
 * 2. Add: OBSIDIAN_PLUGIN_PATH=C:/path/to/vault/.obsidian/plugins/weaklog-processor
 * 3. Run: npm run deploy
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Parse .env file manually (avoiding external dependencies)
 */
function loadEnv() {
  const envPath = resolve(__dirname, '.env');

  if (!existsSync(envPath)) {
    console.error('❌ .env file not found!');
    console.log('\nCreate a .env file with:');
    console.log('OBSIDIAN_PLUGIN_PATH=C:/path/to/vault/.obsidian/plugins/weaklog-processor\n');
    process.exit(1);
  }

  const envContent = readFileSync(envPath, 'utf-8');
  const env = {};

  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim();
      }
    }
  }

  return env;
}

/**
 * Copy files to Obsidian plugin directory
 */
function deployToObsidian() {
  const env = loadEnv();
  const targetPath = env.OBSIDIAN_PLUGIN_PATH;

  if (!targetPath) {
    console.error('❌ OBSIDIAN_PLUGIN_PATH not set in .env file!');
    process.exit(1);
  }

  // Create target directory if it doesn't exist
  if (!existsSync(targetPath)) {
    console.log(`📁 Creating plugin directory: ${targetPath}`);
    mkdirSync(targetPath, { recursive: true });
  }

  // Files to copy
  const files = ['main.js', 'manifest.json', 'styles.css'];
  let successCount = 0;

  console.log('\n🚀 Deploying to Obsidian...\n');

  for (const file of files) {
    const sourcePath = resolve(__dirname, file);
    const targetFilePath = resolve(targetPath, file);

    if (!existsSync(sourcePath)) {
      console.error(`❌ Source file not found: ${file}`);
      console.log('   Run "npm run build" first!\n');
      process.exit(1);
    }

    try {
      copyFileSync(sourcePath, targetFilePath);
      console.log(`✓ Copied ${file}`);
      successCount++;
    } catch (error) {
      console.error(`✗ Failed to copy ${file}:`, error.message);
    }
  }

  if (successCount === files.length) {
    console.log(`\n✅ Successfully deployed ${successCount} files to Obsidian!`);
    console.log('   Press Ctrl+R (or Cmd+R on Mac) in Obsidian to reload.\n');
  } else {
    console.error(`\n⚠️  Only ${successCount}/${files.length} files deployed successfully.\n`);
    process.exit(1);
  }
}

// Run deployment
try {
  deployToObsidian();
} catch (error) {
  console.error('❌ Deployment failed:', error.message);
  process.exit(1);
}
