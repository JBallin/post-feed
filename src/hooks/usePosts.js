import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_LIMIT, fetchPostsPage, updatePostLikes } from '../api/posts';

const LIKED_POST_IDS_KEY = 'post-feed-liked-post-ids';
const LIKE_COUNT_OVERRIDES_KEY = 'post-feed-like-count-overrides';
// Module-level cache dedupes the same page request across strict-mode remounts.
const inFlightPageRequests = new Map();
const hasStorage = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

function readLikedPostIds() {
  if (!hasStorage) return new Set();

  try {
    const raw = localStorage.getItem(LIKED_POST_IDS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function writeLikedPostIds(ids) {
  if (!hasStorage) return;

  localStorage.setItem(LIKED_POST_IDS_KEY, JSON.stringify(Array.from(ids)));
}

function readLikeCountOverrides() {
  if (!hasStorage) return new Map();

  try {
    const raw = localStorage.getItem(LIKE_COUNT_OVERRIDES_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw);
    const entries = Object.entries(parsed || {})
      .map(([postId, value]) => [postId, Number(value)])
      .filter(([, value]) => Number.isFinite(value));
    return new Map(entries);
  } catch {
    return new Map();
  }
}

function writeLikeCountOverrides(overrides) {
  if (!hasStorage) return;

  const serialized = Object.fromEntries(overrides);
  localStorage.setItem(LIKE_COUNT_OVERRIDES_KEY, JSON.stringify(serialized));
}

function mergePosts(existingPosts, incomingPosts) {
  const seen = new Set(existingPosts.map((post) => post.id));
  const deduped = incomingPosts.filter((post) => !seen.has(post.id));
  return existingPosts.concat(deduped);
}

function fetchPageDeduped(page, limit, likedIds, likeOverrides) {
  if (!inFlightPageRequests.has(page)) {
    const request = fetchPostsPage(page, limit, likedIds, likeOverrides).finally(() => {
      inFlightPageRequests.delete(page);
    });
    inFlightPageRequests.set(page, request);
  }

  return inFlightPageRequests.get(page);
}

export function usePosts() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(true);

  const nextPageRef = useRef(0);
  // Keep last failed page so retry is deterministic.
  const failedPageRef = useRef(null);
  const hasMoreRef = useRef(true);
  const isFetchingRef = useRef(false);
  // Fast lookup for current post snapshot used by toggleLike.
  const postsByIdRef = useRef(new Map());
  const likedPostIdsRef = useRef(readLikedPostIds());
  const likesOverrideByPostIdRef = useRef(readLikeCountOverrides());
  const likeRequestIdByPostRef = useRef(new Map());

  useEffect(() => {
    postsByIdRef.current = new Map(posts.map((post) => [post.id, post]));
  }, [posts]);

  const loadPage = useCallback(async (pageToLoad) => {
    // Guard against overlapping calls from observer + button clicks.
    if (isFetchingRef.current || !hasMoreRef.current) {
      return;
    }

    isFetchingRef.current = true;
    setLoading(true);
    setError('');

    try {
      const result = await fetchPageDeduped(
        pageToLoad,
        DEFAULT_LIMIT,
        likedPostIdsRef.current,
        likesOverrideByPostIdRef.current,
      );

      setPosts((current) => mergePosts(current, result.posts));
      setHasMore(result.hasMore);
      hasMoreRef.current = result.hasMore;
      nextPageRef.current = Math.max(nextPageRef.current, pageToLoad + 1);
      failedPageRef.current = null;
    } catch (err) {
      failedPageRef.current = pageToLoad;
      setError(err instanceof Error ? err.message : 'Failed to load posts');
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, []);

  const loadNextPage = useCallback(() => loadPage(nextPageRef.current), [loadPage]);

  const retryLastFailedPage = useCallback(() => {
    if (failedPageRef.current === null) {
      return loadNextPage();
    }

    return loadPage(failedPageRef.current);
  }, [loadNextPage, loadPage]);

  const toggleLike = useCallback(async (postId) => {
    const currentPost = postsByIdRef.current.get(postId);
    if (!currentPost) {
      return;
    }

    const nextLikedByMe = !currentPost.likedByMe;
    const nextLikes = Math.max(0, currentPost.likes + (nextLikedByMe ? 1 : -1));
    const updatedPost = {
      ...currentPost,
      likedByMe: nextLikedByMe,
      likes: nextLikes,
    };

    const nextRequestId = (likeRequestIdByPostRef.current.get(postId) || 0) + 1;
    likeRequestIdByPostRef.current.set(postId, nextRequestId);

    setPosts((current) =>
      current.map((post) => {
        if (post.id !== postId) return post;
        return updatedPost;
      }),
    );
    postsByIdRef.current.set(postId, updatedPost);

    if (updatedPost.likedByMe) {
      likedPostIdsRef.current.add(postId);
    } else {
      likedPostIdsRef.current.delete(postId);
    }

    writeLikedPostIds(likedPostIdsRef.current);

    try {
      await updatePostLikes(postId, updatedPost.likes);
      // Ignore stale responses when user clicks the same button rapidly.
      if (likeRequestIdByPostRef.current.get(postId) !== nextRequestId) {
        return;
      }

      if (likesOverrideByPostIdRef.current.has(postId)) {
        likesOverrideByPostIdRef.current.delete(postId);
        writeLikeCountOverrides(likesOverrideByPostIdRef.current);
      }
    } catch {
      // Same stale-response guard for failed requests.
      if (likeRequestIdByPostRef.current.get(postId) !== nextRequestId) {
        return;
      }

      likesOverrideByPostIdRef.current.set(postId, updatedPost.likes);
      writeLikeCountOverrides(likesOverrideByPostIdRef.current);
    }
  }, []);

  return useMemo(
    () => ({
      posts,
      loading,
      error,
      hasMore,
      loadNextPage,
      retryLastFailedPage,
      toggleLike,
    }),
    [posts, loading, error, hasMore, loadNextPage, retryLastFailedPage, toggleLike],
  );
}
