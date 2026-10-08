// Production builds talk to no server at all, so they don't need any App Transport Security exception.
// NSAllowsLocalNetworking stays in development builds only, where the app loads its code from Metro on the local network.
const { withInfoPlist } = require('expo/config-plugins');

module.exports = function withProductionATS(config) {
  return withInfoPlist(config, cfg => {
    if (process.env.EAS_BUILD_PROFILE === 'production') {
      const ats = { ...(cfg.modResults.NSAppTransportSecurity ?? {}) };
      delete ats.NSAllowsLocalNetworking;
      ats.NSAllowsArbitraryLoads = false;
      cfg.modResults.NSAppTransportSecurity = ats;
    }
    return cfg;
  });
};
