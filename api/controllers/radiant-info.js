//
//  Created by Layne Moseley on 19/03/21.
//  layne[a]radiant.org
//  Copyright (c) 2019 Radiant. All rights reserved.
//


function getInfo(req, res, next) {
    let info = {
      env: process.env,
    };
    res.json(info);
}

exports.getInfo = getInfo;
