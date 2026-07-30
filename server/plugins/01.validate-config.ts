export default defineNitroPlugin(() => {
  const config = useRuntimeConfig()
  if (!config.sessionSecret || config.sessionSecret.length < 32) {
    throw new Error('SESSION_SECRET is missing or too short (need >= 32 chars). Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"')
  }
})
