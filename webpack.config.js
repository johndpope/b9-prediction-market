var CopyWebpackPlugin = require('copy-webpack-plugin')

module.exports = {
    devtool: 'source-map',
    entry: {
        app: ['babel-polyfill', './app/index.js'],
    },
    output: {
        filename: 'bundle.js',
        path: __dirname + '/build'
    },
    plugins: [
        new CopyWebpackPlugin([
            { from: 'static' },
        ]),
    ],
    module: {
        rules: [
            {
                test: /\.json$/,
                use: {
                    loader: 'json-loader',
                },
            },
            {
                test: /\.js$/,
                exclude: /(node_modules|bower_components)/,
                use: {
                    loader: 'babel-loader',
                    // options: {
                    //     presets: ['env'],
                    //     // plugins: [require('babel-plugin-transform-object-rest-spread')]
                    // }
                }
            }
        ]
    }
}