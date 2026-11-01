const createMerge = require("@fastify/deepmerge")

// addons-linter uses deepmerge's arrayMerge hook for schema patches. Adapt that
// hook to Fastify's maintained merge implementation, which rejects __proto__.
module.exports = function merge(target, source, options = {}) {
  return createMerge({
    symbols: true,
    ...(options.isMergeableObject && {
      isMergeableObject: options.isMergeableObject
    }),
    ...(options.arrayMerge && {
      mergeArray:
        ({ clone, isMergeableObject }) =>
        (left, right) =>
          options.arrayMerge(left, right, {
            ...options,
            isMergeableObject,
            cloneUnlessOtherwiseSpecified: clone
          })
    })
  })(target, source)
}
