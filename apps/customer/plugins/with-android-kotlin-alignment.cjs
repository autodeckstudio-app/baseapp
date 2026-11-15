const { withProjectBuildGradle } = require('expo/config-plugins');

// Expo 53 uses Kotlin 2.0.21. Nitro Google 2.3.1 requests coroutines 1.11,
// which brings Kotlin 2.2 metadata. Keep this tested native stack bounded.
// This is dependency alignment, never a compiler metadata-check bypass.
const begin = '// @autodeck/kotlin-alignment begin';
const end = '// @autodeck/kotlin-alignment end';
const block = `${begin}
allprojects {
  configurations.configureEach {
    resolutionStrategy.eachDependency { details ->
      if (details.requested.group == 'org.jetbrains.kotlinx' && details.requested.name in ['kotlinx-coroutines-android', 'kotlinx-coroutines-core', 'kotlinx-coroutines-core-jvm', 'kotlinx-coroutines-play-services', 'kotlinx-coroutines-bom']) {
        details.useVersion '1.9.0'
        details.because 'AutoDeck Expo 53 Kotlin 2.0.21 native stack alignment'
      }
      if (details.requested.group == 'org.jetbrains.kotlin' && details.requested.name in ['kotlin-stdlib', 'kotlin-stdlib-common', 'kotlin-stdlib-jdk7', 'kotlin-stdlib-jdk8']) {
        details.useVersion '2.0.21'
        details.because 'Match the Expo 53 Kotlin compiler without skipping metadata checks'
      }
    }
  }
}
${end}`;

function align(contents) {
  const first = contents.indexOf(begin);
  if (first < 0) return `${contents.trimEnd()}\n\n${block}\n`;
  const last = contents.indexOf(end, first);
  if (last < 0) throw new Error('Incomplete AutoDeck Kotlin alignment block');
  return contents.slice(0, first) + block + contents.slice(last + end.length);
}
module.exports = function withAndroidKotlinAlignment(config) {
  return withProjectBuildGradle(config, config => {
    if (config.modResults.language !== 'groovy') throw new Error('AutoDeck alignment expects Groovy Gradle');
    config.modResults.contents = align(config.modResults.contents);
    return config;
  });
};
module.exports.align = align;
