#! /bin/bash

# Builds the .env file from scratch because we don't want that to be checked in
if [ "${CIRCLE_BRANCH}" == "master" ]; then
    ENV='dev'
elif [ "${CIRCLE_BRANCH}" == "staging" ]; then
    ENV='stag'
elif [ "${CIRCLE_BRANCH}" == "production" ]; then
    ENV='prod'
fi

## Dynamically create variable names
env_region=${ENV}_REGION

## This script to be run before automatic deploys to get the environment setup
echo "Settings AWS config for radiant"
aws configure set radiant.region "${!env_region}"

## This is so hack, but it works
## https://discuss.circleci.com/t/support-for-aws-credentials-profiles/3698/2
echo -e "[radiant]\naws_access_key_id=${SHARED_AWS_ACCESS_KEY_ID}\naws_secret_access_key=${SHARED_AWS_SECRET_ACCESS_KEY}\n" > ~/.aws/credentials

# Reusable function to get ssm parameter
get_ssm () {
    PARAMETER=$(aws ssm get-parameter --name $1 --with-decryption --profile radiant | python -c 'import json,sys;obj=json.load(sys.stdin);print obj["Parameter"]["Value"]')
}

# Build a .env file from the param store
get_ssm nms-shared-secret
echo "SHARED_SECRET=\"$PARAMETER\"" > .env
get_ssm nms-${ENV}-aws-access-key
echo "AWS_ACCESS_KEY=\"$PARAMETER\"" >> .env
get_ssm nms-${ENV}-aws-access-secret
echo "AWS_SECRET_ACCESS_SECRET=\"$PARAMETER\"" >> .env
get_ssm nms-s3-region
echo "S3_REGION=\"$PARAMETER\"" >> .env
get_ssm nms-${ENV}-s3-bucket
echo "S3_BUCKET=\"$PARAMETER\"" >> .env
get_ssm nms-${ENV}-backend-server
echo "RADIANT_BACKEND_SERVER=\"$PARAMETER\"" >> .env
get_ssm nms-https-port
echo "HTTPS_PORT=$PARAMETER" >> .env
get_ssm nms-http-port
echo "HTTP_PORT=$PARAMETER" >> .env
get_ssm nms-rtmp-port
echo "RTMP_PORT=$PARAMETER" >> .env
echo "ENV=\"DEV\"" >> .env
get_ssm nms-secure-publish
echo "SECURE_PUBLISH=$PARAMETER" >> .env
get_ssm nms-secure-play
echo "SECURE_PLAY=$PARAMETER" >> .env
get_ssm nms-api-user
echo "API_USER=\"$PARAMETER\"" >> .env
get_ssm nms-api-password
echo "API_PASSWORD=\"$PARAMETER\"" >> .env
get_ssm nms-ffmpeg-path
echo "FFMPEG_PATH=\"$PARAMETER\"" >> .env
get_ssm nms-segment-length
echo "SEGMENT_LENGTH=$PARAMETER" >> .env
get_ssm nms-timeout-to-create-video-object
echo "TIMEOUT_TO_CREATE_VIDEO_OBJECT=$PARAMETER" >> .env
get_ssm nms-timeout-to-cleanup
echo "TIMEOUT_TO_CLEANUP=$PARAMETER" >> .env
get_ssm nms-thumbnail-segment
echo "THUMBNAIL_SEGMENT=$PARAMETER" >> .env

# Now we run the deploy script.
if [ "${CIRCLE_BRANCH}" == "master" ]; then
    ./deploy-dev.sh
elif [ "${CIRCLE_BRANCH}" == "staging" ]; then
    ./deploy-stag.sh
elif [ "${CIRCLE_BRANCH}" == "production" ]; then
    ./deploy-prod.sh
fi