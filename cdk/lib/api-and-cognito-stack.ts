import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cognito from 'aws-cdk-lib/aws-cognito';

interface ApiAndCognitoStackProps extends cdk.StackProps {
  lambda: lambda.Function;
}

export class ApiAndCognitoStack extends cdk.Stack {
  public readonly api: apigw.RestApi;

  constructor(scope: Construct, id: string, props: ApiAndCognitoStackProps) {
    super(scope, id, props);

    // Create a new API Gateway REST API
    this.api = new apigw.RestApi(this, 'RemedationPredictionAPI', {
      restApiName: 'RemedationPredictionAPI',
      description: 'API for predicting loan remediation effectiveness',
    });

    // Define the API Gateway resource
    const loanResource = this.api.root.addResource('loan');

    // Create a new Cognito User Pool
    const userPool = new cognito.UserPool(this, 'RemedationUserPool', {
      userPoolName: 'RemedationUserPool',
      selfSignUpEnabled: true,
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      userVerification: {
        emailSubject: 'Verify your email for Remedation App',
        emailBody: 'Hello {username}, Thanks for signing up to Remedation App! Your verification code is {####}',
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },
      standardAttributes: {
        fullname: {
          required: true,
          mutable: true,
        },
      },
    });

    // Configure Cognito domain for hosted UI
    const cognitoDomain = userPool.addDomain('RemedationDomain', {
      cognitoDomain: {
        domainPrefix: 'remedation-app', // Replace with your desired domain prefix
      },
    });

    // Create a new Cognito User Pool Client
    const userPoolClient = userPool.addClient('RemedationUserPoolClient', {
      authFlows: {
        userPassword: true,
      },
    });

    // Create a new Cognito Authorizer for API Gateway
    const authorizer = new apigw.CognitoUserPoolsAuthorizer(
      this,
      'RemedationAuthorizer',
      {
        cognitoUserPools: [userPool],
        authorizerName: 'RemedationAuthorizer',
        identitySource: 'method.request.header.Authorization',
      }
    );

    // Define the request body model
    const requestBodyModel = this.api.addModel('RequestBodyModel', {
      contentType: 'application/json',
      modelName: 'RequestBodyModel',
      schema: {
        type: apigw.JsonSchemaType.OBJECT,
        title: 'RequestBodyModel',
        required: [
          'age',
          'gender',
          'income',
          'loan_type',
          'loan_amount',
          'interest_rate',
          'loan_term',
          'loan_interest_rate',
          'credit_score',
          'employment_status',
          'marital_status',
          'remediation_strategy',
          'missed_payments',
          'missed_payments_duration',
        ],
        properties: {
          age: {
            type: apigw.JsonSchemaType.INTEGER,
            minimum: 18,
            maximum: 65,
          },
          gender: {
            type: apigw.JsonSchemaType.STRING,
            enum: ['Male', 'Female'],
          },
          income: {
            type: apigw.JsonSchemaType.INTEGER,
            minimum: 20000,
            maximum: 200000,
          },
          loan_type: {
            type: apigw.JsonSchemaType.STRING,
            enum: ['Personal', 'Auto', 'Home', 'Student', 'Business'],
          },
          loan_amount: {
            type: apigw.JsonSchemaType.INTEGER,
            minimum: 10000,
            maximum: 500000,
          },
          interest_rate: {
            type: apigw.JsonSchemaType.NUMBER,
            minimum: 0.05,
            maximum: 0.2,
          },
          loan_term: {
            type: apigw.JsonSchemaType.INTEGER,
            minimum: 12,
            maximum: 60,
          },
          loan_interest_rate: {
            type: apigw.JsonSchemaType.NUMBER,
            minimum: 5,
            maximum: 20,
          },
          credit_score: {
            type: apigw.JsonSchemaType.INTEGER,
            minimum: 300,
            maximum: 850,
          },
          employment_status: {
            type: apigw.JsonSchemaType.STRING,
            enum: ['Employed', 'Self-employed', 'Unemployed'],
          },
          marital_status: {
            type: apigw.JsonSchemaType.STRING,
            enum: ['Married', 'Single', 'Divorced'],
          },
          remediation_strategy: {
            type: apigw.JsonSchemaType.STRING,
            enum: [
              'Payment Reminder',
              'Loan Restructuring',
              'Debt Consolidation',
              'Forbearance',
              'Deferment',
              'Refinancing',
            ],
          },
          missed_payments: {
            type: apigw.JsonSchemaType.INTEGER,
            minimum: 0,
            maximum: 12,
          },
          missed_payments_duration: {
            type: apigw.JsonSchemaType.INTEGER,
            minimum: 0,
            maximum: 12,
          },
        },
      },
    });

    // Create a request validator
    const requestValidator = new apigw.RequestValidator(this, 'RequestValidator', {
      restApi: this.api,
      requestValidatorName: 'RequestValidator',
      validateRequestBody: true,
    });

    // Define the API Gateway method
    const predictMethod = loanResource.addMethod(
      'POST',
      new apigw.LambdaIntegration(props.lambda, {
        proxy: false,
        integrationResponses: [
          {
            statusCode: '200'
          },
        ],
      }),
      {
        authorizationType: apigw.AuthorizationType.COGNITO,
        authorizer,
        requestValidator,
        requestModels: {
          'application/json': requestBodyModel,
        },
        methodResponses: [
          {
            statusCode: '200'
          },
        ],
      }
    );
  }
}