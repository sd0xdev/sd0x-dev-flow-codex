'use strict';
exports.normalizeOptions = (options = {}) => ({ timeout: options.timeout ?? 3000 });
