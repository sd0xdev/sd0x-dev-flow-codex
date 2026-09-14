'use strict';
exports.createCache = loader => {
  const values = new Map();
  return {
    get(key) {
      const cached = values.get(key);
      if (cached) return cached;
      const value = loader(key);
      values.set(key, value);
      return value;
    }
  };
};
