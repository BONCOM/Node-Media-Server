//
//  Created by Layne Moseley on 19/03/21.
//  layne[a]radiant.org
//  Copyright (c) 2019 Radiant. All rights reserved.
//

const AWS = require('../../aws_util/aws-util');

/**
 * getInfo
 * @param req
 * @param res
 * @param next
 */
function getInfo(req, res, next) {
    const radiantBackendEndpoints = {
        LOCAL: process.env.LOCAL_RADIANT_BACKEND_SERVER,
        DEV: process.env.DEV_RADIANT_BACKEND_SERVER,
        STAGING: process.env.STAGING_RADIANT_BACKEND_SERVER,
        PRODUCTION: process.env.PRODUCTION_RADIANT_BACKEND_SERVER,
    };

    let info = {
      radiantBackend: radiantBackendEndpoints[process.env.ENV],
    };
    res.json(info);
}

/**
 * getVideoUrl
 * @param req
 * @param res
 * @param next
 */
async function getVideoUrl(req, res, next) {
    const buckets = {
        DEV: process.env.DEV_S3_BUCKET,
        STAGING: process.env.STAGING_S3_BUCKET,
        PRODUCTION: process.env.PRODUCTION_S3_BUCKET,
    };

    // new urls
    const videoUrl = `https://s3.${process.env.S3_REGION}.amazonaws.com/${buckets[process.env.ENV]}/hls-live/${req.params.uuid}/i.m3u8`;
    const thumbnailUrl = `https://s3.${process.env.S3_REGION}.amazonaws.com/${buckets[process.env.ENV]}/hls-live/${req.params.uuid}/thumbnail.jpg`;

    const paramsThumb = {
        Bucket: `${buckets[process.env.ENV]}/hls-live/${req.params.uuid}`,
        Key: 'thumbnail.jpg',
    };

    const paramsVideo = {
        Bucket: `${buckets[process.env.ENV]}/hls-live/${req.params.uuid}`,
        Key: 'i.m3u8',
    };

        const thumb = AWS.getS3().headObject(paramsThumb).promise();
        const video = AWS.getS3().headObject(paramsVideo).promise();
        Promise.all([thumb, video].map(p => p.catch(e => e))).then(results => {
            res.json({
                thumbnail: {
                    thumbnailUrl,
                    status: results[0].code === 'NotFound' ? 'NotCreated' : 'Created',
                    key: `hls-live/${req.params.uuid}/thumbnail.jpg`,
                },
                video: {
                    videoUrl,
                    status: results[1].code === 'NotFound' ? 'NotCreated' : 'Created',
                    key: `hls-live/${req.params.uuid}/i.m3u8`,
                    m3u8Key: `${req.params.uuid}-i.m3u8`,
                },
            });
        }).catch(e => {
           res.json(e);
        });
}

module.exports = {
    getInfo,
    getVideoUrl,
};
