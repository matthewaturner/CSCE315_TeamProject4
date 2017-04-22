// imports
var express = require("express");
var bodyParser = require("body-parser");
var fs = require("fs");
var readline = require("readline");
var google = require("googleapis");
var googleAuth = require("google-auth-library");

// make a new express application
var app = express();
var userData;

// parses variables given to this app in url encodings / etc
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

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
      callback(oauth2Client);
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
      callback(oauth2Client);
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

/**
 * Print the names and majors of students in a sample spreadsheet:
 * https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
 */
function getData(auth) {
  var sheets = google.sheets('v4');
  sheets.spreadsheets.values.get({
    auth: auth,
    spreadsheetId: '1s_GU9ADQ9BHu5WLIl-nz6u-I5wg6fKHwluxG4VAGEYo',
    range: 'A2:B',
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
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        userData[row[0]] = {total: row[1]};
      }
    }
  });
}

/* ------------------------------------------------------------------------- */
/*   End Google Authentication Steps                                         */
/* ------------------------------------------------------------------------- */

// callback when request hits the server
app.use(function(req, res, next) {
    console.log(`${req.method} request for '${req.url}'`);
    // calls the next function in the call stack
    next();
});

// handles get requests
app.get("/points-api/:name", function(req, res) {
    if(req.params.name in userData) {
        res.json(userData[req.params.name]);
    } else {
        res.json({
            total: 0
        });
    }
});

// start the default fileserver that comes with express
app.use(express.static("./public"));

// start the server on port 8000
app.listen(8000);

console.log("Server running on port 8000");
