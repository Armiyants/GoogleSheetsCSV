const GSLoader = require('./GoogleSheetLoader');

async function main () {
  try {
    await GSLoader.init('19BQWGzH4q1C0rHNVAzhh5PqaxB655lSNmSGc473vu74');
  } catch (err) {
    console.error('Error while initiating:', err);
  }
}

main()




