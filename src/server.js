const service = require('./services');
const server = require('../../utils/src/server');
const configuration = require('../../utils/src/configuration');

const port = configuration
    .serversConfiguration
    .manager
    .port;

const routes = {
        '/managerSignUp': (request, parameters) => service.insertManager(parameters),
        '/managerLogin': (request, parameters) => service.connectManager(parameters),
        '/managerLogout': (request, parameters) => service.disconnectManager(parameters.token),
        '/getManagerLogged': (request, parameters) => service.getManagerLogged(parameters.token),
        '/updateData': (request, parameters) => service.updateData(parameters),
        '/accountVerification': (request, parameters, res) => service.accountVerification(parameters.registrationToken)
            .then(path => server.serveStaticFile(path, res))
    }
;

const staticFiles = {
    '/test': __dirname + '/files/file.txt',
    '/': __dirname + '/front/index.html'
};

server.createServer(staticFiles, routes, port, [__dirname + "/front", __dirname + "/../../utils/src/front"]);