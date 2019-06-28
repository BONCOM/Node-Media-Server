#! /bin/bash

ENV='dev'
PROFILE='shared-prod'

# Reusable function to get ssm parameter
get_ssm () {
    PARAMETER=$(aws ssm get-parameter --name $1 --with-decryption --profile ${PROFILE} | python -c 'import json,sys;obj=json.load(sys.stdin);print obj["Parameter"]["Value"]')
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
get_ssm nms-timeout-to-cleanup
echo "TIMEOUT_TO_CLEANUP=$PARAMETER" >> .env
get_ssm nms-thumbnail-segment
echo "THUMBNAIL_SEGMENT=$PARAMETER" >> .env
get_ssm nms-loggly-token
echo "LOGGLY_TOKEN=$PARAMETER" >> .env

# Now we run the deploy script.
if [ "${ENV}" == "dev" ]; then
    ./deploy-dev.sh -p shared-prod
elif [ "${ENV}" == "stag" ]; then
    ./deploy-stag.sh -p shared-prod
elif [ "${ENV}" == "prod" ]; then
    ./deploy-prod.sh -p shared-prod
fi