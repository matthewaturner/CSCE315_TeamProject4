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
var SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
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
/*   Reading Data From Sheets                                                */
/* ------------------------------------------------------------------------- */

function getData() {

    console.time("getData");
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
            getMembersAndPointsData(function() {
                console.timeEnd("getData");
                writeTotals();
            });
        });
    });

    getMembersData();
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
          requirements[row[0]] = {"point-goal": parseInt(row[1])};
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
          events[row[0]] = {"date": row[1], "category": row[2], "points": parseInt(row[3])};
        }
      }

      callback();
    });
}

function getMembersAndPointsData(callback) {
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

        // using the column to event name map, total points for the members
        for (var i = 3; i < rows.length; i++) {
          // object of points this person has earned
          var points = {"Total": 0};
          var row = rows[i];
          
          // start at the second column
          for(var j=1; j<row.length; j++) {

            // skip this cell if the heading was "Comments" or blank
            if(colToEvent[j] === "Comments" || colToEvent[j] === "") 
                continue;

            var evnt = events[colToEvent[j]];
            var category = evnt["category"];

            points[category] = points[category] || 0;
            points[category + "-Goal"] = points[category + "-Goal"] || 0;

            if(row[j].toUpperCase() === "P") {
                // add the points for this event to the category and the total
                points[category] += evnt["points"];
                points["Total"] += evnt["points"];
            } else if(row[j].toUpperCase() === "E") {
                // start the category goal negative (reduces the category goal for this person)
                points[category + "-Goal"] -= evnt["points"];
            } else if(row[j] === "U") {
                // do nothing
            } else if(!isNaN(parseInt(row[j]))) {
                // if the entry is a number add that number to the total points of this category and the total
                points[category] += parseInt(row[j]);
                points["Total"] += parseInt(row[j]);
            }
          }

          for(var category in requirements) {
            if(points.hasOwnProperty(category)) {
                // no guarantee that this happened for every category
                points[category + "-Goal"] = points[category + "-Goal"] || 0;
                // add the category goal for this person and the total category goal together
                points[category + "-Goal"] += requirements[category]["point-goal"];
            }
          }

          // add this person and their points to the roster
          roster[row[0]] = points;
        }
      }

      callback();
    });
}

function getMembersData(callback) {
/* Gets the data from the Members sheet */

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
/*     Writing Data To Sheets                                                */
/* ------------------------------------------------------------------------- */

function writeTotals() {

    console.time("writeTotals");
    process.stdout.write("Writing data to totals sheet...");

    sheets.spreadsheets.values.update({
        auth: authToken,
        spreadsheetId: '1ubTGZMGCL4IFurwfKmhaXa6Eb4VKGOdMeDFn7rOMhHk',
        range: 'Totals!A1',
        valueInputOption: 'USER_ENTERED',
        resource: {range: 'Totals!A1',
                   values: formatTotals()}
    }, function(err, response) {
        if(err) {
            console.log('Error while writing to the spreadsheet: ' + err);
            return;
        }
    });

    console.timeEnd("writeTotals");
}

function formatTotals() {
    var totals = [];
    var row = [""];
    
    // create first row (headings of the columns)
    for(var category in requirements) {
        if(requirements.hasOwnProperty(category)) {
            row.push(category);
        }
    }
    totals.push(row);

    // create possible points row
    row = ["Required Points"];
    for(var category in requirements) {
        if(requirements.hasOwnProperty(category)) {
            row.push(requirements[category]["point-goal"]);
        }
    }
    totals.push(row);

    totals.push(["Members"]);

    // create the rest of the rows
    for(var member in roster) {
        if(roster.hasOwnProperty(member)) {
            row = [member];
            for(var category in requirements) {
                if(requirements.hasOwnProperty(category)) {
                    row.push(roster[member][category] - roster[member][category + "-Goal"]);
                }
            }
        }
        totals.push(row);
    }

    return totals;
}

/* ------------------------------------------------------------------------- */
/*     Server Routing                                                        */
/* ------------------------------------------------------------------------- */

// call getData every 5 minutes
var interval = setInterval(getData, 300000);

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

// serves members data
app.get("/members", function(req, res) {
    res.json(members);
});

// serves data for a specific member
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
