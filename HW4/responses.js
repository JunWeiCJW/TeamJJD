const codes = require('./httpCodes.js');

function sendErr(msg) {
    if(typeof(msg) == 'undefined' || msg == null){
        msg = "The content requested is currently unavailable";
    }
    return `HTTP/1.1 404 Not Found \r\nContent-Length: ${msg.length} \r\nContent-Type: text/plain \r\nX-Content-Type-Options: nosniff \r\n\r\n${msg}`;
}

function sendRedirect(route) {
    return `HTTP/1.1 301 Moved Permanently \r\nLocation: ${route}\r\n\r\n`;
}

function sendForbidden() {
    return "HTTP/1.1 403 Forbidden\r\nContent-Length:0\r\n\r\n"
}

function needLogin() {
    return "HTTP/1.1 403 Forbidden\r\nContent-Length:24\r\n\r\nPlease login to continue"
}

module.exports = {
    sendErr,
    sendRedirect,
    sendForbidden,
    needLogin
}