export const errorHandler = (err, c) => {
  console.error('Unhandled error:', err)
  const status = err.status || 500
  const message = status === 500 ? 'Internal Server Error' : err.message || 'Error'
  return c.json({ error: message }, status)
}
