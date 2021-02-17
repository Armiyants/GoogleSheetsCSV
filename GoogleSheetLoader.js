const fs = require('fs'); //Module allows us to work with the file system on the computer sync .
const config = require('config');
const readline = require('readline'); //Provides an interface for reading data from a Readable stream
// (such as process. stdin ) one line at a time.
const {google} = require('googleapis'); //Node.js client library for using Google APIs.
const rp = require('request-promise'); //In order to make HTTP requests with Promise support.


class GoogleSheetLoader {
  //For loading client secrets from a local file.
  static async readCredentials() {
    try {
      const content = fs.readFileSync(config.credentialsPath);
      await GoogleSheetLoader.authorize(JSON.parse(content));
    } catch (err) {
      return console.error('Error loading client secret file:', err);
    }
  };

  //Create an OAuth2 client with the given credentials.
  static async authorize(credentials) {
    const {client_secret, client_id, redirect_uris} = credentials.web;
    const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

    try {
      const token = fs.readFileSync(config.tokenPath); //If the user approves, then Google gives your application a short-lived access token, which is stored in
      // token.json file, which is created automatically when the authorization flow completes for the first time.
      oAuth2Client.setCredentials(JSON.parse(token));
      GoogleSheetLoader.infoMap.client = oAuth2Client;
      GoogleSheetLoader.infoMap.isAuthorized = true;
    } catch (err) {
      await GoogleSheetLoader.getNewToken(oAuth2Client);
    }
  };


  //Get and store new token after prompting for user authorization.
  static async getNewToken(oAuth2Client) {
    const authUrl = await oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: config.scopes, //When your application needs access to user data, it asks Google for a particular SCOPE of access.
    });
    console.log('Authorize this app by visiting this url:', authUrl);
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const promise = new Promise((resolve, reject) => {
      rl.question('Enter the code from that page here: ', (code) => {
        rl.close();
        oAuth2Client.getToken(code, (err, token) => {
          if (err) {
            return reject(err);
          }

          oAuth2Client.setCredentials(token);

          async function writing() {
            try {
              await fs.writeFile(config.tokenPath, JSON.stringify(token));
              console.log('Token stored to', config.tokenPath);
              return resolve(token);
            } catch (err) {
              return reject(err);
            }
          }

          return resolve(writing());
        });
      })
    })
  }


  static async downloadCSV(response, sheetsProperties) {
    try {
      let allPromises = [];
      for (let i = 0; i < sheetsProperties.length; ++i) {
        const spreadSheetURL = response.data.spreadsheetUrl; //Retrieving the url in order to modify it later.
        const exportURL = spreadSheetURL.replace('/edit', '/gviz/tq?tqx=out:csv&gid='); //Amending to download data in CSV format.
        const url = exportURL + sheetsProperties[i].properties.sheetId;

        let title;
        if (GoogleSheetLoader.infoMap.fileToSave !== '') {
          title = GoogleSheetLoader.infoMap.fileToSave;
        } else {
          title = sheetsProperties[i].properties.title;
        }

        const options = {
          method: 'GET',
          url,
          headers: {
            'Authorization': response.config.headers['Authorization']
          }
        };

        const res = await rp(options);

        const finalPath = `${config.downloadDir}/${title}.csv`;

        const promise = new Promise((resolve, reject) => {
          fs.writeFile(finalPath, res, (err) => {
            if (err) {
              console.error('Error while trying to write to the stream:', err);
              return reject(err);
            }
            resolve(finalPath);
          });
        });
        allPromises.push(promise);
      }
      return Promise.all(allPromises);
    } catch (err) {
      console.error('Error while trying to download file:', err);
    }
  };


  static async getSpreadsheetInfo() {
    const sheets = google.sheets({version: 'v4', auth: GoogleSheetLoader.infoMap.client});
    let request = {
      spreadsheetId: GoogleSheetLoader.infoMap.sheetID,
      ranges: [],
      includeGridData: false,
    };

    try {
      //Returns the spreadsheet at the given ID.
      const response = await sheets.spreadsheets.get(request);

      const sheetsProperties = response.data['sheets']; //All the sheets that are part of a spreadsheet.
      return await GoogleSheetLoader.downloadCSV(response, sheetsProperties);
    } catch (err) {
      return console.error('The API returned an error: ' + err);
    }
  };


  static async loadData() {
    if (GoogleSheetLoader.infoMap.client && GoogleSheetLoader.infoMap.isAuthorized) {
      GoogleSheetLoader.infoMap.paths = [];
      return await GoogleSheetLoader.getSpreadsheetInfo(GoogleSheetLoader.infoMap.client);
    }
    throw new Error('Not connected to Google');
  };

  static async init(sheetID, filePath) {
    let fileToSave = '';

    GoogleSheetLoader.infoMap = {
      sheetID: sheetID,
      fileToSave: fileToSave,
      isAuthorized: false
    };

    //checking for the case when we were given the exact file path
    if (filePath) {
      GoogleSheetLoader.infoMap.fileToSave = filePath;
    }
    if (!sheetID) {
      throw new Error('SheetID is missing');
    }
    await GoogleSheetLoader.readCredentials();
  };
}

module.exports = GoogleSheetLoader;
