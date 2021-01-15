const fs = require('fs').promises; //Module allows us to work with the file system on the computer async .
const fssync = require('fs'); //Module allows us to work with the file system on the computer sync .
process.env["NODE_CONFIG_DIR"] = "/home/christine/GoogleSheetsCSV/config"
const config = require('config');
const path = require('path');
const readline = require('readline'); //Provides an interface for reading data from a Readable
//stream (such as process. stdin ) one line at a time.
const {google} = require('googleapis'); //Node.js client library for using Google APIs.
const csv = require('csvtojson'); //In order to convert csv to json or column arrays.
const https = require('request-promise');

//When your application needs access to user data, it asks Google for a particular SCOPE of access.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

//If the user approves, then Google gives your application a short-lived access token, which is stored in
//token.json file, which is created automatically when the authorization flow completes for the first time.
const TOKEN_PATH = 'token.json';


class GoogleSheetLoader {


  //For loading client secrets from a local file.
  static async readCredentials() {
    try {
      // await fs.readFile('credentials.json', (content) => {
      //   //Authorizing a client with credentials, then calling the Google Sheets API.
      //   GoogleSheetLoader.authorize(JSON.parse(content), GoogleSheetLoader.getSpreadsheetInfo);
      // })

      const content = await fs.readFile('credentials.json');
      await GoogleSheetLoader.authorize(JSON.parse(content), GoogleSheetLoader.getSpreadsheetInfo);
    } catch (err) {
      return console.error('Error loading client secret file:', err);
    }
  };


  //Create an OAuth2 client with the given credentials, and then execute the given callback function.
  static async authorize(credentials, callback) {
    const {client_secret, client_id, redirect_uris} = credentials.web;
    const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

    try {
      let token = await fs.readFile(TOKEN_PATH);
      oAuth2Client.setCredentials(JSON.parse(token));
      callback(oAuth2Client);
    } catch (err) {
      await GoogleSheetLoader.getNewToken(oAuth2Client, callback);
    }
  };


  //Get and store new token after prompting for user authorization, and then execute the given callback
  //with the authorized OAuth2 client.
  static async getNewToken(oAuth2Client, callback) {
    const authUrl = await oAuth2Client.generateAuthUrl({
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

        async function writing() {
          try {
            await fs.writeFile(TOKEN_PATH, JSON.stringify(token));
            console.log('Token stored to', TOKEN_PATH);
            callback(oAuth2Client)
          } catch (err) {
            return console.error(err);
          }
        }
      });
    });
  };


  static async printData(file) {
    try {
      await csv()
        .fromFile(file)
        .then((jsonObj) => {
          console.log(JSON.stringify(jsonObj, null, 4));
        });
    } catch (err) {
      console.error('Error while printing content to terminal:', err);
    }
  };


  static async downloadCSV(response, sheetsProperties) {
    try {
      for (let i = 0; i <= sheetsProperties.length - 1; i++) {
        const spreadSheetURL = response.data.spreadsheetUrl; //Retrieving the url in order to modify it later.
        const exportURL = spreadSheetURL.replace('/edit', '/gviz/tq?tqx=out:csv&gid='); //Amending to download file in CSV format.
        const headers = response.config.headers['Authorization'];
        const url = exportURL + sheetsProperties[i].properties.sheetId;


        let title
        if (GoogleSheetLoader.infoMap.fileToSave !== '') {
          title = GoogleSheetLoader.infoMap.fileToSave;
        } else {
          title = sheetsProperties[i].properties.title;
        }
        let res = https.get(url, headers);

        const dirpath = config.get('Directory.dirName')


        const fileStream = fssync.createWriteStream(`${dirpath}${title}.csv`);

        res.pipe(fileStream); //Channeling the information we gonna get during downloading to the our writable stream.
        fileStream.on('error', function (err) {
          console.error('Error while trying to write to the stream:', err);
        });
        fileStream.on('finish', function () {
          GoogleSheetLoader.printData(`${dirpath}${title}.csv`); //Printing data to terminal.
          fileStream.close(); //Making sure file is properly closed after the downloading/piping is finished.
        });
      }
    } catch (err) {
      console.error('Error while trying to download file:', err);
    }
  };


  static async getSpreadsheetInfo(auth) {
    const sheets = google.sheets({version: 'v4', auth});
    let request = {
      spreadsheetId: GoogleSheetLoader.infoMap.sheetID,
      ranges: [],
      includeGridData: false,
      auth: auth,
    };

    try {
      //Returns the spreadsheet at the given ID.
      const response = await sheets.spreadsheets.get(request);

      let sheetsProperties = response.data['sheets']; //The sheets that are part of a spreadsheet.
      await GoogleSheetLoader.downloadCSV(response, sheetsProperties);
    } catch (err) {
      return console.error('The API returned an error: ' + err);
    }
  };

  static async init(sheetID, filePath) {
    let fileToSave = '';

    GoogleSheetLoader.infoMap = {
      sheetID: sheetID,
      fileToSave: fileToSave
    };

    if (filePath) {
      GoogleSheetLoader.infoMap.fileToSave = filePath;
    }
    if (!sheetID) {
      throw new Error('SheetID is missing');
    }

    try {
      await GoogleSheetLoader.readCredentials();
    } catch (ex) {
      console.error(ex);
    }
  };


}

module.exports = GoogleSheetLoader;


