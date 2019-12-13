const database = require('../../utils/src/mongo');
const http = require('http');
const querystring = require('querystring');
const fs = require('fs');
const server = require('../../utils/src/server');
const configuration = require('../../utils/src/configuration');

const DATABASE_NAME = 'greenleanelectrics';

exports.insertManager = function (data) {
    const databaseName = DATABASE_NAME;
    const collectionName = 'managers';
    console.log(data);
    var registrationToken = generateToken();
    data.registrationToken = registrationToken;

    return database.find(databaseName, collectionName, {"email": data.email})
        .then((results) => {
            if (results.length >= 1) {
                console.log("This email is already used.");
                return {error: "This email is already used."};
            } else {
                const url = `${configuration.serversConfiguration.prosumer.hostname}:${configuration.serversConfiguration.prosumer.port}`;
                server.sendEmail(
                    'no-reply@greenleanelectric.com',
                    data.email,
                    'Account Verification',//TODO Change url
                    `To activate your account click on the following link : <a href="http://${url}/accountVerification?registrationToken=${registrationToken}">Click Here</a>`
                );

                return database
                    .insertOne(databaseName, collectionName, data);
            }
        });

};

exports.accountVerification = function (registrationToken) {
    console.log(registrationToken);
    const databaseName = DATABASE_NAME;
    const collectionName = 'managers';
    const updateOperation = {$unset: {"registrationToken": ""}};

    return database
        .updateOne(databaseName, collectionName, {registrationToken}, updateOperation)
        .then((nModified) => {
            if (nModified !== 0) {
                console.log(`User activated'`);
                return __dirname + "/front/account-activation-success.html";
            } else {
                console.log(`User not found`);
                return __dirname + "/front/account-activation-failure.html";
            }
        });
};

exports.connectManager = function (data) {
    const databaseName = DATABASE_NAME;
    const collectionName = 'managers';

    return database.find(databaseName, collectionName, data)
        .then((results) => {
            if (results.length === 1) {
                return results[0];
            }
            return {};
        }).then((results) => {

            console.log(results);

            if (!Object.keys(results).length)
                return {error: "Login was unsuccessful, please check your email and password"};
            else if (results.hasOwnProperty("registrationToken"))
                return {error: "Account not activated, check your mailbox."};
            else {
                const token = generateToken();
                const updateOperation = {$set: {token}};

                return database
                    .updateOne(databaseName, collectionName, data, updateOperation)
                    .then((nModified) => {
                        if (nModified !== 0) {
                            console.log(`User connected with token '${token}'`);
                            return {token};
                        } else {
                            console.log(`User not found`);
                            return {};
                        }
                    });
            }
        });
};

exports.disconnectManager = function (token) {
    const databaseName = DATABASE_NAME;
    const collectionName = 'managers';
    const updateOperation = {$set: {token: null}};

    return database
        .updateOne(databaseName, collectionName, {token}, updateOperation)
        .then(() => {
            console.log(`User connected with token '${token}' has been disconnected`);
            return token;
        });
};

exports.deleteAccount = function (token) {
    const databaseName = DATABASE_NAME;
    const collectionName = 'managers';

    return database
        .deleteOne(databaseName, collectionName, {token})
        .then(() => {
            console.log(`User deleted.`);
            return true;
        });
};

exports.getManagerLogged = function (token) {
    const databaseName = DATABASE_NAME;
    const collectionName = 'managers';

    return database
        .find(databaseName, collectionName, {token})
        .then((results) => {
            if (results.length === 1) {
                delete results[0].password;
                delete results[0]._id;
                return results[0];
            }
            return {};
        });
};

exports.updateData = function (data) {
    const databaseName = DATABASE_NAME;
    const collectionName = 'managers';

    var token = data.token;
    delete data.token;

    var updateOperation;
    if (data.length > 1) {
        updateOperation = {
            $set: {
                data
            }
        };
    }
    else {
            updateOperation = {
                $set: data
            };
        }
    console.log(updateOperation);
    return database
        .updateOne(databaseName, collectionName, {token}, updateOperation)
        .then((nModified) => {
            if (nModified !== 0) {
                return true;
            } else {
                console.log(`User not found or data already with the same values`);
                return {};
            }
        });
};

exports.uploadManagerPicture = function (data, picturePath) {
    const databaseName = DATABASE_NAME;
    const collectionName = 'managers';

    const prosumer = {
        token: data.token
    };

    const extension = server.findExtension(picturePath);
    const newPath = configuration.uploadDirectory + new Date().getTime() + (
        extension
            ? '.' + extension
            : ''
    );

    return server.moveFile(picturePath, newPath)
        .then(() => database
            .updateOne(databaseName, collectionName, prosumer, {$set: {picture: newPath}})
            .then(() => server.readFile(newPath)));
};

exports.retrieveManagerPicturePath = function (token) {
    const databaseName = DATABASE_NAME;
    const collectionName = 'managers';

    return database
        .find(databaseName, collectionName, {token})
        .then((results) => {
            return results[0].picture;
        })
        .catch(() => {
            return undefined;
        });
};

