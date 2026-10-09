// Production-only hardening of Info.plist (development builds keep what Metro and the dev client need).
// - No App Transport Security exceptions: Tidemark talks to no server at all. NSAllowsLocalNetworking stays in
//   development builds only, where the app loads its code from Metro on the local network.
// - No URL scheme: Tidemark handles no links, so nothing outside the app should be able to open it with arguments.
const { withInfoPlist } = require('expo/config-plugins');

module.exports = function withProductionHardening(config) {
  return withInfoPlist(config, cfg => {
    if (process.env.EAS_BUILD_PROFILE === 'production') {
      // Edit the existing object rather than replacing it: other plugins (expo-widgets) can hold on to it and write it back
      const ats = cfg.modResults.NSAppTransportSecurity ?? (cfg.modResults.NSAppTransportSecurity = {});
      delete ats.NSAllowsLocalNetworking;
      ats.NSAllowsArbitraryLoads = false;
      delete cfg.modResults.CFBundleURLTypes;
    }
    return cfg;
  });
};
