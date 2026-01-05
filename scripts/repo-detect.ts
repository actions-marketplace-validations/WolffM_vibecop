/**
 * Repo Detection Module
 *
 * Inspects the target repository to build a RepoProfile used for
 * automatic tool enablement decisions.
 *
 * Reference: vibeCop_spec.md section 5.3
 */

import { existsSync, readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Language, PackageManager, RepoProfile } from './types.js';

/**
 * Detect the package manager based on lockfile presence
 */
function detectPackageManager(rootPath: string): PackageManager {
  if (existsSync(join(rootPath, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(rootPath, 'bun.lockb')) || existsSync(join(rootPath, 'bun.lock'))) return 'bun';
  if (existsSync(join(rootPath, 'yarn.lock'))) return 'yarn';
  if (existsSync(join(rootPath, 'package-lock.json'))) return 'npm';
  if (existsSync(join(rootPath, 'package.json'))) return 'npm'; // default if package.json exists
  return 'unknown';
}

/**
 * Detect programming languages present in the repo
 */
function detectLanguages(rootPath: string): Language[] {
  const languages: Language[] = [];

  // TypeScript detection
  const hasTsConfig =
    existsSync(join(rootPath, 'tsconfig.json')) ||
    existsSync(join(rootPath, 'tsconfig.base.json'));

  // Check package.json for typescript dependency
  let hasTypescriptDep = false;
  const packageJsonPath = join(rootPath, 'package.json');
  if (existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      hasTypescriptDep =
        pkg.devDependencies?.typescript ||
        pkg.dependencies?.typescript ||
        false;
    } catch {
      // ignore parse errors
    }
  }

  if (hasTsConfig || hasTypescriptDep) {
    languages.push('typescript');
  }

  // JavaScript detection (if package.json exists but no TypeScript)
  if (existsSync(packageJsonPath) && !languages.includes('typescript')) {
    languages.push('javascript');
  }

  // Python detection
  if (
    existsSync(join(rootPath, 'pyproject.toml')) ||
    existsSync(join(rootPath, 'setup.py')) ||
    existsSync(join(rootPath, 'requirements.txt')) ||
    existsSync(join(rootPath, 'Pipfile'))
  ) {
    languages.push('python');
  }

  // Go detection
  if (existsSync(join(rootPath, 'go.mod')) || existsSync(join(rootPath, 'go.sum'))) {
    languages.push('go');
  }

  // Rust detection
  if (existsSync(join(rootPath, 'Cargo.toml'))) {
    languages.push('rust');
  }

  // Java detection
  if (
    existsSync(join(rootPath, 'pom.xml')) ||
    existsSync(join(rootPath, 'build.gradle')) ||
    existsSync(join(rootPath, 'build.gradle.kts'))
  ) {
    languages.push('java');
  }

  return languages.length > 0 ? languages : ['other'];
}

/**
 * Detect if the repo is a monorepo and find workspace packages
 */
