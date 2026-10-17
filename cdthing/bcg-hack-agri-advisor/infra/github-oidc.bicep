targetScope = 'resourceGroup'

@description('GitHub repository in owner/name form.')
param repository string

@description('Existing Azure Container Registry name.')
param acrName string

@description('Existing Container App name.')
param appName string = 'frontend'

var acrPushRoleId = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  '8311e382-0749-4cb8-b61a-304f252e45ec'
)
var containerAppsContributorRoleId = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  '358470bc-b998-42bd-ab17-a7e34c199c0f'
)

resource acr 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' existing = {
  name: acrName
}

resource app 'Microsoft.App/containerApps@2024-03-01' existing = {
  name: appName
}

resource deploymentIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'growmate-github'
  location: resourceGroup().location
}

resource productionFederation 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = {
  parent: deploymentIdentity
  name: 'github-production'
  properties: {
    audiences: [
      'api://AzureADTokenExchange'
    ]
    issuer: 'https://token.actions.githubusercontent.com'
    subject: 'repo:${repository}:environment:production'
  }
}

resource acrPush 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, deploymentIdentity.id, acrPushRoleId)
  scope: acr
  properties: {
    principalId: deploymentIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: acrPushRoleId
  }
}

resource updateApp 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(app.id, deploymentIdentity.id, containerAppsContributorRoleId)
  scope: app
  properties: {
    principalId: deploymentIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: containerAppsContributorRoleId
  }
}

output clientId string = deploymentIdentity.properties.clientId
output principalId string = deploymentIdentity.properties.principalId
output tenantId string = deploymentIdentity.properties.tenantId
