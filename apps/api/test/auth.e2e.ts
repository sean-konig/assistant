import { describe, it } from 'vitest'
import request from 'supertest'

// Note: This is a placeholder test. In a real setup, inject a test JWKS and sign a JWT.
describe.skip('Auth E2E', () => {
  it('GET /auth/me should return 401 without token', async () => {
    const res = await request('http://127.0.0.1:3002').get('/auth/me')
    expect(res.status).toBe(401)
  })
})

