const service = require('./services');
const server = require('../../utils/src/server');
const configuration = require('../../utils/src/configuration');

const port = configuration
    .serversConfiguration
    .manager
    .port;

const routes = {
        '/managerSignUp': (_, parameters) => service.insertManager(parameters),
        '/managerLogin': (_, parameters) => service.connectManager(parameters),
        '/managerLogout': (_, parameters) => service.disconnectManager(parameters.token),
        '/getManagerLogged': (_, parameters) => service.getManagerLogged(parameters.token),
        '/updateData': (_, parameters) => service.updateData(parameters),
        '/uploadPicture': (_, [parameters, picturePath]) => service.uploadManagerPicture(parameters, picturePath), //TODO put in utils ? common for prosuemr and manager
        '/retrievePicture': (_, parameters, res) => service.retrieveManagerPicturePath(parameters.token) //TODO same
            .then(path => server.serveStaticFile(path, res)),
        '/accountVerification': (_, parameters, res) => service.accountVerification(parameters.registrationToken)
            .then(path => server.serveStaticFile(path, res)),
        '/deleteAccount': (_, parameters) => service.deleteAccount(parameters.token),
        '/getCurrentMarketDemand': (_, parameters) => service.getCurrentMarketDemand(parameters.token),
        '/getProsumers':(_, parameters) => service.getProsumers(parameters.token),
        '/blockProsumer': (_, parameters) => service.blockProsumer(parameters),
        '/setPowerPlantElectricityProduction': (_, parameters) => service.setPowerPlantElectricityProduction(parameters.token, parameters.newProduction),
        '/getMarket': () => service.getMarket(),
        '/setNewPrice': (_, parameters) => service.setNewPrice(parameters.token, parameters.price)
    }
;

const staticFiles = {
    '/': __dirname + '/front/index.html'
};

server.createServer(staticFiles, routes, port, [__dirname + "/front", __dirname + "/../../utils/src/front"]);