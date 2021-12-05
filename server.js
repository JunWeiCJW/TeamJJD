//Install node, version 14.17.6
//Install express. npm install express --save

const express = require('express');//Loads the module
const path = require("path");
const bodyparser = require('body-parser');
var mongo = require('mongodb');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const app = express();//Initiates it or something, maybe runs it.
const port = 8000

//This is where we handle each of our routes
//req = request 'object', (request from the server)
//res = response 'object', (what we are sending back)
app.use(express.static(__dirname + '/public'));
app.use(bodyparser.urlencoded({extended:false}))
app.use(bodyparser.json())

// Create database
var MongoClient = require('mongodb').MongoClient;
var url = "mongodb://mongo:27017/";

MongoClient.connect(url, function(err, db) {
  if (err) throw err;
  var db_object = db.db("DB");
  db_object.createCollection("user_data", function(err, res) {
    if (err) throw err;
    db.close();
  });
})


app.get('/', (req,res) => {
  res.sendFile(__dirname + '/public/index.html')
})

app.get('/reg', (req, res) => {
  res.sendFile(__dirname + '/public/reg.html')
})

app.get('/login', (req, res) => {
  res.sendFile(__dirname + '/public/login.html')
})


app.post('/reg-form', (req, res) => {
  const username = req.body.username
  const pwd = req.body.password

  bcrypt.hash(pwd, saltRounds, function(err, hash) {
    const user_d = {"username": username, "password": hash}
    MongoClient.connect(url, function(err, db) {
      if (err) throw err;
      var db_object = db.db("DB");
      console.log(db_object)
      db_object.collection("user_data").insertOne(user_d, function(err, res) {
        if (err) throw err;
        console.log("insert")
        db.close();
      })
    })
  })
  res.redirect("/");
})

app.post('/login-form', (req, res) => {
  const username = req.body.username
  const pwd = req.body.password
})




//This starts the app and makes it listen on port 8000
app.listen(port, () =>{
    console.log(`Server listening on port ${port}`);
});
