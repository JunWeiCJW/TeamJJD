const globData = require('./data.js');
const db = require('./db/db');
const bcrypt = require('bcryptjs');

function escapeHtml(inputToClean){
    var resultStr = inputToClean.replace(/&/g, '&amp;');;
    resultStr = resultStr.replace(/</g, '&lt;');
    resultStr = resultStr.replace(/>/g, '&gt;');
    return resultStr;
}

function verifyToken(tokenStr){
    var storedToken = globData.xsrfToken;
    if(storedToken == tokenStr) return true;
    else return false;
}

module.exports = {
    escapeHtml,
    verifyToken
};