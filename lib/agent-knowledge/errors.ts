export class AgentRepositoryError extends Error {
  constructor(message: string, readonly httpStatus: 404 | 409) {
    super(message)
    this.name = 'AgentRepositoryError'
  }
}

export function getAgentRepositoryErrorStatus(error: unknown): 404 | 409 | null {
  return error instanceof AgentRepositoryError ? error.httpStatus : null
}
