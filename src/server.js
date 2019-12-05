const server = require('../../utils/src/server');

const port = require('../../utils/src/configuration')
    .serversConfiguration
    .manager
    .port;

const routes = {};

const staticFiles = {};

server.createServer(staticFiles, routes, port);