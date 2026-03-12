import { useEffect, useRef } from 'react';
import PostCard from './components/PostCard';
import { usePosts } from './hooks/usePosts';

function App() {
  const { posts, loading, error, hasMore, loadNextPage, retryLastFailedPage, toggleLike } = usePosts();
  const sentinelRef = useRef(null);

  useEffect(() => {
    loadNextPage();
  }, [loadNextPage]);

  useEffect(() => {
    if (!sentinelRef.current || !hasMore || error) return undefined;

    // Load ahead of reaching the true bottom for smoother scrolling.
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting || loading || error) return;
        loadNextPage();
      },
      { rootMargin: '200px' },
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, error, loadNextPage]);

  return (
    <main className="app">
      <div className="container">
        <h1 className="title">Post Feed</h1>
        <p className="subtitle">Infinite scroll feed using DummyAPI</p>

        {posts.length === 0 && loading && <p className="status">Loading posts...</p>}

        {error && posts.length === 0 && (
          <div className="status error">
            <p>Failed to load posts: {error}</p>
            <button type="button" onClick={retryLastFailedPage}>
              Retry
            </button>
          </div>
        )}

        <section className="feed" aria-label="Posts">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} onToggleLike={toggleLike} />
          ))}
        </section>

        {error && posts.length > 0 && (
          <div className="status error">
            <p>Error: {error}</p>
            <button type="button" onClick={retryLastFailedPage}>
              Retry loading more
            </button>
          </div>
        )}
        {loading && posts.length > 0 && <p className="status">Loading more...</p>}
        {!hasMore && posts.length > 0 && <p className="status">No more posts.</p>}

        <div ref={sentinelRef} className="sentinel" />
      </div>
    </main>
  );
}

export default App;
