export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initDb } = await import('./lib/db/client')
    await initDb().catch(() => {
      // DB may not exist yet; build:lca:seed creates it
    })
  }
}
