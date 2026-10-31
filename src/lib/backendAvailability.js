// Recognize a missing rollout dependency, not a timeout or authorization failure.
export const missingBackend = error => ['PGRST202','PGRST205','42883','42P01'].includes(error?.code)
export const backendUpgradeMessage = 'This feature is awaiting the backend upgrade. Your existing account, credits and history are preserved. Please contact support; retrying will not install the update.'
