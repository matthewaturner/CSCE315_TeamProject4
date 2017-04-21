// imports
var express = require("express");
//var cors = require("cors");
var app = express();

// callback when request hits the server
app.use(function(req, res, next) {
    console.log(`${req.method} request for '${req.url}');
    // calls the next function in the call stack
    next();
});

// start the default fileserver that comes with express
app.use(express.static("./public"));

// start the server on port 8000
app.listen(8000);

console.log("Server running on port 8000");
