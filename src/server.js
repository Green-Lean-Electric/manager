const server = require('../../utils/src/server.js');

const port = require('../../utils/src/configuration.js')
    .serversConfiguration
    .manager
    .port;

const routes = {};

const staticFiles = {};

server.createServer(staticFiles, routes, port);