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
    const registrationToken = generateToken();
    data.registrationToken = registrationToken;

    return database
        .find(databaseName, collectionName, {email: data.email})
        .then((results) => {
            if (results.length >= 1) {
                console.log("This email is already used.");
                return {error: "This email is already used."};
            } else {
                const url = `${configuration.serversConfiguration.prosumer.hostname}:${configuration.serversConfiguration.prosumer.port}`;
                server.sendEmail(
                    'no-reply@greenleanelectric.com',
                    data.email,
                    'Account Verification',
                    `To activate your account click on the following link : <a href="http://${url}/accountVerification?registrationToken=${registrationToken}">Click Here</a>`
                );

                database
                    .insertOne(databaseName, collectionName, data);
                return database
                    .find(databaseName, collectionName, {email: data.email})
                    .then((results) => {

                        return database.updateOne(
                            databaseName, 'powerPlants', {}, {'$push': {managers: results[0]._id}}
                        );
                    });
            }
        });
};

exports.accountVerification = function (registrationToken) {
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

exports.deleteProsumerAccount = function (token, email) {
    const databaseName = DATABASE_NAME;
    var collectionName = 'managers';

    return database.find(databaseName, collectionName, {token})
        .then((results) => {
            if (results.length === 1) {
                collectionName = 'prosumers';
                return database.deleteOne(databaseName, collectionName, {email})
                .then(() => {
                    console.log(`User deleted.`);
                    return true;
                });
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

exports.getManagerLogged = function (token) {
    const databaseName = DATABASE_NAME;
    const collectionName = 'managers';

    return database
        .find(databaseName, collectionName, {token})
        .then(managers => {
            if (managers.length === 1) {
                let manager = managers[0];
                return manager;
            }
            throw 'Unknown manager';
        })
        .then(manager => {
            return Promise.all([
                manager,
                getPowerPlant(manager._id)
            ]);
        })
        .then(([manager, powerPlant]) => {
            delete powerPlant.managers;
            delete powerPlant._id;
            manager.powerPlant = powerPlant;
            return manager;
        });
};

exports.updateCredentials = function (data) {
    const databaseName = DATABASE_NAME;
    const collectionName = 'managers';

    const token = data.token;
    delete data.token;

    let updateOperation = {
            $set: {
                firstname: data.firstname,
                lastname: data.lastname,
                email: data.email,
                password: data.password
            }
        };

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

exports.updateProsumerCredentials = function (data) {
    const databaseName = DATABASE_NAME;
    var collectionName = 'managers';

    const token = data.token;
    let updateOperation = {
            $set: {
                email: data.email,
                password: data.password
            }
        };

    return database.find(databaseName, collectionName, {token})
        .then((results) => {
            if (results.length === 1) {
                collectionName = 'prosumers';
                var email = data.oldemail;

                return database.updateOne(databaseName, collectionName, {email}, updateOperation)
                .then(() => {
                    console.log(`User credentials updated.`);
                    return true;
                });
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
            }
            throw 'Unknown manager';
        });
};

exports.blockProsumer = function (data) {
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
                    .then((prosumer) => {

                        var updateOperation = {
                            $set: {
                                initBlockedTime: Date.now(),
                                blockedTime: data.blockedTime
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

exports.setPowerPlantElectricityProduction = function (token, futureProduction, force) {
    const databaseName = DATABASE_NAME;
    return database
        .find(databaseName, 'managers', {token})
        .then(managers => managers[0])
        .then(manager => getPowerPlant(manager._id))
        .then(powerPlant => {
            const now = Date.now();
            let currentProduction;
            let oldProduction;
            let status;
            if (force) {
                currentProduction = futureProduction;
                oldProduction = futureProduction;
                status = futureProduction === 0
                    ? 0
                    : 2;
            } else {
                currentProduction = powerPlant.currentProduction;
                oldProduction = powerPlant.currentProduction;

                // If the old production is 0, the plant was stopped so it's now starting.
                // If the current production is 0, then the plant is stopped.
                // Otherwise it's running.
                status = powerPlant.oldProduction === 0 && futureProduction > 0
                    ? 1
                    : powerPlant.currentProduction === 0
                        ? 0
                        : 2;
            }
            return database.updateOne(databaseName, 'powerPlants', {
                _id: powerPlant._id
            }, {
                $set:
                    {
                        status,
                        productionModificationTime: now,
                        futureProduction,
                        oldProduction,
                        currentProduction
                    }
            });
        })
        .then(count => {
            return {count}
        })
        .catch(e => {
            console.error(e);
            return undefined;
        });
};

exports.getMarket = function () {
    return database.findLast(DATABASE_NAME, 'market', {}, 'date');
};

exports.setNewPrice = function (token, price) {
    return database
        .find(DATABASE_NAME, 'managers', {token})
        .then(managers => {
            if (managers.length === 1) {
                let manager = managers[0];
                delete manager.password;
                delete manager._id;
                return manager;
            }
            throw 'Unknown manager';
        }).then(() => {
            return database.findLast(DATABASE_NAME, 'market', {}, 'date')
                .then(market => {
                    const newMarket = {
                        electricity: market.electricity,
                        computedPrice: market.computedPrice,
                        actualPrice: price,
                        date: Date.now()
                    };
                    return database.insertOne(DATABASE_NAME, 'market', newMarket);
                })
        });
};

exports.setRatios = function (token, ratioBuffer, ratioMarket) {
    if (ratioBuffer < 0 || ratioBuffer > 1 || ratioMarket < 0 || ratioMarket > 1) {
        throw 'A ratio should be between 0 and 1';
    }
    if (ratioBuffer + ratioMarket !== 1) {
        throw 'The sum of the ratios should be 1.';
    }
    return database
        .find(DATABASE_NAME, 'managers', {token})
        .then(managers => managers[0])
        .then(manager => getPowerPlant(manager.email))
        .then(powerPlant => {
            return database.updateOne(DATABASE_NAME, 'powerPlants', {
                _id: powerPlant._id
            }, {
                $set:
                    {
                        productionRatioBuffer: ratioBuffer,
                        productionRatioMarket: ratioMarket
                    }
            });
        })
        .then(count => {
            return true;
        })
        .catch(e => {
            console.error(e);
            return undefined;
        });
};

function generateToken() {
    const crypto = require("crypto");
    return crypto.randomBytes(16).toString("hex");
}

function getPowerPlant(managerId) {
    return database.find(DATABASE_NAME, 'powerPlants', {
        managers: managerId
    }).then(powerPlants => powerPlants[0]);
}
