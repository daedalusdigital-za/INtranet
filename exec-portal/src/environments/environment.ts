// Production build: the CI workflow (.github/workflows/exec-portal-swa.yml) replaces __EXEC_API_BASE__
// with the Azure edge host (e.g. https://app-rocket-portal-edge.azurewebsites.net) before building.
export const environment = {
  production: true,
  apiBase: '__EXEC_API_BASE__',
  brandName: 'Payment approvals'
};
