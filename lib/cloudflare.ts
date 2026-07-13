import { getCloudflareContext, type CloudflareContext } from '@opennextjs/cloudflare'

const NEXT_PRODUCTION_BUILD_PHASE = 'phase-production-build'
const BUILD_CONTEXT: CloudflareContext = {
  env: {} as CloudflareEnv,
  cf: undefined,
  ctx: {
    exports: {},
    props: {},
    waitUntil() {},
    passThroughOnException() {},
  } as unknown as CloudflareContext['ctx'],
}

export async function getAppCloudflareContext() {
  if (
    process.env.NEXT_PHASE === NEXT_PRODUCTION_BUILD_PHASE &&
    process.env.OPENNEXT_USE_CLOUDFLARE_CONTEXT_DURING_BUILD !== '1'
  ) {
    return BUILD_CONTEXT
  }

  return getCloudflareContext({ async: true })
}

export async function getAppCloudflareEnv() {
  return (await getAppCloudflareContext()).env
}
