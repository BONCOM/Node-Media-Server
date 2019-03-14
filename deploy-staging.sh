# Gets an authentication token from aws and then executes that to login to docker
$(aws ecr get-login --no-include-email)

# Build the docker image and push it to ECR
docker build ./ -t 989566306259.dkr.ecr.us-west-2.amazonaws.com/node-media-server-staging
docker push 989566306259.dkr.ecr.us-west-2.amazonaws.com/node-media-server-staging

# Delete pods with the old version, new pods come up automatically
kubectl delete pods -l app=node-media-staging --grace-period=180
kubectl get pods -l app=node-media-staging