#!/usr/bin/env bash
set -e

# ==============================================================================
# Bureau of Immigration eServices - AWS Automated Deployment Script
# ==============================================================================

AWS_REGION="${AWS_REGION:-ap-southeast-1}"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
STACK_NAME="${STACK_NAME:-bi-eservices-stack}"

echo "======================================================"
echo "🚀 Deploying to AWS"
echo "Account ID: ${AWS_ACCOUNT_ID}"
echo "Region:     ${AWS_REGION}"
echo "Stack Name: ${STACK_NAME}"
echo "======================================================"

# 1. Ensure ECR Repositories Exist
echo "1. Checking/Creating ECR repositories..."
aws ecr describe-repositories --repository-names bi-backend --region "${AWS_REGION}" 2>/dev/null || \
  aws ecr create-repository --repository-name bi-backend --region "${AWS_REGION}"

aws ecr describe-repositories --repository-names bi-frontend --region "${AWS_REGION}" 2>/dev/null || \
  aws ecr create-repository --repository-name bi-frontend --region "${AWS_REGION}"

# 2. Login to ECR
echo "2. Logging in to Amazon ECR..."
aws ecr get-login-password --region "${AWS_REGION}" | docker login --username AWS --password-stdin "${ECR_REGISTRY}"

# 3. Build & Tag Container Images
echo "3. Building backend and frontend container images..."
docker build -t bi-backend:latest ./backend
docker tag bi-backend:latest "${ECR_REGISTRY}/bi-backend:latest"

docker build -t bi-frontend:latest ./frontend
docker tag bi-frontend:latest "${ECR_REGISTRY}/bi-frontend:latest"

# 4. Push to ECR
echo "4. Pushing images to Amazon ECR..."
docker push "${ECR_REGISTRY}/bi-backend:latest"
docker push "${ECR_REGISTRY}/bi-frontend:latest"

# 5. Deploy CloudFormation Stack
echo "5. Deploying CloudFormation Stack '${STACK_NAME}'..."
aws cloudformation deploy \
  --template-file ./deploy/aws/cloudformation.yaml \
  --stack-name "${STACK_NAME}" \
  --capabilities CAPABILITY_NAMED_IAM \
  --region "${AWS_REGION}" \
  --parameter-overrides \
    BackendImage="${ECR_REGISTRY}/bi-backend:latest" \
    FrontendImage="${ECR_REGISTRY}/bi-frontend:latest"

echo "======================================================"
echo "🎉 AWS Deployment Complete!"
echo "======================================================"
