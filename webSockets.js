const fs = require('fs');
const codes = require('./httpCodes.js');
const HandleBars = require('handlebars');
const sec = require('./secuirity.js');
const globData = require('./data.js');
const responses = require('./responses.js');

const db = require('./db/db.js');

const xorBuffer = require('buffer-xor/inplace');
const data = require('./data.js');

const opcodeDict = {
    8: "closing",
    2: "binary",
    1: "text"
}

module.exports = {
    mainHandler,
    buildResponse
}
    async function mainHandler(data, client){
    var offSet = 0;//To track amount of bytes read until payload

    //IGNORE FIN and stuff(first 4 bits)

    //Get opcode
    var opCode = data[offSet] & ~240;//Shift 4 bits to get last 4 bits
    offSet += 1;
    console.log(`Opcode is ${opcodeDict[opCode]}`);

    //Is connection closing?
    if(opCode == 8){
        var connectionKey = getKeyFromDict(client);
        delete globData.clients[connectionKey];
        return -1;//NEED TO HANDLE THIS
    }

    //Mask bit? Payload len?
    var maskByte = data[offSet];
    offSet += 1;
    var maskBit = (maskByte & 128) >> 7;//AND it with 1 to get mask bit

    //Calculate Payload len
    var payloadLen = maskByte & ~128; //Get the 7 bits used for payloadLen
    if(payloadLen == 126){
        payloadLen = data.slice(offSet, 2 + offSet).readInt16BE(0)//Read next 2 bytes as payloadLen
        offSet += 2;
    }

    //Masking key?
    var maskingKey = data.slice(offSet, 4 + offSet);//Read next 4 bytes
    if(maskBit == 1){offSet+=4};
    var bytesRead = 0;
    var payloadBuf = Buffer.from([]);
    while(bytesRead != payloadLen){
        var curOffSet = offSet + bytesRead;
        var bytesBuf = Buffer.from([]);

        if(payloadLen - bytesRead < 4){bytesBuf = data.slice(curOffSet, data.length);//Read the end of the payload
        }else{bytesBuf = data.slice(curOffSet, 4 + curOffSet);//Read 4 bytes
        }

        if(maskBit == 1){
            var maskBuf = maskingKey.slice(0, bytesBuf.length);//Ensures you always mask with the bytes that you need
            bytesBuf = xorBuffer(bytesBuf, maskBuf);
        }
        payloadBuf = Buffer.concat([payloadBuf, bytesBuf]);
        bytesRead += bytesBuf.length;
    }
    
    console.log("Done parsing websocket frame! Starting to send...")

    var payloadStr = payloadBuf.toString();
    var dataObj = sec.escapeHtml(payloadStr);
    var dataDict = JSON.parse(dataObj);

    const likeCount = await iterateGetLikes(dataDict);
    dataDict.likes = likeCount;

    var dataobj1 = JSON.stringify(dataDict);

    if(likeCount != 0){//Should never be 0 like if there is like data
        return buildResponse(dataobj1);
    }else{
        return buildResponse(dataObj);//build without data
    }
}


function buildResponse(dataObj){
    var webSocketRes = Buffer.from([129])//ALWAYS SENDING TEXT OPCODE
    var dataObjBuf = Buffer.from(dataObj);

    //Payload calculate
    if(dataObjBuf.length >= 126){
        var payloadBuf = Buffer.from([126]);
        webSocketRes = Buffer.concat([webSocketRes, payloadBuf]);
    }
    if(dataObj.length >= 65536){
        //USE ALL 8 bytes, never done in hw so its ok
    }
    var payloadBuf = Buffer.from([dataObjBuf.length]);//Stores the data
    var zeroByte = Buffer.from([0]);
    //Make sure it takes 2 bytes
    if(payloadBuf.length == 1 && dataObjBuf.length >= 126){payloadBuf = Buffer.concat([zeroByte,payloadBuf])}//If the size is only 1 byte, append an empty one.
    
    webSocketRes = Buffer.concat([webSocketRes, payloadBuf]);

    return Buffer.concat([webSocketRes, dataObjBuf]);//Append payload
}

function getKeyFromDict(clientSock){
    for(const [key, value]of Object.entries(globData.clients)){
        if(clientSock == value){
            return key;
        }
    }
}

async function iterateGetLikes(dataDict){
//get like from db
//Iterate store into db
//send like over websocket

var id = Number(dataDict['chatID']);
const likeDict = await db.getLikesByID(id);
if(likeDict.length != 0){
    var likeCount = likeDict[0].likes + 1;
    db.updateLikesByID(id, likeCount);
    return likeCount;
}
return 0;

}