exports.getCurrentMarketDemand = function (token) {
    const databaseName = DATABASE_NAME;
    const collectionName = 'managers';
    console.log(token);
    return database.find(databaseName, collectionName, {token})
        .then(results => {
            if (results.length === 1) {
                return results[0];
            }
            throw `No known manager with this token: ${token}`;
        }).then(() => {
            const collectionName = 'prosumers';

            const data = {"registrationToken": {"$exists": false}};
            return database
                .find(databaseName, collectionName, data)
                .then(prosumers => {
                    return Promise.all(
                        prosumers.map(
                            prosumer => Promise.all([
                                new Promise(resolve => resolve(prosumer)),
                                getElectricityConsumption(prosumer.email),
                                getElectricityProduction(prosumer.email)
                            ])
                        )
                    );
                })
                .then(values => {
                    return values
                        .map(([prosumer, consumption, production]) => computeDemand(prosumer, consumption, production))
                        .reduce((a, b) => a + b, 0);
                });
        });
};

function computeDemand(prosumer, consumption, production) {
    if (production >= consumption) {
        return 0;
    } else {
        if ((consumption - production) * prosumer.consumptionRatioBuffer <= prosumer.bufferFilling) {
            return (consumption - production) * prosumer.consumptionRatioMarket
        } else {
            return consumption - production - prosumer.bufferFilling;
        }
    }
}

exports.getProsumers = function (token) {
    const databaseName = DATABASE_NAME;
    var collectionName = 'managers';
    const manager = {
        token
    };

    return database
        .find(databaseName, collectionName, manager)
        .then((results) => {
            if (results.length > 0) {
                collectionName = 'prosumers';
                return database
                    .find(databaseName, collectionName, {})
                    .then((prosumers) => {
                        return Promise.all(
                            prosumers.map(
                                prosumer => Promise.all([
                                    new Promise(resolve => resolve(prosumer)),
                                    getElectricityConsumption(prosumer.email),
                                    getElectricityProduction(prosumer.email)
                                ])
                            )
                        );
                    }).then((values) => {console.log(values);
                        return values
                            .map(([prosumer, consumption, production]) => {
                                prosumer.consumption = consumption;
                                prosumer.production = production;
                                return prosumer;
                            });
                    });
            }
            return {};

        });
};

exports.blockProsumer = function(data){
    const databaseName = DATABASE_NAME;
    var collectionName = 'managers';

    const manager = {
        token: data.token
    };

    return database
        .find(databaseName, collectionName, manager)
        .then((results) => {
            if (results.length > 0) {
                collectionName = 'prosumers';
                return database
                    .find(databaseName, collectionName, {email: data.prosumerID})
                    .then((prosumer) => {console.log(prosumer[0].email);
                        var updateOperation = {
                                $set: {
                                    initBlockedTime : Date.now(),
                                    blockedTime : data.blockedTime
                                }
                            };
                        return database
                            .updateOne(databaseName, collectionName, {email: prosumer[0].email}, updateOperation)
                            .then((nModified) => {
                                if (nModified !== 0) {
                                    return true;
                                } else {
                                    console.log(`User not found or data already with the same values`);
                                    return {};
                                }
                            });

                    });
            }
        });
};

exports.setPowerPlantElectricityProduction = function (token, newProduction) {
    const databaseName = DATABASE_NAME;
    const collectionName = 'managers';
    return database
        .find(databaseName, collectionName, {token})
        .then(managers => managers[0])
        .then(manager => database.updateOne(databaseName, collectionName, manager, {
            $set:
                {
                    productionModificationTime: Date.now(),
                    newProduction,
                    powerPlantProduction: server.computeLinearFunction(
                        manager.powerPlantProduction || 0,
                        manager.newProduction || 0,
                        30,
                        (Date.now() - manager.productionModificationTime) / 1000
                    )
                }
        }))
        .then(count => {return {count}})
        .catch(e => {
            console.error(e);
            return undefined;
        });
};

/**
 * Create an option object representing the simulator server path.
 * @returns {{hostname: (string), port: string}}
 */
function getSimulatorHttpOptions() {
    const simulatorServer = require('../../utils/src/configuration')
        .serversConfiguration
        .simulator;

    return {
        hostname: simulatorServer.hostname,
        port: simulatorServer.port
    };
}

function getElectricityConsumption(prosumerId) {
    let options = Object.assign(getSimulatorHttpOptions(), {
        path: '/getElectricityConsumption?' + querystring.stringify({prosumerId}),
        method: 'GET'
    });

    return httpRequest(options).then(result => {
        return result.electricityConsumption;
    });
}

function getElectricityProduction(prosumerId) {
    let options = Object.assign(getSimulatorHttpOptions(), {
        path: '/getElectricityProduction?' + querystring.stringify({prosumerId}),
        method: 'GET'
    });

    return httpRequest(options).then(production => {
        return production;
    });
}

function generateToken() {
    const crypto = require("crypto");
    return crypto.randomBytes(16).toString("hex");
}

// TODO Centraliser dans utils
function httpRequest(options, postData) {
    return new Promise(function (resolve, reject) {
        const request = http.request(options, function (reply) {
            if (reply.statusCode < 200 || reply.statusCode >= 300) {
                return reject(new Error('status=' + reply.statusCode));
            }
            let body = [];
            reply.on('data', function (chunk) {
                body.push(chunk);
            });
            reply.on('end', function () {
                try {
                    body = JSON.parse(Buffer.concat(body).toString());
                } catch (error) {
                    reject(error);
                }
                resolve(body);
            });
        });
        request.on('error', function (error) {
            reject(error);
        });
        if (postData) {
            request.write(postData);
        }
        request.end();
    });
}