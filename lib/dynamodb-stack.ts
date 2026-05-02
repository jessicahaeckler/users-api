import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

export class DynamoDBStack extends cdk.Stack {
    public readonly usersTable: dynamodb.Table;
    public readonly auditLogTable: dynamodb.Table;

    constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        this.usersTable = new dynamodb.Table(this, 'UsersTable', {
            partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY, // NOT recommended for production code
            tableName: `${this.stackName}-users-table`
        })

        this.auditLogTable = new dynamodb.Table(this, 'AuditLogTable', {
            partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            removalPolicy: cdk.RemovalPolicy.DESTROY, // NOT recommended for production code
            tableName: `${this.stackName}-audit-log-table`,
            timeToLiveAttribute: 'ttl',

        })
        this.auditLogTable.addGlobalSecondaryIndex({
            indexName: 'action-timestamp-index',
            partitionKey: { name: 'action', type: dynamodb.AttributeType.STRING },
            sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING }
        });
    }
}