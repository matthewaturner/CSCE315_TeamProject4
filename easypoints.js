// imports
var express = require("express");
var bodyParser = require("body-parser");
var fs = require("fs");
var readline = require("readline");
var google = require("googleapis");
var googleAuth = require("google-auth-library");

// make a new express application
var app = express();
var sheets = google.sheets('v4');

// parses variables given to this app in url encodings / etc
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// json objects that store the data we receive from google
var requirements = {};
var events = {};
var roster = {};

// oauth token to make requests with
var authToken;

/* ------------------------------------------------------------------------- */
/*   Google Authentication Steps                                             */
/* ------------------------------------------------------------------------- */
// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/sheets.googleapis.com-nodejs-quickstart.json
var SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
    process.env.USERPROFILE) + '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'sheets.googleapis.com-nodejs-quickstart.json';

fs.readFile('client_secret.json', function processClientSecrets(err, content) {
  if (err) {
    console.log('Error loading client secret file: ' + err);
    return;
  }
  // Authorize a client with the loaded credentials, then call the
  // Google Sheets API.
  authorize(JSON.parse(content), getData);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  var clientSecret = credentials.installed.client_secret;
  var clientId = credentials.installed.client_id;
  var redirectUrl = credentials.installed.redirect_uris[0];
  var auth = new googleAuth();
  var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, function(err, token) {
    if (err) {
      getNewToken(oauth2Client, callback);
    } else {
      oauth2Client.credentials = JSON.parse(token);
      // store the auth token
      authToken = oauth2Client;
      callback();
    }
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oauth2Client, callback) {
  var authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  });
  console.log('Authorize this app by visiting this url: ', authUrl);
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question('Enter the code from that page here: ', function(code) {
    rl.close();
    oauth2Client.getToken(code, function(err, token) {
      if (err) {
        console.log('Error while trying to retrieve access token', err);
        return;
      }
      oauth2Client.credentials = token;
      storeToken(token);
      // store auth tokens in our request objects
      authToken = oauth2Client;
      callback();
    });
  });
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
  try {
    fs.mkdirSync(TOKEN_DIR);
  } catch (err) {
    if (err.code != 'EEXIST') {
      throw err;
    }
  }
  fs.writeFile(TOKEN_PATH, JSON.stringify(token));
  console.log('Token stored to ' + TOKEN_PATH);
}

/* ------------------------------------------------------------------------- */
/*   End Google Authentication Steps                                         */
/* ------------------------------------------------------------------------- */

function getData() {

    process.stdout.write("Fetching fresh data from sheets...");

    // reset all the data
    requirements = {};
    events = {};
    roster = {};
    members = {};
    
    // the calls to google's api are asynchronous so we chain them together 
    // with callbacks in order to make them execute sequentially because some
    // data formatting depends on previous data
    getRequirementsData(function() {
        getEventData(function() {
            getMembersAndPointsData();
        });
    });

    getPeopleData();

    process.stdout.write("Fetched data.");
}

function getRequirementsData(callback) {
/* Gets data from the Requirements sheet */

    sheets.spreadsheets.values.get({
      auth: authToken,
      spreadsheetId: '1ubTGZMGCL4IFurwfKmhaXa6Eb4VKGOdMeDFn7rOMhHk',
      range: 'Requirements!A2:B'
    }, function(err, response) {
      if (err) {
        console.log('The API returned an error: ' + err);
        return;
      }

      var rows = response.values;
      if (rows.length == 0) {
        console.log('WARNING: No data found on google sheet.');
      } else {
        for (var i = 0; i < rows.length; i++) {
          var row = rows[i];
          requirements[row[0]] = {"point-goal": row[1]};
        }
      }

      callback();
    });
}

function getEventData(callback) {
/* Gets data from the Events sheet */

    sheets.spreadsheets.values.get({
      auth: authToken,
      spreadsheetId: '1ubTGZMGCL4IFurwfKmhaXa6Eb4VKGOdMeDFn7rOMhHk',
      range: 'Events!A2:D'
    }, function(err, response) {
      if (err) {
        console.log('The API returned an error: ' + err);
        return;
      }

      var rows = response.values;
      if (rows.length == 0) {
        console.log('WARNING: No data found on google sheet.');
      } else {
        for (var i = 0; i < rows.length; i++) {
          var row = rows[i];
          events[row[0]] = {"date": row[1], "category": row[2], "points": row[3]};
        }
      }

      callback();
    });
}

