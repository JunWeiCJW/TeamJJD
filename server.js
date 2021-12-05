//Install node, version 14.17.6
//Install express. npm install express --save

const express = require('express');//Loads the module
const path = require("path");
const app = express();//Initiates it or something, maybe runs it.

//This is where we handle each of our routes
//req = request 'object', (request from the server)
//res = response 'object', (what we are sending back)
app.use(express.static(__dirname + '/public'));

app.get('/', (req,res) => {
  res.sendFile(__dirname + '/public/index.html')
})

app.get('/login', (req, res) => {
  res.sendFile(__dirname + '/public/login.html')
})


const port = 8000

//This starts the app and makes it listen on port 8000
app.listen(port, () =>{
    console.log(`Server listening on port ${port}`);
});
