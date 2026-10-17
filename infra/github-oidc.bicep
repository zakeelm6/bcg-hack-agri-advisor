// What an Azure administrator must approve so that GitHub can deploy this project: three narrow role assignments for the
// EXISTING deployment identity (growmate-github, already trusted by GitHub for the environment "production"). Nothing else changes.
//   az deployment group create -g <resource-group> --template-file infra/github-oidc.bicep \
//     --parameters acrName=<registry> apiApp=farm-final-api webApp=farm-final-web
targetScope = 'resourceGroup'

@description('Existing Azure Container Registry name.')
param acrName string

@description('Existing Container App that runs the API.')
param apiApp string = 'farm-final-api'

@description('Existing Container App that runs the web app.')
param webApp string = 'farm-final-web'

@description('Existing user-assigned identity that GitHub signs in as.')
param identityName string = 'growmate-github'

var acrPushRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '8311e382-0749-4cb8-b61a-304f252e45ec')
var containerAppsContributorRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '358470bc-b998-42bd-ab17-a7e34c199c0f')

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' existing = {
  name: identityName
}

resource acr 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' existing = {
  name: acrName
}

resource api 'Microsoft.App/containerApps@2024-03-01' existing = {
  name: apiApp
}

resource web 'Microsoft.App/containerApps@2024-03-01' existing = {
  name: webApp
}

resource acrPush 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, identity.id, acrPushRoleId)
  scope: acr
  properties: {
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: acrPushRoleId
  }
}

resource updateApi 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(api.id, identity.id, containerAppsContributorRoleId)
  scope: api
  properties: {
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: containerAppsContributorRoleId
  }
}

resource updateWeb 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(web.id, identity.id, containerAppsContributorRoleId)
  scope: web
  properties: {
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: containerAppsContributorRoleId
  }
}
