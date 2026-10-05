import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';

export class PortfolioPlatformStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props?: cdk.StackProps,
  ) {
    super(scope, id, props);

    // S3 bucket privado para los portfolios
    const portfolioBucket = new s3.Bucket(
      this,
      'PortfolioBucket',
      {
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        encryption: s3.BucketEncryption.S3_MANAGED,
        enforceSSL: true,

        removalPolicy: cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
      },
    );

    // DynamoDB para almacenar los metadatos
    const portfolioTable = new dynamodb.Table(
      this,
      'PortfoliosTable',
      {
        partitionKey: {
          name: 'studentId',
          type: dynamodb.AttributeType.STRING,
        },

        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,

        encryption: dynamodb.TableEncryption.AWS_MANAGED,

        removalPolicy: cdk.RemovalPolicy.DESTROY,
      },
    );

    // CloudFront con Origin Access Control (OAC)
    const distribution = new cloudfront.Distribution(
      this,
      'PortfolioDistribution',
      {
        defaultBehavior: {
          origin:
            origins.S3BucketOrigin.withOriginAccessControl(
              portfolioBucket,
            ),

          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,

          cachePolicy:
            cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },

        defaultRootObject: 'index.html',

        // América + Europa + Asia
        priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
      },
    );

    // Rol que puede escribir archivos en S3
    const portfolioUploadRole = new iam.Role(
      this,
      'PortfolioUploadRole',
      {
        assumedBy: new iam.AccountPrincipal(
          cdk.Stack.of(this).account,
        ),
      },
    );

    portfolioBucket.grantWrite(portfolioUploadRole);

    // Rol que puede leer los metadatos de DynamoDB
    const portfolioMetadataRole = new iam.Role(
      this,
      'PortfolioMetadataRole',
      {
        assumedBy: new iam.AccountPrincipal(
          cdk.Stack.of(this).account,
        ),
      },
    );

    portfolioTable.grantReadData(portfolioMetadataRole);

    // Outputs
    new cdk.CfnOutput(this, 'PortfolioBucketName', {
      value: portfolioBucket.bucketName,
    });

    new cdk.CfnOutput(this, 'PortfolioTableName', {
      value: portfolioTable.tableName,
    });

    new cdk.CfnOutput(this, 'CloudFrontUrl', {
      value: `https://${distribution.distributionDomainName}`,
    });

    new cdk.CfnOutput(this, 'UploadRoleArn', {
      value: portfolioUploadRole.roleArn,
    });

    new cdk.CfnOutput(this, 'MetadataRoleArn', {
      value: portfolioMetadataRole.roleArn,
    });
  }
}