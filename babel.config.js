module.exports = function (api) {
  const isTest = api.env('test');

  if (isTest) {
    api.cache.using(() => 'test');
    return {
      presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
    };
  }

  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
