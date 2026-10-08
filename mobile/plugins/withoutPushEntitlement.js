// Plumb only schedules local reminders, so it doesn't need the push-notification entitlement that
// expo-notifications adds. Removing it keeps the App Store capabilities honest (no push, no APNs setup).
const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = function withoutPushEntitlement(config) {
  if (config.ios?.entitlements) delete config.ios.entitlements['aps-environment'];
  return withEntitlementsPlist(config, cfg => {
    delete cfg.modResults['aps-environment'];
    return cfg;
  });
};
