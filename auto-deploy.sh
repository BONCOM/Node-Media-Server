#! /bin/bash

if [ "${CIRCLE_BRANCH}" == "master" ]
    ./deploy-dev.sh
fi

if [ "${CIRCLE_BRANCH}" == "staging" ]
    ./deploy-staging.sh
fi

if [ "${CIRCLE_BRANCH}" == "production" ]
    ./deploy-production.sh
fi

./deploy-dev.sh