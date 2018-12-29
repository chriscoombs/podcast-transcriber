const AWSXRay = require('aws-xray-sdk');
const AWS = AWSXRay.captureAWS(require('aws-sdk'));
const axios = require('axios');
const {
  parseString,
} = require('xml2js');

const lambda = new AWS.Lambda();
const s3 = new AWS.S3();
const transcribeservice = new AWS.TranscribeService();

const {
  url,
  lastPubDate,
  mp3Bucket,
  transcriptBucket,
} = process.env;

// Get RSS feed as JSON
const getRss = fnUrl => new Promise((resolve, reject) => {
  console.log('getRss|ENTRY');
  axios.get(fnUrl, {
    responseType: 'text',
  })
    .then(({ data }) => {
      parseString(data, (err, result) => {
        if (err) {
          console.log(`getRss|ERROR|${err}`);
          reject(err);
        } else {
          console.log('getRss|EXIT');
          resolve(result);
        }
      });
    })
    .catch((err) => {
      console.log(`getRss|ERROR|${err}`);
      reject(err);
    });
});

// Download file and save to S3
const s3Save = fnUrl => new Promise((resolve, reject) => {
  console.log('s3Save|ENTRY');
  axios.get(fnUrl, {
    responseType: 'arraybuffer',
  })
    .then(result => s3.putObject({
      Bucket: mp3Bucket,
      Key: fnUrl.split('/').pop(),
      Body: result.data,
    }).promise())
    .then(() => {
      console.log('s3Save|EXIT');
      resolve();
    })
    .catch((err) => {
      console.log(`s3Save|ERROR|${err}`);
      reject(err);
    });
});

// Function logic belongs here, please modify
const main = (context, event) => new Promise(async (resolve, reject) => { // eslint-disable-line no-unused-vars, max-len
  console.log('main|ENTRY');
  try {
    const {
      rss,
    } = await getRss(url);
    const episode = rss.channel[0].item[0];
    const pubDate = episode.pubDate[0];
    console.log(`${pubDate} is ${(!lastPubDate || new Date(pubDate) > new Date(lastPubDate)) ? 'newer' : 'older'} than ${lastPubDate}`);
    // First time of execution or new publication date is newer
    if (!lastPubDate || new Date(pubDate) > new Date(lastPubDate)) {
      const mp3Url = episode.enclosure[0].$.url;
      const key = mp3Url.split('/').pop();
      await s3Save(mp3Url, key);
      await transcribeservice.startTranscriptionJob({
        LanguageCode: 'en-US',
        Media: {
          MediaFileUri: `s3://${mp3Bucket}/${key}`,
        },
        MediaFormat: 'mp3',
        TranscriptionJobName: key,
        OutputBucketName: transcriptBucket,
        Settings: {
          ChannelIdentification: false,
          ShowSpeakerLabels: false,
        },
      }).promise();
      await lambda.updateFunctionConfiguration({
        FunctionName: context.functionName,
        Environment: {
          Variables: {
            lastPubDate: pubDate,
            url,
            mp3Bucket,
            transcriptBucket,
          },
        },
      }).promise();
    }
    console.log('main|EXIT');
    resolve();
  } catch (err) {
    console.log(`main|ERROR|${err}`);
    reject(err);
  }
});

// Example for Jest unit test, please remove
const sum = (a, b) => a + b;

// handler function abstracts Lambda callback behaviour and should not be modified
const handler = (event, context) => new Promise((resolve, reject) => {
  // Log the input event
  console.log(`handler|ENTRY|${JSON.stringify(event)}`);
  main(context, event)
    .then((success) => {
      // Log the output
      console.log(`handler|EXIT|${JSON.stringify(success)}`);
      resolve(success);
    })
    .catch((error) => {
      // Log the output
      console.log(`handler|ERROR|${error}`);
      reject(error);
    });
});

module.exports = {
  handler,
  main,
  sum,
};
