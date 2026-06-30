import { describe, expect, it } from 'vitest'
import {
  independentSiteFromHostname,
  independentSiteSuffix,
  independentSiteUrl,
  mainAppUrl,
} from './independentSites'

const localhost = {
  protocol: 'http:',
  hostname: 'localhost',
  port: '5173',
  origin: 'http://localhost:5173',
}

describe('independent site URLs', () => {
  it('creates localhost subdomains while preserving the dev-server port', () => {
    expect(independentSiteUrl('account', '/', localhost)).toBe('http://account.localhost:5173/')
    expect(independentSiteUrl('support', '/?topic=billing', localhost)).toBe(
      'http://support.localhost:5173/?topic=billing',
    )
  })

  it('recognizes independent hosts and links them back to the main app', () => {
    const supportLocation = {
      ...localhost,
      hostname: 'support.localhost',
      origin: 'http://support.localhost:5173',
    }

    expect(independentSiteFromHostname(supportLocation.hostname)).toBe('support')
    expect(mainAppUrl('/login', supportLocation)).toBe('http://localhost:5173/login')
  })

  it('maps legacy site paths to clean subdomain-root paths', () => {
    expect(independentSiteSuffix('download', '/download')).toBe('/')
    expect(independentSiteSuffix('support', '/support?topic=privacy')).toBe('/?topic=privacy')
  })
})
