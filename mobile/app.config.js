// app.json holds the config. This only adds the web base path when a build asks for it (the GitHub Pages deploy serves
// the app from /Tracker/), so the iPhone app and local development are unaffected.
module.exports = ({ config }) => (process.env.WEB_BASE_URL
  ? { ...config, experiments: { ...config.experiments, baseUrl: process.env.WEB_BASE_URL } }
  : config);
