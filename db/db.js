var mysql = require('@vlasky/mysql');

var con = mysql.createConnection({
    //--DOCKER COMPOSE CONFIG--
    // host:"mysql",
    // port: "3306",
    // user: "root",
    // password: "codingisfun"
    //--DOCKER COMPOSE CONFIG--

    //--Local Host Config--
    host: "localhost",
    user: "root",
    password: "codingisfun"
    //--Local Host Config--
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

    con.query("CREATE TABLE IF NOT EXISTS chatfeed (id int NOT NULL AUTO_INCREMENT,username varchar(255) NOT NULL,comment varchar(255), likes int PRIMARY KEY (id))", function (err, result) {
        if (err) throw err;
        console.log("Created chatfeed table successfully");
    })

    con.query("CREATE TABLE IF NOT EXISTS users (id int NOT NULL AUTO_INCREMENT ,username varchar(255), password varchar(255), token varchar(255), PRIMARY KEY (id))", function (err, result) {
        if (err) throw err;
        console.log("Created users table successfully");
    })
})


//--------------CONTENT FEED---------------

function addToChat(dataobj) {
    var obj = JSON.parse(dataobj);
    var username = obj.username;
    var msg = obj.comment;

    con.query(`INSERT INTO chatfeed (username, comment, likes) VALUES ('${username}', '${msg}', 0)`, function (err, result) {
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

//--------------CONTENT FEED---------------

//--------------COOKIE STUFF---------------
//Updates the cookie at that username with new hashed cookie
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
//--------------COOKIE STUFF---------------

//-------USER QUERY---------

//Registers the user
function registerUser(username, password) {
    con.query(`INSERT INTO users (username, password) VALUES ('${username}', '${password}')`, function (err, result) {
        if (err) {console.log(`Failed to register user! Error: ${err}`);
        }else {console.log("Registered user!");}
    })
}

//Gets all users
function fetchUsers(){
    return new Promise((resolve, reject) => {
        var queryString = `SELECT * FROM users`;
        con.query(queryString, (err, result) => {
            if(err) reject(err);
            else resolve(result);
        })
    }).catch(error => { 
        console.log(`No users found`);
        return [];
    });
}

//Get user based on username
function getUser(username) {
    return new Promise((resolve, reject) => {
        var queryString = `SELECT username,password FROM users WHERE username='${username}'`;
        con.query(queryString, (err, result) => {
            if(err) reject(err);
            else resolve(result);
        })
    }).catch(error => { 
        console.log(`No User found. Username: ${username}`);
        return [];
    });
}

//Get user based off un-hashed cookie(each hash is different)
function getUserByCookie(cookie) {
    const userRows = await db.fetchUsers();
    if(userRows.length != 0){
        for(let i = 0; i < userRows.length; i++){
            var rowDict = userRows[i];
            if(bcrypt.compareSync(cookieKey, rowDict.token)){
                return rowDict;
            }
        }
    }
    return [];
}
//-------USER QUERY--------- 

module.exports = {
    con,
    addToChat,
    getAllChatMsg,
    getUser,
    registerUser,
    updateCookie,
    fetchUsers,
    getUserByCookie
}