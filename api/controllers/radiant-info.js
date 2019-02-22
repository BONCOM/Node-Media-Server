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

exports.getInfo = getInfo;
