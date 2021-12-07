const fs = require('fs');
const codes = require('./httpCodes.js');
const HandleBars = require('handlebars');
const sec = require('./secuirity.js');
const globData = require('./data.js');
const responses = require('./responses.js');
const bcrypt = require('bcryptjs');
const db = require('./db/db.js');

module.exports = async function mainHandler(request, route) {
    var parsedDict = reqToDicts(request);
    var headers = parsedDict[0];
    var data = parsedDict[1];

    var cookieKey = "";
    if ("Cookie" in headers) {
        var cookieDict = parseCookie(headers["Cookie"]);
        cookieKey = cookieDict["id"];
    }

    //Token verification
    if (headers == null && data == null) {
        return responses.sendForbidden();
    }
    switch (route) {
        case "/comment":
            var name = data["username"];
            var comment = data["comment"];
            var dict = {};
            dict.username = name;
            dict.comment = comment;
            globData.comments.push(dict);
            return responses.sendRedirect('./');
        case "/image-upload":
            var img = data["filename"];
            //Save image
            var imgRawData = data["upload"];
            fs.writeFileSync(`image/${img}`, imgRawData);
            var caption = data["caption"];
            var dict = {};
            dict.img = `image/${img}`;//Store the route
            dict.caption = caption;
            globData.images.push(dict);
            return responses.sendRedirect('./');
        case "/register":
            var regData = getAsciiData(request);
            var regDict = parseUserForm(regData);

            var username = regDict['username'];
            var password = regDict['password'];
            if(verifyPassword(password)){
                regUser(username, password, cookieKey);
                return responses.sendRedirect('./');
            }else{
                console.log("Register failed");
                return responses.sendRedirect('/registerFail');
            }
        case "/login":
            var regData = getAsciiData(request);
            var regDict = parseUserForm(regData);

            var username = regDict['username'];
            var password = regDict['password'];

            const loggedIn = await verifyUser(username, password, cookieKey);
            if(loggedIn){
                var hashedCookie = bcrypt.hashSync(cookieKey);
                db.updateCookie(username, hashedCookie);
                return responses.sendRedirect("./loginSuccess");
            }
            else{
                return responses.sendRedirect("./loginFail");
            }
        default:
            responses.sendErr();
    }
    return null;
}



function parseUserForm(dataString) {
    var dataList = dataString.split("&");
    var returnDict = {};
    dataList.forEach(value => {
        var [key, val] = value.split("=");
        returnDict[key] = val;
    })
    return returnDict;
}

function reqToDicts(request) {
    var [headerBuf, reqBuf] = splitBufferTwo("\r\n\r\n", request);//headers and data in 2 buffers
    //2 Dicts to return to post route handler
    var headerParsed = headerBuf.toString("utf8");
    var headersDict = parseHeaders(headerParsed);
    var dataDict = {};
    //End return structs

    //STOP HERE IF BUFFERING

    //Split based off boundary
    var boundary = headersDict["Content-Type"].split("boundary=")[1];
    var dataSegments = splitBufferList((`--${boundary}`), reqBuf);

    //Parse each data Segment
    for (let i = 0; i < dataSegments.length; i++) {
        var segment = dataSegments[i];
        //Split into headers and data
        var [headerUnparsed, segDataBuf] = splitBufferTwo(("\r\n\r\n"), segment);//headers and data in 2 buffers
        var segHeadersBuf = headerUnparsed.toString("utf8");
        var segHeaderDict = parseHeaders(segHeadersBuf);
        var contentDispDict = parseContentDisposition(segHeaderDict["Content-Disposition"]);//Dictionary for the content-disposition field
        if (contentDispDict.name == "xsrf_token") {
            var parsedToken = segDataBuf.toString("utf8");
            if (!sec.verifyToken(parsedToken.trim())) return [null, null];
            else console.log("Token Verified!!!");
        }
        if (typeof (segHeaderDict["Content-Type"]) != "undefined") {
            dataDict.filename = contentDispDict.filename
            dataDict[contentDispDict.name] = segDataBuf;
            console.log(dataDict[contentDispDict.name]);
        } else {
            var parsedData = segDataBuf.toString("utf8");
            dataDict[contentDispDict.name] = sec.escapeHtml(parsedData.trim());
        }
    }
    return [headersDict, dataDict];//Return both dicts
}

//HELPER FUNCTIONS

function splitBufferTwo(strToSplit, buffer) {
    //Convert strToSplit to bytes
    var byteStr = Buffer.from(strToSplit);
    //Find index where it is
    var indexToSplit = buffer.indexOf(byteStr);
    //return 2 buffers
    return [buffer.slice(0, indexToSplit), buffer.slice(indexToSplit + (byteStr.length))]
}

