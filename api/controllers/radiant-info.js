//
//  Created by Layne Moseley on 19/03/21.
//  layne[a]radiant.org
//  Copyright (c) 2019 Radiant. All rights reserved.
//



function getInfo(req, res, next) {
    const radiantBackendEndpoints = {
        LOCAL: process.env.LOCAL_RADIANT_BACKEND_SERVER,
        DEV: process.env.DEV_RADIANT_BACKEND_SERVER,
        STAGING: process.env.STAGING_RADIANT_BACKEND_SERVER,
        PRODUCTION: process.env.PRODUCTION_RADIANT_BACKEND_SERVER,
    };

    let info = {
      radiantBackend: radiantBackendEndpoints[process.env.ENV],
      env: process.env,
    };
    res.json(info);
}


function getVideoUrl(req, res, next) {
    const buckets = {
        DEV: process.env.DEV_S3_BUCKET,
        STAGING: process.env.STAGING_S3_BUCKET,
        PRODUCTION: process.env.PRODUCTION_S3_BUCKET,
    };


    const videoUrl = `https://s3.${process.env.S3_REGION}.amazonaws.com/${buckets[process.env.ENV]}/${req.params.uuid}-i.m3u8?params=true`;
    const thumbnailUrl = `https://s3.${process.env.S3_REGION}.amazonaws.com/${buckets[process.env.ENV]}/${req.params.uuid}`;
    res.json({
        videoUrl,
        thumbnailUrl,
    });
}


module.exports = {
    getInfo,
    getVideoUrl,
};
