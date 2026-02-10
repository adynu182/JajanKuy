// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Exclude the corrupt node_modules_old folder from Metro bundler
config.resolver.blockList = [
    /node_modules_old\/.*/,
];

module.exports = config;
