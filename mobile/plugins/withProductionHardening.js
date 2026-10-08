// Production-only hardening of Info.plist (development builds keep what Metro and the dev client need).
// - No App Transport Security exceptions: Plumb talks to no server at all. NSAllowsLocalNetworking stays in
//   development builds only, where the app loads its code from Metro on the local network.
// - No URL scheme: Plumb handles no links, so nothing outside the app should be able to open it with arguments.
const { withInfoPlist } = require('expo/config-plugins');

module.exports = function withProductionHardening(config) {
  return withInfoPlist(config, cfg => {
    if (process.env.EAS_BUILD_PROFILE === 'production') {
      const ats = { ...(cfg.modResults.NSAppTransportSecurity ?? {}) };
      delete ats.NSAllowsLocalNetworking;
      ats.NSAllowsArbitraryLoads = false;
      cfg.modResults.NSAppTransportSecurity = ats;
      delete cfg.modResults.CFBundleURLTypes;
    }
    return cfg;
  });
};
