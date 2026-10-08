// Switches for features that carry risk outside the code (medical-device rules, encryption export rules). They're set
// when the app is built, not at run time: Tidemark has no server to flip them remotely, and that's deliberate.
// Turn one off for a build with EXPO_PUBLIC_DISABLE_MEDICATION=1 or EXPO_PUBLIC_DISABLE_PROTECTED_BACKUPS=1
// (in eas.json under the build profile's "env", or in front of the command). Each must be written out in full:
// Expo only fills in EXPO_PUBLIC_ values that appear literally in the code.
export const FEATURES = {
  /** The GLP-1 / medication log, dose reminders and dose history. Off hides it all; saved doses are kept. */
  medication: process.env.EXPO_PUBLIC_DISABLE_MEDICATION !== '1',
  /** Password-protected backups (the app's own encryption). Off exports plain backups only. */
  protectedBackups: process.env.EXPO_PUBLIC_DISABLE_PROTECTED_BACKUPS !== '1',
};
