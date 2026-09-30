const path = require('node:path')

// The platform's default jest config isn't in the package's export map,
// so resolve it relative to the package entry point.
const defaults = require(
    path.join(
        path.dirname(require.resolve('@dhis2/cli-app-scripts')),
        '../config/jest.config.js'
    )
)

module.exports = {
    ...defaults,
    // Resolve the '@/' import alias (see viteConfigExtensions.mts)
    moduleNameMapper: {
        ...defaults.moduleNameMapper,
        '^@/(.*)$': '<rootDir>/src/$1',
    },
}
