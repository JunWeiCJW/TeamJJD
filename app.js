//Install node, version 14.17.6
//Install express. npm install express --save

const express = require('express');//Loads the module
const app = express();//Initiates it or something, maybe runs it.

//This is where we handle each of our routes
//req = request 'object', (request from the server)
//res = response 'object', (what we are sending back)

//app,get == GET requests, app.post == POST requests
app.get('/', (req,res) => {
    res.send("Hello World");
})




//This starts the app and makes it listen on port 8000
const server = app.listen(8000, () =>{
    console.log(`Server listening on port ${server.address().port}`);
})

