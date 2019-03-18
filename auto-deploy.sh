#! /bin/bash

if [ "${CIRCLE_BRANCH}" == "master" ]; then
    ./deploy-dev.sh
fi

if [ "${CIRCLE_BRANCH}" == "staging" ]; then
    ./deploy-staging.sh
fi

if [ "${CIRCLE_BRANCH}" == "production" ]; then
    ./deploy-production.sh
fi

./deploy-dev.sh