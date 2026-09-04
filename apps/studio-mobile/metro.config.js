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

// The broad watchFolders/nodeModulesPaths above (needed so `@autodeck/*`
// workspace packages resolve) has a side effect: Metro can also see other
// apps' independently-versioned `react`/`react-dom` (e.g. admin-web pulls
// in Next.js, which resolves to `react@18.3.1`/`react-dom@18.3.1` that
// pnpm hoists into the shared store), bundling two React instances into
// one app and breaking hooks ("Invalid hook call" / "Cannot read
// properties of null (reading 'useState')"). `extraNodeModules` alone
// does not fix this — it is only a fallback Metro consults when normal
// resolution fails, and normal resolution here succeeds by finding the
// hoisted react@18.3.1 via nodeModulesPaths first. `resolveRequest` runs
// ahead of that and force-redirects `react`/`react-dom` and their
// subpaths (jsx-runtime, jsx-dev-runtime, react-dom/client, etc.) to this
// project's own copies, keeping them a singleton without narrowing
// workspace-wide resolution for `@autodeck/*` or anything else.
const defaultResolveRequest = config.resolver.resolveRequest;
const FORCED_SINGLETON_PACKAGES = ['react', 'react-dom'];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const forcedPackage = FORCED_SINGLETON_PACKAGES.find(
    (name) => moduleName === name || moduleName.startsWith(`${name}/`),
  );

  const resolve = defaultResolveRequest ?? context.resolveRequest;

  if (forcedPackage) {
    return resolve(context, path.join(projectRoot, 'node_modules', moduleName), platform);
  }

  return resolve(context, moduleName, platform);
};

module.exports = config;
