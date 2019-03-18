#! /bin/bash

# Copies the .env file from s3 because we don't want that to be checked in
aws s3 cp s3://radiant.node-media.config/env-file .env

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