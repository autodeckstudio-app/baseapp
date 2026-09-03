const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// This is a pnpm workspace: node_modules entries are symlinks/junctions
// into a shared store, not flat copies. Metro's default config assumes a
// flat node_modules tree and does not resolve package "exports" subpaths
// (e.g. react/jsx-dev-runtime) through them without these two flags.
config.resolver.unstable_enableSymlinks = true;
config.resolver.unstable_enablePackageExports = true;

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