function splitBufferList(strToSplit, buffer) {
    //Convert strToSplit to bytes
    var byteStr = Buffer.from(strToSplit);
    //List to store all parts of the buffer split by param
    var listRes = [];
    //Buffer var to check over
    var tempBuf = buffer;
    //Find index where it is
    var indexToSplit = tempBuf.indexOf(byteStr);
    //While the value exists
    while (indexToSplit != -1) {
        listRes.push(tempBuf.slice(0, indexToSplit));//Add buffer segment
        tempBuf = tempBuf.slice(indexToSplit + (byteStr.length));//Set new buffer to loop
        indexToSplit = tempBuf.indexOf(byteStr);//Set new index of bytestr
    }
    listRes = listRes.slice(1)//Pop the empty buffer, since it starts with delimiter
    //return list of buffer segments
    return listRes;
}

function parseHeaders(headerBuf) {
    //----Parse Headers----
    var headersArr = headerBuf.split("\r\n").slice(1);
    var headersDict = {};
    headersArr.forEach(function (keyVal) {
        var [key, val] = [keyVal.slice(0, keyVal.indexOf(':')), keyVal.slice(keyVal.indexOf(':') + 1)];//Map the key and values based off :
        headersDict[key] = val;
    });
    //----Parse Headers----END
    return headersDict;
}

function parseContentDisposition(strValue) {
    //Return a dict of the values
    var resDict = {};
    //Split by ;
    var tempList = strValue.split(";");
    //Parse each item based off what we are looking for into a dict if it exists
    tempList.forEach(function (segment) {
        if (segment.includes(" name=")) {
            resDict.name = sec.escapeHtml(segment.split("name=")[1].trim().replace(/['"]+/g, ''));
        }
        else if (segment.includes("filename=")) {
            resDict.filename = sec.escapeHtml(segment.split("filename=")[1].trim().replace(/['"]+/g, ''));
        } else { return }
    })
    return resDict;
}

function getAsciiData(dataBuf) {
    var [headers, data] = splitBufferTwo(("\r\n\r\n"), dataBuf);
    var dataString = data.toString();
    return dataString;
}

async function hashPw(password) {
    const salt = await bcrypt.genSalt(10);
    const hashedReturnVal = await new Promise((resolve, reject) => {
        bcrypt.hash(password, salt, function (err, result) {
            if (err) reject(result);
            resolve(result);
        });
    })
    return hashedReturnVal;
}

async function regUser(username, password) {
    const hashedPassword = await hashPw(password);
    const userRows = await db.getUser(username);
    if (userRows.length != 0) {
        console.log("User already exists!");
        //Do something here
    } else {
        db.registerUser(username, hashedPassword);
    }
}

async function verifyUser(username, password, cookieKey) {

    const user = await db.getUser(username);
    if(user.length != 1){
        //conn.write(responses.sendRedirect("./loginFail"));
        console.log("No users found! Login failed")
        updateCookieLogin(cookieKey, "Login unSuccessful!");
        return;
    }
    var dbPassword = user[0].password;
    return bcrypt.compareSync(password, dbPassword)
}

function verifyPassword(password) {
    var specialCharRegex = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/;//Regex for all special character
    var upperCaseRegex = /[A-Z]/;
    var lowerCaseRegex = /[a-z]/;
    var numberRegex = /[\d]/

    var droppedFirstChar = password.slice(1, password.length);

    if (!password.length >= 8) {
        return false;
    }

    if (!upperCaseRegex.test(droppedFirstChar)) {
        return false;
    }

    if (!lowerCaseRegex.test(password)) {
        return false;
    }

    if (!specialCharRegex.test(password)) {
        return false;
    }

    if (!numberRegex.test(password)) {
        return false;
    }

    return true;
}


function updateCookieLogin(cookie, msg) {
    for (let i = 0; i < globData.cookiesVisits.length; i++) {
        var keyVal = globData.cookiesVisits[i];
        if (keyVal.cookieId == cookie) {
            globData.cookiesVisits[i].login = msg;
            return;
        }
    }
    return;
}

function parseCookie(cookie) {
    var cookieDict = {};
    var cookieList = cookie.split(";");
    for (let i = 0; i < cookieList.length; i++) {
        var cookieValue = cookieList[i];
        var [key, val] = cookieValue.split("=");
        key = key.trim();
        val = val.trim();
        cookieDict[key] = val;
    }
    return cookieDict;
}

async function authUser(username, cookieKey){

}