async function detectMonorepo(rootPath: string): Promise<{
  isMonorepo: boolean;
  workspacePackages: string[];
}> {
  const workspacePackages: string[] = [];

  // Check for pnpm workspace
  if (existsSync(join(rootPath, 'pnpm-workspace.yaml'))) {
    // Parse pnpm-workspace.yaml for package patterns
    try {
      const content = readFileSync(join(rootPath, 'pnpm-workspace.yaml'), 'utf-8');
      // Simple pattern extraction (packages: - 'apps/*' - 'packages/*')
      const matches = content.match(/['"]([^'"]+)['"]/g);
      if (matches) {
        for (const match of matches) {
          const pattern = match.replace(/['"]/g, '').replace('/*', '');
          const fullPath = join(rootPath, pattern);
          if (existsSync(fullPath)) {
            try {
              const dirs = await readdir(fullPath, { withFileTypes: true });
              for (const dir of dirs) {
                if (dir.isDirectory()) {
                  workspacePackages.push(join(pattern, dir.name));
                }
              }
            } catch {
              // directory doesn't exist or can't be read
            }
          }
        }
      }
    } catch {
      // ignore parse errors
    }
    return { isMonorepo: true, workspacePackages };
  }

  // Check for npm/yarn workspaces in package.json
  const packageJsonPath = join(rootPath, 'package.json');
  if (existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      if (pkg.workspaces) {
        const patterns = Array.isArray(pkg.workspaces)
          ? pkg.workspaces
          : pkg.workspaces.packages || [];

        for (const pattern of patterns) {
          const basePattern = pattern.replace('/*', '').replace('/**', '');
          const fullPath = join(rootPath, basePattern);
          if (existsSync(fullPath)) {
            try {
              const dirs = await readdir(fullPath, { withFileTypes: true });
              for (const dir of dirs) {
                if (dir.isDirectory()) {
                  workspacePackages.push(join(basePattern, dir.name));
                }
              }
            } catch {
              // directory doesn't exist or can't be read
            }
          }
        }

        if (patterns.length > 0) {
          return { isMonorepo: true, workspacePackages };
        }
      }
    } catch {
      // ignore parse errors
    }
  }

  // Check for Turborepo
  if (existsSync(join(rootPath, 'turbo.json'))) {
    // turbo.json usually implies monorepo
    return { isMonorepo: true, workspacePackages };
  }

  // Check for Lerna
  if (existsSync(join(rootPath, 'lerna.json'))) {
    return { isMonorepo: true, workspacePackages };
  }

  // Check for Nx
  if (existsSync(join(rootPath, 'nx.json'))) {
    // Check for apps/ and libs/ directories
    for (const dir of ['apps', 'libs', 'packages']) {
      const fullPath = join(rootPath, dir);
      if (existsSync(fullPath)) {
        try {
          const dirs = await readdir(fullPath, { withFileTypes: true });
          for (const d of dirs) {
            if (d.isDirectory()) {
              workspacePackages.push(join(dir, d.name));
            }
          }
        } catch {
          // ignore
        }
      }
    }
    return { isMonorepo: true, workspacePackages };
  }

  return { isMonorepo: false, workspacePackages: [] };
}

/**
 * Check for presence of various tool configurations
 */
function detectToolConfigs(rootPath: string): {
  hasEslint: boolean;
  hasPrettier: boolean;
  hasTrunk: boolean;
  hasDependencyCruiser: boolean;
  hasKnip: boolean;
} {
  // ESLint configs (multiple possible names)
  const eslintConfigs = [
    '.eslintrc',
    '.eslintrc.js',
    '.eslintrc.cjs',
    '.eslintrc.mjs',
    '.eslintrc.json',
    '.eslintrc.yml',
    '.eslintrc.yaml',
    'eslint.config.js',
    'eslint.config.mjs',
    'eslint.config.cjs',
  ];
  const hasEslint = eslintConfigs.some((config) => existsSync(join(rootPath, config)));

  // Prettier configs
  const prettierConfigs = [
    '.prettierrc',
    '.prettierrc.js',
    '.prettierrc.cjs',
    '.prettierrc.mjs',
    '.prettierrc.json',
    '.prettierrc.yml',
    '.prettierrc.yaml',
    '.prettierrc.toml',
    'prettier.config.js',
    'prettier.config.mjs',
    'prettier.config.cjs',
  ];
  const hasPrettier = prettierConfigs.some((config) => existsSync(join(rootPath, config)));

  // Trunk
  const hasTrunk = existsSync(join(rootPath, '.trunk', 'trunk.yaml'));

  // dependency-cruiser
  const depCruiserConfigs = [
    '.dependency-cruiser.js',
    '.dependency-cruiser.cjs',
    '.dependency-cruiser.mjs',
    '.dependency-cruiser.json',
  ];
  const hasDependencyCruiser = depCruiserConfigs.some((config) =>
    existsSync(join(rootPath, config))
  );

  // Knip
  const knipConfigs = [
    'knip.json',
    'knip.jsonc',
    '.knip.json',
    '.knip.jsonc',
    'knip.ts',
    'knip.js',
  ];
  const hasKnip = knipConfigs.some((config) => existsSync(join(rootPath, config)));

  return {
    hasEslint,
    hasPrettier,
    hasTrunk,
    hasDependencyCruiser,
    hasKnip,
  };
}

/**
 * Main detection function - builds complete RepoProfile
 */
export async function detectRepo(rootPath: string = process.cwd()): Promise<RepoProfile> {
  const resolvedPath = resolve(rootPath);

  const languages = detectLanguages(resolvedPath);
  const packageManager = detectPackageManager(resolvedPath);
  const { isMonorepo, workspacePackages } = await detectMonorepo(resolvedPath);
  const toolConfigs = detectToolConfigs(resolvedPath);

  return {
    languages,
    packageManager,
    isMonorepo,
    workspacePackages,
    hasTypeScript: languages.includes('typescript'),
    hasEslint: toolConfigs.hasEslint,
    hasPrettier: toolConfigs.hasPrettier,
    hasTrunk: toolConfigs.hasTrunk,
    hasDependencyCruiser: toolConfigs.hasDependencyCruiser,
    hasKnip: toolConfigs.hasKnip,
    rootPath: resolvedPath,
  };
}

/**
 * CLI entry point
 */
async function main() {
  const rootPath = process.argv[2] || process.cwd();
  const profile = await detectRepo(rootPath);
  console.log(JSON.stringify(profile, null, 2));
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
