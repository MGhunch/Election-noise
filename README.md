# Election Noise

A simple static website that maps election policies across nine conversations.

## Launch checklist

1. Replace the demo entries in `data/policies.json` with real, verified policy data.
2. Add an RNZ or original source URL to each policy.
3. Update the `updated` date in `data/policies.json`.
4. Upload all files to the root of a GitHub repository.
5. Deploy with GitHub Pages, Cloudflare Pages, Netlify, or Railway.

## GitHub Pages

In the repository:

- Open **Settings**
- Open **Pages**
- Under **Build and deployment**, choose **Deploy from a branch**
- Select `main` and `/root`
- Save

The site will appear at the GitHub Pages URL.

## Custom domain

Add a file named `CNAME` containing:

`electionnoise.hunch.co.nz`

Then point the DNS record for `electionnoise.hunch.co.nz` to the hosting provider.

## Data format

```json
{
  "id": "unique-id",
  "party": "Labour",
  "title": "Policy title",
  "conversation": "Health",
  "secondary": "Cost of Living",
  "size": "Flagship",
  "verified": true,
  "source": "https://..."
}
```

Accepted sizes:

- `Flagship`
- `Significant`
- `Narrow`

Accepted conversations:

- Cost of Living
- Health
- Housing
- Economy
- Education
- Crime & Justice
- Environment
- Future & Infrastructure
- Government & Democracy
