const fs = require('fs');
const codes = require('./httpCodes.js');
const HandleBars = require('handlebars');
const globData = require('./data.js');
const responses = require('./responses.js');
const randomStr = require('randomstring');
const db = require('./db/db.js');
const webSock = require('./webSockets.js');
const bcrypt = require('bcryptjs');

//SHA-1 encoding
const crypto = require('crypto');

module.exports = async function mainHandler(dataDict, routeString, clientSock){
    var route = "";

    //Handle special cases
    if(routeString.includes("image/")) route = '/image';
    else if(routeString.includes("images?")) route = '/images';
    else if(routeString.includes(".js")) route = 'javascriptFile';
    else if(routeString.includes(".css")) route = 'cssFile';
    else{route = routeString;}

    console.log("Request received! Route = " + routeString);
    switch (route) {
        case 'javascriptFile':
            var fileStream;
            try{
                filestream = fs.readFileSync(routeString.slice(1, routeString.length), "utf8");//Slice away the first forward slash
            }catch{return responses.sendErr("Requested CSS file not available")}
            var respDict = {};
            respDict["Header"] = codes[200];
            respDict["Content-Length: "] = fileStream.length;
            respDict["Content-Type: "] = "text/javascript";
            respDict["X-Content-Type-Options: "] = "nosniff";

            respDict["data"] = fileStream.toString();
            return respond(respDict);
        case 'cssFile':
            var fileStream;
            try{
                fileStream = fs.readFileSync(routeString.slice(1, routeString.length), "utf8");//Slice away the first forward slash
            }catch{return responses.sendErr("Requested CSS file not available")}

            var respDict = {};
            respDict["Header"] = codes[200];
            respDict["Content-Length: "] = fileStream.length;
            respDict["Content-Type: "] = "text/css";
            respDict["X-Content-Type-Options: "] = "nosniff";

            respDict["data"] = fileStream.toString();
            return respond(respDict);
        case '/image':
            // //Is it malicious?
            if(routeString.split("image").slice(1).includes('/') || routeString.split("image").slice(1).includes('~')){
                return responses.sendErr();
            }
            var fileStream;
            try{
                fileStream = fs.readFileSync(routeString.slice(1), null);//Slice to get rid of /
            }catch{ return responses.sendErr("Requested image is not available")};
            //HEADERS
            var respDict = {};
            respDict["Header"] = codes[200];
            respDict["Content-Length: "] = fileStream.length;
            respDict["Content-Type: "] = "image/jpeg";
            respDict["X-Content-Type-Options: "] = "nosniff";
            respDict["data"] = fileStream;

            return respond(respDict);
        case '/auth':
            if("Cookie" in dataDict){
                var cookieDict = parseCookie(dataDict["Cookie"]);
                var cookieKey = cookieDict["id"];
                const userRows = await db.fetchUsers();
                if(userRows.length != 0){
                    for(let i = 0; i < userRows.length; i++){
                        var rowDict = userRows[i];
                        if(bcrypt.compareSync(cookieKey, rowDict.token)){
                            var dbUsername = rowDict.username;
                            var authDict = {};
                            authDict.username = `${dbUsername}`;
                            return loadAuth(authDict);
                        }
                    }
                }
                console.log("No authenticated cookie!")
            }else{
                console.log("No cookie stored yet");
            }
            return responses.needLogin();
        case '/':
            if("Cookie" in dataDict){
                var cookieDict = parseCookie(dataDict["Cookie"]);
                var cookieKey = cookieDict["id"];
                const userRows = await db.fetchUsers();
                if(userRows.length != 0){
                    for(let i = 0; i < userRows.length; i++){
                        var rowDict = userRows[i];
                        if(bcrypt.compareSync(cookieKey, rowDict.token)){
                            var dbUsername = rowDict.username;
                            var authDict = {};
                            authDict.auth = `Welcome back ${dbUsername}`;
                            return loadLogin(authDict, dataDict);
                        }
                    }
                }
                console.log("No authenticated cookie!")
            }else{
                console.log("No cookie stored yet");
            }
            return loadLogin({}, dataDict);
        case '/loginFail':
            var msgDict = {};
            msgDict.login = "You failed to login, please check username and password";
            return loadLogin(msgDict, dataDict)
        case '/loginSuccess':
            var msgDict = {};
            msgDict.login = "Successfully logged in!";
            return loadLogin(msgDict, dataDict)
        case '/registerFail':
            var msgDict = {};
            msgDict.register = "Incorrect password, please check requirements!";
            return loadLogin(msgDict, dataDict)
        case './regSameUser':
            var msgDict = {};
            msgDict.register = "Username exists! Please login, or choose a different username";
            return loadLogin(msgDict, dataDict)
        case '/websocket':
            var respDict = {};
            respDict["Header"] = codes[101];
            respDict["Upgrade: "] = "websocket";
            respDict["Connection: "] = "upgrade";
            //COMPUTE HASH
            var shasum = crypto.createHash('sha1');
            var webKey = dataDict["Sec-WebSocket-Key"].trim() + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
            var hashedKey = shasum.update(webKey).digest('base64');

            globData.clients.push(dataDict["client"]);//Save client upgrade
            respDict["Sec-WebSocket-Accept: "] = hashedKey;

            sendallChat(clientSock)//NEED TO CHANGE TO SEND ALL INFO
            return respond(respDict);
        case '/homepage':
            return loadHomePage(dataDict);
        default:
            console.log(`Path not found! ${route}`);
            return responses.sendErr();
    }
}

