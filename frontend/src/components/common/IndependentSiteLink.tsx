import type { AnchorHTMLAttributes, ReactNode } from 'react'
import {
  independentSiteSuffix,
  independentSiteUrl,
  type IndependentSite,
} from '@/utils/independentSites'

interface IndependentSiteLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  site: IndependentSite
  path?: string
  children: ReactNode
}

/** Opens one of the standalone web properties in a separate browser tab. */
export function IndependentSiteLink({ site, path = '/', children, ...props }: IndependentSiteLinkProps) {
  return (
    <a
      {...props}
      href={independentSiteUrl(site, independentSiteSuffix(site, path))}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  )
}
