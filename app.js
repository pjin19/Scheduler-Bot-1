var express = require('express');
var session = require('express-session');
var path = require('path');
var logger = require('morgan');
var bodyParser = require('body-parser');
var models = require('./models');
var app = express();
var readline = require('readline');
var fs = require('fs');
var google = require('googleapis');
var googleAuth = require('google-auth-library');
var mongoose = require('mongoose');
var User = require('./models');
var authenticate = require('./routes/google').authenticate;
var oauth2Client = require('./routes/google').oauth2Client;
var listEvents = require('./routes/google').listEvents;
var makeReminder = require('./routes/google').makeReminder;
var makeMeeting = require('./routes/google').makeMeeting;
var makeNewMeeting = require('./routes/google').makeNewMeeting;
var cookieParser = require('cookie-parser');
var SCOPES = require('./routes/google').SCOPES;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.set('port', process.env.PORT || 3000);

// error handlers

require('./routes/bot');

// production error handler
// no stacktraces leaked to user

if (! process.env.mongodb_uri) {
  throw new Error("MONGODB_URI is not in the environmental variables. Try running 'source env.sh'");
}

mongoose.connect(process.env.mongodb_uri);

mongoose.connection.on('connected', function() {
  console.log('Success: connected to MongoDb!');
});

mongoose.connection.on('error', function(err) {
  console.log('Error connecting to MongoDb: ' + err);
  process.exit(1);
});



var id = '';
app.get('/setup', function(req, res) {
  id = req.query.slackId
  var url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  });
  res.redirect(url);
});

app.get('/oauth2callback', function(req, res) {
  var code = req.query.code;
  authenticate(code, oauth2Client, id);
  res.send('User has been authenticated!')
});

app.post('/slack/interactive', function(req, res) {
  var payload = JSON.parse(req.body.payload);
  console.log("HERE IS THE PAYLOAD", payload);
  User.findOne({userId: payload.user.id}, function(err, user) {
    if(err) {
      console.log('Error finding user to make proposed event')
    } else {
        var title = user.title;
        var startTime = new Date(payload.actions[0].value);
        var token = user.token;
        var duration = user.duration;
        var attendees = user.attendees;
        return makeNewMeeting(title, startTime, token, duration, attendees)
          .then(function() {
            res.send('Created meeting!');
          })
          .catch(function(err) {
            res.send('Error creating meeting with proposed times!', err);
          })
        }
      })
    })

app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});

var port = process.env.PORT || 3000;
app.listen(port);
console.log('Express started. Listening on port %s', port);

module.exports = app;