function respond(responseProp) {
    var responseString = "";
    // this is implicitly dependent on iteration order so it's pretty brittle
    for(let key in responseProp){
        if(key == "Header") responseString += responseProp[key];
        else if(key == "data") continue;
        //Add cookies
        else if(key == "cookie"){
            var cookieList = responseProp[key].split(":");
            for(let i = 0; i < cookieList.length; i++){
                var cookieValue = cookieList[i];
                responseString += ("Set-Cookie: " + cookieValue);
                responseString += "; Max-Age: 3600; Secure; HttpOnly ";//Set timeout val, also add delimiter, HTTPS
                if(i+1 != cookieList.length) responseString += "\r\n";//Adds delimiter if not last elem
            }
        }
        //Add cookies
        else responseString += (key + responseProp[key]);
        responseString += "\r\n";//Add newline seperator
    }
    responseString += "\r\n";//For data
    var strBuff = Buffer.from(responseString);
    //Is data present?
    try{
        var dataBuff = Buffer.from(responseProp["data"]);
        var fullArr = [strBuff, dataBuff];
        var fullRespBuff = Buffer.concat(fullArr);
        return fullRespBuff;
    }catch{
        console.log("Data not present in request!\n");
        return responseString;
    }
}

async function sendallChat(clientSock){
    var allChatMsg = await db.getAllChatMsg();
    allChatMsg.forEach(row =>{
        var dict = {};
        dict["username"] = row.username;
        dict["comment"] = row.comment;
        var formattedMsg = JSON.stringify(dict);
        var webSockRes = webSock.buildResponse(formattedMsg);
        clientSock.write(webSockRes);
    })
}

function parseCookie(cookie){
    var cookieDict = {};
    var cookieList = cookie.split(";");
    for(let i = 0; i < cookieList.length; i++){
        var cookieValue = cookieList[i];
        var [key, val] = cookieValue.split("=");
        key = key.trim();
        val = val.trim();
        cookieDict[key] = val;
    }
    return cookieDict;
}

function getCookieVal(cookie){
    for(let i = 0; i < globData.cookiesVisits.length; i++){
        var keyVal = globData.cookiesVisits[i];
        if(keyVal.cookieId == cookie){
            globData.cookiesVisits[i].visitCount += 1;
            return keyVal
        }
    }
    return;
}

//Loads the homepage with additional info as dictionaries to be displayed in handlebars
//Used to send the error messages for the login and register pages
function loadLogin(msgDict, dataDict){
    var xsrfToken = randomStr.generate();
    globData.xsrfToken = xsrfToken;

    var respDict = {};
    respDict["Header"] = codes[200];
    respDict["Content-Type: "] = "text/html";
    respDict["X-Content-Type-Options: "] = "nosniff";

    //Handle cookies here
    if("Cookie" in dataDict){

    }else{
    }

    var templateDict1 = Object.assign({}, globData, msgDict);

    var fileStream = fs.readFileSync('index.html', "utf8");
    const templateHTML1 = fileStream.toString();
    const templateFun1 = HandleBars.compile(templateHTML1);
    var data = templateFun1(templateDict1);

    respDict["Content-Length: "] = data.length;
    respDict["data"] = data;

    return respond(respDict);
}

function loadAuth(valDict){
    var respDict = {};
    respDict["Header"] = codes[200];
    respDict["Content-Type: "] = "text/html";
    respDict["X-Content-Type-Options: "] = "nosniff";

    var fileStream = fs.readFileSync('auth.html', "utf8");
    const templateHTML = fileStream.toString();
    const templateFun = HandleBars.compile(templateHTML);
    var data = templateFun(valDict);

    respDict["Content-Length: "] = data.length;
    respDict["data"] = data;

    return respond(respDict);
}

function loadHomePage(msgDict, dataDict){

}