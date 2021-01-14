const fs = require('fs'); //Module allows us to work with the file system on the computer.
const readline = require('readline'); //Provides an interface for reading data from a Readable
//stream (such as process. stdin ) one line at a time.
const {google} = require('googleapis'); //Node.js client library for using Google APIs.
const csv = require('csvtojson'); //In order to convert csv to json or column arrays.
const https = require('https');

//When your application needs access to user data, it asks Google for a particular SCOPE of access.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

//If the user approves, then Google gives your application a short-lived access token, which is stored in
//token.json file, which is created automatically when the authorization flow completes for the first time.
const TOKEN_PATH = 'token.json';


//Loading client secrets from a local file.
fs.readFile('credentials.json', (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  //Authorizing a client with credentials, then calling the Google Sheets API.
  authorize(JSON.parse(content), readData);
});


//Create an OAuth2 client with the given credentials, and then execute the given callback function.
function authorize(credentials, callback) {
  const {client_secret, client_id, redirect_uris} = credentials.web;
  const oAuth2Client = new google.auth.OAuth2(
    client_id, client_secret, redirect_uris[0]);

  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getNewToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}



//Get and store new token after prompting for user authorization, and then execute the given callback
//with the authorized OAuth2 client.
function getNewToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error while trying to retrieve access token', err);
      oAuth2Client.setCredentials(token);
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}


function printData(file){
  csv()
    .fromFile(file)
    .then((jsonObj) => {
      console.log(JSON.stringify(jsonObj, null, 4));
    });
}


function downloadCSV(response, sheetsProperties){
  for (let i = 0; i <= sheetsProperties.length - 1; i++) {
    const spreadSheetURL = response.data.spreadsheetUrl; //Retrieving the url in order to modify it later.
    const exportURL = spreadSheetURL.replace('/edit', '/gviz/tq?tqx=out:csv&gid='); //Amending to download file in CSV format.
    const headers = response.config.headers['Authorization'];
    const url = exportURL + sheetsProperties[i].properties.sheetId;

    https.get(url, headers, function (err,res) {
      if (err) {
        console.log('Error while trying to Download file' , err);
      }

      let title = sheetsProperties[i].properties.title;
      const fileStream = fs.createWriteStream(`${title}.csv`);
      res.pipe(fileStream); //Channeling the information we gonna get during downloading to the our writable stream.
      fileStream.on('error', function (err){
        console.log('Error while trying to write to the stream:' , err);
      });
      fileStream.on('finish', function () {
        fileStream.close(); //Making sure file is properly closed after the downloading/piping is finished.
      });
      printData(`${title}.csv`); //Printing data to terminal.
    });
  }
}


function readData(auth) {
  const sheets = google.sheets({version: 'v4', auth});
  let request = {
    spreadsheetId: '19BQWGzH4q1C0rHNVAzhh5PqaxB655lSNmSGc473vu74',
    ranges: [],
    includeGridData: false,
    auth: auth,
  };

  try {
    //Returns the spreadsheet at the given ID.
    sheets.spreadsheets.get(request, function (err, response) {
      if (err) {
        console.log(err);
        return;
      }

      let sheetsProperties = response.data['sheets']; //The sheets that are part of a spreadsheet.
      downloadCSV(response, sheetsProperties);
    });
  } catch (err) {
    return console.log('The API returned an error: ' + err);
  }
}

