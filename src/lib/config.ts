export const config = {
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "YOUR_GOOGLE_CLIENT_ID",
  googleClientSecret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET ?? "",
  cognitoIdentityPoolId:
    import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID ?? "us-east-1:YOUR_POOL_ID",
  awsRegion: import.meta.env.VITE_AWS_REGION ?? "us-east-1",
  dynamoTableName: import.meta.env.VITE_DYNAMO_TABLE ?? "friends-app",
  redirectUri: (port: number) => `http://localhost:${port}`,
};
