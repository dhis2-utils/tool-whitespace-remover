/** @type {import('@dhis2/cli-app-scripts').D2Config} */
const config = {
    type: 'app',
    name: 'tool-whitespace-remover',
    title: 'Whitespace Remover Tool',
    description:
        'Finds and removes leading, trailing and double whitespace in metadata names, codes and descriptions',
    minDHIS2Version: '2.41',

    entryPoints: {
        app: './src/App.tsx',
    },

    viteConfigExtensions: './viteConfigExtensions.mts',
}

module.exports = config
