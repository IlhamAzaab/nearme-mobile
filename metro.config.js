const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// For web, we might want to alias react-native-maps
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'react-native-maps') {
    return {
      filePath: path.resolve(__dirname, 'src/components/maps/WebMapMock.jsx'),
      type: 'sourceFile',
    };
  }
  
  // Chain to the standard resolver
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
