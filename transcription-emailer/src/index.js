const AWSXRay = require('aws-xray-sdk');
const AWS = AWSXRay.captureAWS(require('aws-sdk'));

const s3 = new AWS.S3();
const ses = new AWS.SES();

const {
  bucket,
  source,
  destination,
  title,
} = process.env;

// Function logic belongs here, please modify
const main = event => new Promise((resolve, reject) => { // eslint-disable-line no-unused-vars
  const {
    key,
  } = event.Records[0].s3.object;
  s3.getObject({
    Bucket: bucket,
    Key: key,
  }).promise()
    .then((data) => {
      const transcription = JSON.parse(data.Body.toString('UTF-8'));
      console.log(transcription);
      console.log(transcription.results.transcripts[0].transcript);
      return ses.sendEmail({
        Destination: {
          ToAddresses: [
            destination,
          ],
        },
        Message: {
          Body: {
            Text: {
              Charset: 'UTF-8',
              Data: transcription.results.transcripts[0].transcript,
            },
          },
          Subject: {
            Charset: 'UTF-8',
            Data: `${title} - ${key.split('.mp3.json')[0]}`,
          },
        },
        Source: source,
      }).promise();
    })
    .then((result) => {
      resolve(result);
    })
    .catch(error => reject(error));
});

// Example for Jest unit test, please remove
const sum = (a, b) => a + b;

// handler function abstracts Lambda callback behaviour and should not be modified
const handler = event => new Promise((resolve, reject) => {
  // Log the input event
  console.log(JSON.stringify(event));
  main(event)
    .then((success) => {
      // Log the output
      console.log(JSON.stringify(success));
      resolve(success);
    })
    .catch((error) => {
      // Log the output
      console.log(JSON.stringify(error));
      reject(error);
    });
});

module.exports = {
  handler,
  main,
  sum,
};
