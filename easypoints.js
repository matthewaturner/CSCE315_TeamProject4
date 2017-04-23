// imports
var express = require("express");
var bodyParser = require("body-parser");
var fs = require("fs");
var readline = require("readline");
var google = require("googleapis");
var googleAuth = require("google-auth-library");

// make a new express application
var app = express();

// parses variables given to this app in url encodings / etc
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// requests used
var categories = {};
var events = {};
var roster = {};

// oauth token to make requests with
authToken = null;

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
    
    getCategoryData(function() {
        getEventData(function() {
            getRosterData();
        });
    });

    //getPeopleData();
}

function getCategoryData(callback) {
    var sheets = google.sheets('v4');

    sheets.spreadsheets.values.get({
      auth: authToken,
      spreadsheetId: '1dscUPCA9T0mdQJ44dR4P53t6190QB8KGtPpsArPOAwg',
      range: 'A2:B'
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
          categories[row[0]] = {"point-goal": row[1]};
        }
      }

      console.log("Categories loaded: \n" + JSON.stringify(categories));

      callback();
    });
}

function getEventData(callback) {
    var sheets = google.sheets('v4');

    sheets.spreadsheets.values.get({
      auth: authToken,
      spreadsheetId: '1wm4A8jT83FmAyKsIDk-376gUO44o1dYHwuxcnkCG0Lk',
      range: 'A2:D'
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

      console.log("Events Loaded: \n" + JSON.stringify(events));

      callback();
    });
}

function getRosterData() {
    var sheets = google.sheets('v4');

    sheets.spreadsheets.values.get({
        auth: authToken,
        spreadsheetId: '1ubTGZMGCL4IFurwfKmhaXa6Eb4VKGOdMeDFn7rOMhHk',
        range: 'A1:J'
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
          var points = {"total": 0};
          var row = rows[i];
          
          for(var j=1; j<row.length; j++) {
            var evnt = events[colToEvent[j]];

            if(row[j] == "present") {
                points[evnt["category"]] = points[evnt["category"]] || 0 
                points[evnt["category"]] = parseInt(points[evnt["category"]]) + parseInt(evnt["points"]);
                points["total"] = parseInt(points["total"]) + parseInt(evnt["points"]);
            }
          }

          // add this person and their points to the roster
          roster[row[0]] = points;
        }
      }
    });
}

/* ------------------------------------------------------------------------- */
/*     Server Routing                                                        */
/* ------------------------------------------------------------------------- */

// callback when request hits the server
app.use(function(req, res, next) {
    console.log(`${req.method} request for '${req.url}'`);
    // calls the next function in the call stack
    next();
});

app.get("/points-api", function(req, res) {
});

// handles get requests
app.get("/points-api/:name", function(req, res) {
    if(req.params.name in roster) {
        res.json(roster[req.params.name]);
    } else {
        res.json({
            "total": 0
        });
    }
});

// start the default fileserver that comes with express
app.use(express.static("./public"));

// start the server on port 8000
app.listen(8000);

console.log("Server running on port 8000");
