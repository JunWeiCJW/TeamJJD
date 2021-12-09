const net = require('net');
const getHandler = require('./handlerGet.js');
const postHandler = require('./handlerPost.js');
const globData = require('./data.js');
const webSocketHandler = require('./webSockets.js');
const db = require('./db/db.js');

var server = net.createServer(conn => {
    console.log("New connection made");

    conn.on('data', async function(data) {
        const clientID = conn.remoteAddress + ":" + conn.remotePort;
        var allClients = Object.values(globData.clients);
        console.log(`Client connected. ${clientID}`);

        //Does it need to buffer?
        if(globData.isBuffering ){
            //It is buffering, add data to the stored buffer
            globData.bufferData = Buffer.concat([globData.bufferData, data]);;
        }
        //Is it done buffering? If it is buffering
        if(globData.isBuffering && globData.bufferData.length == (globData.dataLength + globData.headerLength)){
            data = globData.bufferData;//Set the data to the one thats been buffering
            resetBuffer();//Reset global variables
        }
        //Is it a websocket user?
        if(allClients.includes(conn)){
            console.log("Websocket user detected!");
            console.log("Parsing websocket frame!");
            const webSocMsg = await webSocketHandler.mainHandler(data, conn);
            if(webSocMsg != -1){allClients.forEach(clientSocket => clientSocket.write(webSocMsg));}
        }
        //Is it still buffering?
        else if(!globData.isBuffering){
            var [dataDict,dataBuf] = getResponseHeaders("\r\n\r\n", data);
            dataDict["client"] = conn;
            //Should it buffer?
            if(dataDict["Content-Length"] != dataBuf.length && dataDict["Content-Length"] != undefined){
                //Set buffering variables
                globData.isBuffering = true;
                globData.bufferData = Buffer.concat([globData.bufferData, dataBuf]);
                globData.dataLength = parseInt(dataDict["Content-Length"]);
            }else{
                //Its not buffering, process request
                resetBuffer();//Reset global variables for next request
                var requestLine = dataDict["headers"].split(' ');
                var requestType = requestLine[0];//GET or POST?
                var route = requestLine[1];//The route to go to
                //console.log(data);
                if(requestType == "POST"){
                    var postReq = await postHandler(data,route);
                    conn.write(postReq);//Need to change I think
                }else{
                    var response = await getHandler(dataDict, route);
                    //console.log(response);
                    conn.write(response);
                }
            }
        }
    });

    conn.on('end', () =>{
        console.log("Client ended connection");
    })
});
server.listen(8000, function() {
    console.log('Server listening to %j', server.address());
});


function resetBuffer(){
    //Reset variables, global variables related to buffering
    globData.isBuffering = false;
    globData.dataLength = 0;
    globData.headerLength = 0;
    globData.bufferData = Buffer.from([]);
}


function getResponseHeaders(strToSplit, buffer){
    //Convert strToSplit to bytes
    var byteStr = Buffer.from(strToSplit);
    //Buffer var to check over
    var tempBuf = buffer;
    //Find index where it is
    var indexToSplit = tempBuf.indexOf(byteStr) + (byteStr.length);

    var slicedBuf = buffer.slice(0, indexToSplit);//Buffer containing header data
    //Add to global variable
    globData.headerLength = slicedBuf.length;//Set the global variable
    globData.bufferData = Buffer.concat([globData.bufferData, slicedBuf]);
    //Add to global variable

    var dataBuf = buffer.slice(indexToSplit);
    var stringBuf = slicedBuf.toString("utf8");
    //----Parse Headers----
    var fieldsArr = stringBuf.split("\r\n").slice(1);//All fields
    var fieldsDict = {};
    var header = stringBuf.split("\r\n").slice(0, 1)[0];
    fieldsDict["headers"] = header;
    fieldsArr.forEach(function(keyVal) {
        var [key,val] = [keyVal.slice(0, keyVal.indexOf(':')), keyVal.slice(keyVal.indexOf(':')+1)];//Map the key and values based off :
        fieldsDict[key] = val;
    });
    //----Parse Headers----END
    return [fieldsDict, dataBuf];
}

