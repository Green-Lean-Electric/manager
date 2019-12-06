const database = require('../../utils/src/mongo');
const http = require('http');
const querystring = require('querystring');
const fs = require('fs');
const server = require('../../utils/src/server');
const configuration = require('../../utils/src/configuration');

const DATABASE_NAME = 'greenleanelectrics';

function hashPassword(pwd) {
    var hash = 0;
    if (pwd.length === 0) return hash;
    for (i = 0; i < pwd.length; i++) {
        char = pwd.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
}

exports.insertManager = function (data) {
    const databaseName = DATABASE_NAME;
    const collectionName = 'managers';
    data.password = hashPassword(data.password);
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
    data.password = hashPassword(data.password);

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
    const prosumer = {
        token
    };
    const updateOperation = {$set: {token: null}};

    return database
        .updateOne(databaseName, collectionName, prosumer, updateOperation)
        .then(() => {
            console.log(`User connected with token '${token}' has been disconnected`);
            return token;
        });
};

exports.getManagerLogged = function (token) {
    const databaseName = DATABASE_NAME;
    const collectionName = 'managers';
    const prosumer = {
        token
    };

    return database
        .find(databaseName, collectionName, prosumer)
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
    if (data.length > 1)
        updateOperation = {
            $set: {
                data
            }
        };
    else
        updateOperation = {
            $set: data
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
    const prosumer = {
        token
    };

    return database
        .find(databaseName, collectionName, prosumer)
        .then((results) => {
            return results[0].picture;
        })
        .catch(() => {return undefined;});
};

function generateToken() {
    const crypto = require("crypto");
    return crypto.randomBytes(16).toString("hex");
}
