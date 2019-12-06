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
        '/uploadPicture': (_, [parameters, picturePath]) => service.uploadManagerPicture(parameters, picturePath), //TODO pu in utils ? common for prosuemr and manager
        '/retrievePicture': (request, parameters, res) => service.retrieveManagerPicturePath(parameters.token) //TODO same
            .then(path => server.serveStaticFile(path, res)),
        '/accountVerification': (request, parameters, res) => service.accountVerification(parameters.registrationToken)
            .then(path => server.serveStaticFile(path, res)),
        '/deleteAccount': (request, parameters) => service.deleteAccount(parameters.token)
    }
;

const staticFiles = {
    '/test': __dirname + '/files/file.txt',
    '/': __dirname + '/front/index.html'
};

server.createServer(staticFiles, routes, port, [__dirname + "/front", __dirname + "/../../utils/src/front"]);