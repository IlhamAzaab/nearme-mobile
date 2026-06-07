const { withAndroidStyles } = require("@expo/config-plugins");

module.exports = function withAndroidSplashRemove(config) {
  return withAndroidStyles(config, (cfg) => {
    if (cfg.modResults.resources && cfg.modResults.resources.style) {
      cfg.modResults.resources.style.forEach((style) => {
        if (style.$.name === "Theme.App.SplashScreen" && style.item) {
          // Remove the windowSplashScreenAnimatedIcon item
          style.item = style.item.filter(
            (item) => item.$.name !== "windowSplashScreenAnimatedIcon"
          );
        }
      });
    }
    return cfg;
  });
};