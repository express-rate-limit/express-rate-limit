module.exports = {
    "extends": "eslint:recommended",
    "env": {
        "node": true
    },
    overrides: [{
        files: [ '*-test.js' ],
        env: {
            mocha: true,
        },
    }],
};