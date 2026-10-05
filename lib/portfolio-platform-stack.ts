import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as fs from "fs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";

export class PortfolioPlatformStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 private bucket for portfolios
    const portfolioBucket = new s3.Bucket(this, "PortfolioBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // DynamoDB metadata
    const portfolioTable = new dynamodb.Table(this, "PortfoliosTable", {
      partitionKey: {
        name: "studentId",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // CloudFront public key
    const publicKey = new cloudfront.PublicKey(this, "PortfolioPublicKey", {
      encodedKey: fs.readFileSync("keys/cloudfront-public-key.pem", "utf8"),
      comment: "Public key for private portfolio files",
    });

    // CloudFront key group
    const keyGroup = new cloudfront.KeyGroup(this, "PortfolioKeyGroup", {
      items: [publicKey],
      comment: "Key group for private portfolio files",
    });

    // CloudFront distribution with OAC
    const distribution = new cloudfront.Distribution(
      this,
      "PortfolioDistribution",
      {
        defaultBehavior: {
          origin:
            origins.S3BucketOrigin.withOriginAccessControl(portfolioBucket),
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },

        // Private portfolio files require a signed URL
        additionalBehaviors: {
          "private/*": {
            origin:
              origins.S3BucketOrigin.withOriginAccessControl(portfolioBucket),
            viewerProtocolPolicy:
              cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
            trustedKeyGroups: [keyGroup],
          },
        },

        defaultRootObject: "index.html",

        // Americas + Europe + Asia
        priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
      },
    );

    // IAM role to write portfolio files to S3
    const portfolioUploadRole = new iam.Role(this, "PortfolioUploadRole", {
      assumedBy: new iam.AccountPrincipal(cdk.Stack.of(this).account),
    });

    portfolioBucket.grantWrite(portfolioUploadRole);

    // IAM role to read DynamoDB metadata
    const portfolioMetadataRole = new iam.Role(this, "PortfolioMetadataRole", {
      assumedBy: new iam.AccountPrincipal(cdk.Stack.of(this).account),
    });

    portfolioTable.grantReadData(portfolioMetadataRole);

    // Outputs
    new cdk.CfnOutput(this, "PortfolioBucketName", {
      value: portfolioBucket.bucketName,
    });

    new cdk.CfnOutput(this, "PortfolioTableName", {
      value: portfolioTable.tableName,
    });

    new cdk.CfnOutput(this, "CloudFrontUrl", {
      value: `https://${distribution.distributionDomainName}`,
    });

    new cdk.CfnOutput(this, "UploadRoleArn", {
      value: portfolioUploadRole.roleArn,
    });

    new cdk.CfnOutput(this, "MetadataRoleArn", {
      value: portfolioMetadataRole.roleArn,
    });
  }
}
