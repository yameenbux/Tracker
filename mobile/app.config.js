// app.json holds the config. This adjusts it per build:
// - the web base path when a build asks for it (the GitHub Pages deploy serves the app from a sub-path);
// - the export-compliance flag, which follows whether this build carries Tidemark's own encryption. Password-protected
//   backups use XChaCha20-Poly1305 and scrypt from @noble, standard algorithms that aren't Apple's, so Apple's table
//   says such a build is not "exempt": it needs a French encryption declaration if it's sold in France. A build made
//   with EXPO_PUBLIC_DISABLE_PROTECTED_BACKUPS=1 has no encryption of its own and is exempt.
module.exports = ({ config }) => {
  const ownCrypto = process.env.EXPO_PUBLIC_DISABLE_PROTECTED_BACKUPS !== '1';
  const ios = { ...config.ios, config: { ...config.ios?.config, usesNonExemptEncryption: ownCrypto } };
  const out = { ...config, ios };
  return process.env.WEB_BASE_URL ? { ...out, experiments: { ...config.experiments, baseUrl: process.env.WEB_BASE_URL } } : out;
};
