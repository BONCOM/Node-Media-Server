#! /bin/bash

# Notify Slack of Staging Deployment
curl -X POST -H 'Content-type: application/json' --data '{"text":"Deploying Node Media Server to Staging"}' https://hooks.slack.com/services/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

# Gets an authentication token from aws and then executes that to login to docker
$(aws ecr get-login --no-include-email)

# Build the docker image and push it to ECR
docker build ./ -t 028621403234.dkr.ecr.us-west-2.amazonaws.com/node-media-server-stag
docker push 028621403234.dkr.ecr.us-west-2.amazonaws.com/node-media-server-stag

# Delete pods with the old version, new pods come up automatically
kubectl delete pods -l app=node-media-stag --grace-period=180 -n stag
kubectl get pods -l app=node-media-stag -n stag