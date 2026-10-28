/* global __dirname */
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Gradle rewrites these folders while a build runs; Metro's file watcher crashed on them
// (ENOENT) and took the dev server down mid-test.
config.resolver.blockList = [].concat(config.resolver.blockList ?? [], [
  /[\/]android[\/]build[\/].*/,
  /[\/]android[\/]\.cxx[\/].*/,
  /[\/]android[\/]app[\/]build[\/].*/,
  // The standalone web editors are separate projects with their own node_modules.
  /[\/]video-editor-web[\/].*/,
  /[\/]photo-editor-web[\/].*/,
]);

module.exports = config;
