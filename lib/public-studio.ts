import { getStudioContent } from './studio-settings'
import { getPublishedProjects } from './repositories/brain'
import type { Database } from './repositories/schema'

export async function getPublicStudioContent(db: Database) {
  const [content, projects] = await Promise.all([getStudioContent(db), getPublishedProjects(db)])
  // Only the reviewed public projection crosses into the public site.
  return {
    ...content,
    projects: [
      ...projects,
      ...content.projects.filter((item) => !projects.some((project) => project.id === item.id)),
    ],
  }
}