function getMembersAndPointsData() {
/* Gets data from the Members and Points sheet */

    sheets.spreadsheets.values.get({
        auth: authToken,
        spreadsheetId: '1ubTGZMGCL4IFurwfKmhaXa6Eb4VKGOdMeDFn7rOMhHk',
        range: 'Members and Points!A1:ZZ'
    }, function(err, response) {
      if (err) {
        console.log('The API returned an error: ' + err);
        return;
      }
  
      // iterate over the response and add information to userData json
      var rows = response.values;
      if (rows.length == 0) {
        console.log('WARNING: No data found on google sheet.');
      } else {
        // first create a map of columns to event names
        var colToEvent = {};
        var row = rows[0];
        for(var i=1; i<row.length; i++) {
          colToEvent[i] = row[i];
        }

        // using the column to event name map, total points
        for (var i = 1; i < rows.length; i++) {
          // object of points this person has earned
          var points = {"Total": 0};
          var row = rows[i];
          
          for(var j=3; j<row.length; j++) {

            // skip this cell if the heading was "Comments" or blank
            if(colToEvent[j] === "Comments" || colToEvent[j] === "") 
                continue;

            var evnt = events[colToEvent[j]];

            if(row[j].toUpperCase() === "P") {
                points[evnt["category"]] = points[evnt["category"]] || 0;
                points[evnt["category"]] = parseInt(points[evnt["category"]]) + parseInt(evnt["points"]);
                points["Total"] = parseInt(points["Total"]) + parseInt(evnt["points"]);
            } else if(!isNaN(parseInt(row[j]))) {
                points[evnt["category"]] = points[evnt["category"]] || 0;
                points[evnt["category"]] = parseInt(points[evnt["category"]]) + parseInt(row[j]);
                points["Total"] = parseInt(points["Total"]) + parseInt(row[j]);
            }
          }

          for(var key in points) {
            if(points.hasOwnProperty(key)) {
                points[key + "-Goal"] = requirements[key]["point-goal"];
            }
          }

          // add this person and their points to the roster
          roster[row[0]] = points;
        }
      }
    });
}

function getPeopleData(callback) {
/* Gets the data from the People sheet */

    sheets.spreadsheets.values.get({
      auth: authToken,
      spreadsheetId: '1ubTGZMGCL4IFurwfKmhaXa6Eb4VKGOdMeDFn7rOMhHk',
      range: 'Members!A2:D'
    }, function(err, response) {
      if (err) {
        console.log('The API returned an error: ' + err);
        return;
      }

      var rows = response.values;
      if (rows.length == 0) {
        console.log('WARNING: No data found on google sheet.');
      } else {
        for (var i = 0; i < rows.length; i++) {
          var row = rows[i];
          members[row[0]] = {"Email": row[1], "Phone Number": row[2], "Carrier": row[3]};
        }
      }
    });
}

/* ------------------------------------------------------------------------- */
/*     Server Routing                                                        */
/* ------------------------------------------------------------------------- */

// call getData every 5 minutes
// var interval = setInterval(getData(), 300000);

// callback when request hits the server
// just so we know when connections hit the server
app.use(function(req, res, next) {
    console.log(`${req.method} request for '${req.url}'`);
    // calls the next function in the call stack
    next();
});

// serves requirements data
app.get("/requirements", function(req, res) {
    res.json(requirements);
});

// serves events data
app.get("/events", function(req, res) {
    res.json(events);
});

// serves member and points data
app.get("points", function(req, res) {
    getData();
    res.json(events);
});

// serves people data
app.get("/people", function(req, res) {
    res.json(people);
});

// handles get requests
app.get("/points/:name", function(req, res) {
    if(req.params.name in roster) {
        res.json(roster[req.params.name]);
    } else {
        res.json({
            "Total": 0
        });
    }
});

// start the default fileserver that comes with express
app.use(express.static("./public"));

// start the server on port 8000
app.listen(8000);

console.log("Server running on port 8000");
