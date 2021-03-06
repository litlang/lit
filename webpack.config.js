const webpack = require('webpack');
const path = require('path');

module.exports = {
  target: 'node',
  entry: {
    majordomo: './std/majordomo/majordomo.js',
    httpMatcher: './std/Http/httpMatcher.js'
  },
  output: {
    path: path.resolve('./std'),
    filename: './[name].bundle.js',
    library: 'strat-runtime',
    libraryTarget: 'umd'
  },
  optimization: {
    minimize: false
  },
  plugins: [
    new webpack.IgnorePlugin(/^strat$/g)
  ],
};
