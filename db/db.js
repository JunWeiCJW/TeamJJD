var mysql = require('@vlasky/mysql');
const { promisify } = require('util')

var con = mysql.createConnection({
    //host: "localhost",
    host:"mysql",
    port: "3306",
    user: "root",
    password: "codingisfun"
});

con.connect(function (err) {
    if (err) throw err;
    console.log("Connected to the database!");


    con.query("CREATE DATABASE IF NOT EXISTS cse312");
    console.log("Database created");

    //Set the database to use
    con.query("use cse312", function (err, result) {
        if (err) throw err;
        console.log("Database set to cse312");
    })

    con.query("CREATE TABLE IF NOT EXISTS chatmsg (id int NOT NULL AUTO_INCREMENT,username varchar(255) NOT NULL,comment varchar(255), PRIMARY KEY (id))", function (err, result) {
        if (err) throw err;
        console.log("Created table successfully");
    })

    con.query("CREATE TABLE IF NOT EXISTS users (id int NOT NULL AUTO_INCREMENT ,username varchar(255), password varchar(255), token varchar(255), PRIMARY KEY (id))", function (err, result) {
        if (err) throw err;
        console.log("Created table successfully");
    })
})

function addToChat(dataobj) {
    var obj = JSON.parse(dataobj);
    var username = obj.username;
    var msg = obj.comment;

    con.query(`INSERT INTO chatmsg (username, comment) VALUES ('${username}', '${msg}')`, function (err, result) {
        if (err) {
            console.log(`FAILED TO UPLOAD MSG TO DB, OBJECT ${dataobj}`);
        };
        console.log("Success uploading msg to db")
    });
}
function getAllChatMsg() {
    return new Promise((resolve, reject) => {
        con.query("SELECT username,comment FROM chatmsg ORDER BY id ASC", (err, result) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(result);
            }
        })
    })
}

function registerUser(username, password) {
    con.query(`INSERT INTO users (username, password) VALUES ('${username}', '${password}')`, function (err, result) {
        if (err) {
            console.log(`Failed to register user! Error: ${err}`);
        }
        else {
            console.log("Registered user!");
        }
    })
}

function getUser(username) {
    return new Promise((resolve, reject) => {
        var queryString = `SELECT username,password FROM users WHERE username='${username}'`;
        con.query(queryString, (err, result) => {
            if(err){
                reject(err);
            }
            else{
                resolve(result);
            }
        })
    }).catch(error => { 
        console.log(`No User found. Username: ${username}`);
        return [];
    });
}

function updateCookie(username, cookieKey){
    return new Promise((resolve, reject) => {
        var queryString = `UPDATE users SET token = '${cookieKey}' WHERE username = '${username}'`;
        con.query(queryString, (err, result) => {
            if(err){
                reject(err);
            }
            else{
                resolve(result);
            }
        })
    }).catch(error => { 
        console.log(`Error updating cookie. User: ${username}, Cookie: ${cookieKey}`);
        return [];
    });
}

function fetchUsers(){
    return new Promise((resolve, reject) => {
        var queryString = `SELECT * FROM users`;
        con.query(queryString, (err, result) => {
            if(err){
                reject(err);
            }
            else{
                resolve(result);
            }
        })
    }).catch(error => { 
        console.log(`No users found`);
        return [];
    });
}

module.exports = {
    con,
    addToChat,
    getAllChatMsg,
    getUser,
    registerUser,
    updateCookie,
    fetchUsers
}