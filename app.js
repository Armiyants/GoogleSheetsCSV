const GSLoader = require('./GoogleSheetLoader');
const csv = require('csvtojson'); //In order to convert csv to json or column arrays.


async function main() {
  try {
    await GSLoader.init('19BQWGzH4q1C0rHNVAzhh5PqaxB655lSNmSGc473vu74');
    const pathsReceived = await GSLoader.loadData();

    for (let i = 0; i < pathsReceived.length; ++i) {
      await printData(pathsReceived[i]);
    }
  } catch (err) {
    console.error('Error while initiating:', err);
  }
}


async function printData(file) {
  try {
    await csv()
      .fromFile(file)
      .then((jsonObj) => {
        console.log(JSON.stringify(jsonObj, null, 4));
      });
  } catch (err) {
    console.error('Error while printing content to terminal:', err);
  }
}


main();