
const AwsUtil = require('aws-sdk');

module.exports.s3 = null;
module.exports.dynamoDb = null;

/**
 * init
 * initializes the connection to the AWS S3 bucket
 */
module.exports.init = () => {
    AwsUtil.config.update({
        accessKeyId: process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_SECRET,
        region: 'us-west-2',
    });

    // module.exports.dynamoDb = new AWS.DynamoDB.DocumentClient();
};

/**
 * getDynamo
 * @returns {*}
 */
module.exports.getDynamo = () => {
    if (module.exports.dynamoDb === undefined || module.exports.dynamoDb === null) {
        AwsUtil.config.update({
            accessKeyId: process.env.AWS_ACCESS_KEY,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_SECRET,
            region: 'us-west-2',
        });
        module.exports.dynamoDb = new AwsUtil.DynamoDB.DocumentClient();
    }
    return module.exports.dynamoDb;
};

/**
 * getS3
 * @returns {*}
 */
module.exports.getS3 = () => {
    if (module.exports.s3 === undefined || module.exports.s3 === null) {
        AwsUtil.config.update({
            accessKeyId: process.env.AWS_ACCESS_KEY,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_SECRET,
            region: 'us-west-2',
        });
        module.exports.s3 = new AwsUtil.S3();
    }
    return module.exports.s3;
};

/**
 * getS3BucketName
 * @param app
 * @returns {string}
 */
module.exports.getS3BucketName = (app) => {
    let s3Bucket;
    if(app === 'say-radiant' || app === 'say'){
        if(process.env.ENV === 'DEV'){
            s3Bucket = 'saydevelopment-media-long-term';
        }
        if(process.env.ENV === 'STAGING'){
            s3Bucket = 'saystaging-media-long-term';
        }
        if(process.env.ENV === 'PRODUCTION'){
            s3Bucket = 'sayproduction.media.long.term';
        }
    } else {
        s3Bucket = app + `-media-long-term`;
    }

    return s3Bucket;
};
