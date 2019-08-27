#! /bin/bash

while getopts p: option
do
case "${option}"
in
p) PROFILE=${OPTARG};;
esac
done

# Notify Slack of Production Deployment
curl -X POST -H 'Content-type: application/json' --data '{"text":"Deploying Node Media Server to Production"}' https://hooks.slack.com/services/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

# Gets an authentication token from aws and then executes that to login to docker
$(aws ecr get-login --no-include-email --profile ${PROFILE})

# Build the docker image and push it to ECR
docker build ./ -t 028621403234.dkr.ecr.us-west-2.amazonaws.com/node-media-server-prod
docker push 028621403234.dkr.ecr.us-west-2.amazonaws.com/node-media-server-prod

# Delete pods with the old version, new pods come up automatically
kubectl delete pods -l app=node-media-prod --grace-period=300 -n prod
kubectl get pods -l app=node-media-prod -n prod
