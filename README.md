# Post Feed

React + Vite post feed with infinite scroll, optimistic likes, and refresh persistence.

Live demo: https://post-feed-2.netlify.app

*Created with AI during an interview.*

## Quick Start

```bash
npm install
npm run dev
npm run lint
npm run build
```

## API

- Base URL: `https://dummyapi.io/data/v1`
- Required header: `app-id: 61911ee21a52834977b1f525`
- Posts endpoint: `GET /post?page=<n>&limit=20`
- Like update attempt: `PUT /post/:id` with `{ likes }`

## Architecture

Small and maintainable structure:

```text
src/
  api/posts.js            # API calls + normalization
  hooks/usePosts.js       # pagination, fetch guards, like behavior
  components/PostCard.jsx # post UI
  App.jsx                 # page shell + intersection observer
  index.css               # minimal styling
```

- `App.jsx` renders the feed and attaches the bottom sentinel observer.
- `usePosts` owns feed state and exposes `loadNextPage`, `retryLastFailedPage`, `toggleLike`.
- `api/posts.js` centralizes headers, fetch calls, and post normalization.

## Key Decisions

### Infinite scroll
- Loads posts in pages of 20.
- Uses `IntersectionObserver` with `rootMargin` to prefetch before true bottom.
- Prevents duplicate requests using in-hook guards plus module-level in-flight page dedupe.
- Stops when `hasMore` is false.
- Pauses auto-loading on error until user retries.

### Likes
- Uses optimistic UI updates for instant feedback.
- Attempts server sync with `PUT /post/:id`.
- Persists `likedByMe` in `localStorage` (DummyAPI does not provide true per-user likes).
- Persists local like-count override only when server update fails.
- Uses per-post request ids to ignore stale rapid-click responses.

### Loading and error states
- Initial load: loading message.
- Initial failure: error + retry.
- Pagination failure: non-blocking error + retry failed page.
- End of list: "No more posts."

## Performance

- Pagination with `limit=20`.
- Lazy-loaded images (`loading="lazy"`).
- Append-only list with dedupe by post id.
- `React.memo` on `PostCard`.

## Tradeoffs and Limitations

- No virtualization (kept scope lean for current requirements).
- DummyAPI like model is not truly user-specific; `likedByMe` is intentionally client-managed.
- Server and local like count can temporarily diverge if API update fails; local override preserves UX continuity.

## FAQ

**Why localStorage for likes?**  
DummyAPI does not provide authenticated per-user like state. localStorage preserves user intent across refresh while still allowing best-effort server sync.

**How are duplicate infinite-scroll calls prevented?**  
By combining in-hook fetch guards with module-level in-flight dedupe keyed by page index.

**What happens on rapid repeated like clicks?**  
Each post has a request sequence id. Older responses are ignored so the latest user action wins.

**Why no React Query / global store / virtualization?**  
For the current scope, a focused custom hook keeps complexity low while still covering correctness and maintainability.

**What would be the next improvements?**  
1. Add unit tests for pagination and like race handling.  
2. Add an integration test for observer-triggered pagination.  
3. Add virtualization if feed size/perf requirements increase.

## Manual QA (Optional)

1. Confirm first page loads.
2. Scroll and confirm posts append in batches of 20.
3. Continue until "No more posts." appears.
4. Click Like/Unlike and confirm immediate counter updates.
5. Refresh and confirm liked state persists.
6. Simulate API/network failure and confirm retry behavior.
7. Verify network calls: `GET /post?page=<n>&limit=20` and `PUT /post/:id`.
